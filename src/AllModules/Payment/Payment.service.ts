import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../../entities/Payment';
import { Task } from '../../entities/Task';
import { TaskService } from '../Task/Task.service';   
import { PaymentStatusEnum } from '../../Enums/payment-status.enum';
import { PaymentMethodEnum } from '../../Enums/payment-method.enum';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {

  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Task)    private taskRepo:    Repository<Task>,
    private readonly httpService: HttpService,

    @Inject(forwardRef(() => TaskService))
    private readonly taskService: TaskService,

  ) {}

  // ════════════════════════════════════════════════════════════
  // 1. CREATE INVOICE  (called on task approval)
  //    — creates the payment record with 50/50 split
  //    — does NOT publish job post yet
  // ════════════════════════════════════════════════════════════
  async createInitialInvoice(task: Task, companyId: number): Promise<Payment> {
    const depositAmount   = Number((task.totalCost * 0.5).toFixed(2));
    const remainingAmount = Number((task.totalCost - depositAmount).toFixed(2));
    const merchantOrderId = `ORDER_${task.id}_${Date.now()}`;

    const invoice = this.paymentRepo.create({
      task:              { id: task.id },
      company:           { id: companyId },
      workersCost:       task.baseWorkersCost,
      supervisingFees:   task.supervisingFees,
      platformFee:       task.platformFee,
      totalAmount:       task.totalCost,
      depositAmount,
      remainingAmount,
      depositStatus:     PaymentStatusEnum.PENDING,
      remainingStatus:   PaymentStatusEnum.PENDING,
      status:            PaymentStatusEnum.PENDING,
      transactionId:     merchantOrderId,
      depositMethod:     'PENDING',
      paymentMethod:     'PENDING',
    });

    return await this.paymentRepo.save(invoice);
  }

  // ════════════════════════════════════════════════════════════
  // 2. INITIATE PAYMENT
  //    — step: 'deposit'   → pay first 50%  (before task starts)
  //    — step: 'remaining' → pay second 50% (after task completes)
  // ════════════════════════════════════════════════════════════
  async initiatePayment(
    paymentId: number,
    companyId: number,
    method: PaymentMethodEnum,
    step: 'deposit' | 'remaining' = 'deposit',
  ) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, company: { id: companyId } },
      relations: ['task', 'company'],
    });

    if (!payment) throw new NotFoundException('Invoice not found or unauthorized');

    // ── Guards ────────────────────────────────────────────────
    if (step === 'deposit') {
      if (payment.depositStatus === PaymentStatusEnum.PAID ||
          payment.depositStatus === PaymentStatusEnum.PARTIALLY_PAID) {
        throw new BadRequestException('Deposit already paid');
      }
    }

    if (step === 'remaining') {
      if (payment.depositStatus !== PaymentStatusEnum.PAID) {
        throw new BadRequestException('Must pay deposit first before paying remaining amount');
      }
      if (payment.remainingStatus === PaymentStatusEnum.PAID) {
        throw new BadRequestException('Remaining amount already paid');
      }
    }

    // ── Determine amount ──────────────────────────────────────
    const amountCents = Math.round(
      Number(step === 'deposit' ? payment.depositAmount : payment.remainingAmount) * 100
    );

    const merchantOrderId = `${step.toUpperCase()}_${payment.id}_${Date.now()}`;

    // ── Paymob flow ───────────────────────────────────────────
    const { authToken }     = await this._paymobAuth();
    const { paymobOrderId } = await this._paymobCreateOrder(authToken, amountCents, merchantOrderId);
    const { paymentToken }  = await this._paymobPaymentKey(authToken, paymobOrderId, amountCents, method, payment);

    // ── Save order ID on the right column ────────────────────
    if (step === 'deposit') {
      payment.transactionId = merchantOrderId;
    } else {
      payment.remainingTransactionId = merchantOrderId;
    }
    await this.paymentRepo.save(payment);

    // ── Return URL / token ────────────────────────────────────
    if (method === PaymentMethodEnum.CARD) {
      const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
      return { paymentMethod: PaymentMethodEnum.CARD, paymentUrl, paymentToken, step };
    }

    return {
      paymentMethod: PaymentMethodEnum.WALLET,
      paymentToken,
      suggestedPhone: payment.company?.phone || '01000000000',
      step,
    };
  }

  // ════════════════════════════════════════════════════════════
  // 3. PROCESS SUCCESSFUL PAYMENT  (called from webhook)
  //    — detects whether it's deposit or remaining from transactionId
  //    — after deposit → triggers job post + supervisor assignment
  //    — after remaining → marks invoice fully PAID
  // ════════════════════════════════════════════════════════════
  async processSuccessfulPayment(
    paymentId: number | string,
    bankTransactionId: string,
    method: PaymentMethodEnum,
  ) {
    const payment = await this.paymentRepo.findOne({
      where: { id: Number(paymentId) },
      relations: ['task', 'task.company'],
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const now = new Date();

    // ── Detect which step just completed ─────────────────────
    // The webhook carries the Paymob order which maps to our merchantOrderId.
    // We stored deposit in transactionId and remaining in remainingTransactionId.
    const isDeposit = payment.depositStatus !== PaymentStatusEnum.PAID;

    if (isDeposit) {
      // ── First payment (deposit 50%) ───────────────────────
      payment.depositStatus          = PaymentStatusEnum.PAID;
      payment.depositBankTransactionId = bankTransactionId;
      payment.depositMethod          = method;
      payment.depositPaidAt          = now;
      payment.status                 = PaymentStatusEnum.PARTIALLY_PAID;

      // legacy fields
      payment.bankTransactionId = bankTransactionId;
      payment.paymentMethod     = method;

      await this.paymentRepo.save(payment);

      // ────────────────────────────────────────────────────────
      // CRITICAL: NOW publish job post + assign supervisors
      // This is the gate — job post only goes live after deposit
      // ────────────────────────────────────────────────────────
      if (this.taskService) {
        await this.taskService.publishJobPostAndAssignSupervisors(payment.task);
      }

      return {
        status:  'deposit_received',
        message: 'Deposit paid successfully. Job post is now live.',
        nextStep: 'Pay remaining 50% after task completes',
        depositAmount:   payment.depositAmount,
        remainingAmount: payment.remainingAmount,
      };

    } else {

      if (payment.remainingStatus === PaymentStatusEnum.PAID) {
      return { status: 'already_paid', message: 'Remaining amount was already processed.' };
  }
      // ── Second payment (remaining 50%) ───────────────────
      payment.remainingStatus          = PaymentStatusEnum.PAID;
      payment.remainingBankTransactionId = bankTransactionId;
      payment.remainingMethod          = method;
      payment.remainingPaidAt          = now;
      payment.status                   = PaymentStatusEnum.PAID;

      // legacy fields
      payment.paidAt = now;

      await this.paymentRepo.save(payment);

      return {
        status:  'fully_paid',
        message: 'All payments complete. Workers and supervisors will be paid out.',
        totalPaid: payment.totalAmount,
      };
    }
  }

  // ════════════════════════════════════════════════════════════
  // 4. VALIDATE HMAC  (unchanged)
  // ════════════════════════════════════════════════════════════
  validatePaymobHmac(hmacFromUrl: string, payload: any): boolean {
    const secureHash = process.env.PAYMOB_HMAC_SECRET || '';
    const keys = [
      'amount_cents','created_at','currency','error_occured',
      'has_parent_transaction','id','integration_id','is_3d_secure',
      'is_auth','is_capture','is_refunded','is_standalone_payment',
      'is_voided','order.id','owner','pending',
      'source_data.pan','source_data.sub_type','source_data.type','success',
    ];
    const dataString = keys.map(k => this.getNestedValue(payload, k)).join('');
    const hashed = crypto.createHmac('sha512', secureHash).update(dataString).digest('hex');
    return hashed === hmacFromUrl;
  }

  // ════════════════════════════════════════════════════════════
  // 5. GET INVOICE DETAILS  (updated to show split)
  // ════════════════════════════════════════════════════════════
  async getCompanyInvoiceDetails(paymentId: number, companyId: number) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, company: { id: companyId } },
      relations: ['task'],
    });
    if (!payment) throw new NotFoundException('Invoice not found or unauthorized');

    return {
      invoice: {
        id:              payment.id,
        status:          payment.status,
        totalAmount:     payment.totalAmount,
        transactionId:   payment.transactionId,
        createdAt:       payment.createdAt,
      },
      paymentPlan: {
        deposit: {
          amount:   payment.depositAmount,
          status:   payment.depositStatus,
          paidAt:   payment.depositPaidAt,
          method:   payment.depositMethod,
          note:     'Pay this first to publish the job post',
        },
        remaining: {
          amount:   payment.remainingAmount,
          status:   payment.remainingStatus,
          paidAt:   payment.remainingPaidAt,
          method:   payment.remainingMethod,
          note:     'Pay this after the task is completed',
        },
      },
      costBreakdown: {
        workersCost:     payment.workersCost,
        supervisingFees: payment.supervisingFees,
        platformFee:     payment.platformFee,
        totalAmount:     payment.totalAmount,
      },
      taskDetails: {
        id:        payment.task.id,
        eventName: payment.task.eventName,
        startDate: payment.task.startDate,
        endDate:   payment.task.endDate,
        location:  payment.task.location,
      },
    };
  }

  async getCompanyInvoices(companyId: number): Promise<Payment[]> {
    return await this.paymentRepo.find({
      where: { company: { id: companyId } },
      relations: ['task'],
      order: { createdAt: 'DESC' },
    });
  }

  // ════════════════════════════════════════════════════════════
  // PRIVATE — Paymob helpers
  // ════════════════════════════════════════════════════════════
  private async _paymobAuth(): Promise<{ authToken: string }> {
    const res = await this.httpService.axiosRef.post(
      'https://accept.paymob.com/api/auth/tokens',
      { api_key: process.env.PAYMOB_API_KEY },
    );
    return { authToken: res.data.token };
  }

  private async _paymobCreateOrder(
    authToken: string,
    amountCents: number,
    merchantOrderId: string,
  ): Promise<{ paymobOrderId: string }> {
    const res = await this.httpService.axiosRef.post(
      'https://accept.paymob.com/api/ecommerce/orders',
      {
        auth_token:        authToken,
        delivery_needed:   false,
        amount_cents:      amountCents,
        currency:          'EGP',
        merchant_order_id: merchantOrderId,
        items:             [],
      },
    );
    return { paymobOrderId: String(res.data.id) };
  }

  private async _paymobPaymentKey(
    authToken: string,
    paymobOrderId: string,
    amountCents: number,
    method: PaymentMethodEnum,
    payment: Payment,
  ): Promise<{ paymentToken: string }> {
    const integrationId = method === PaymentMethodEnum.CARD
      ? Number(process.env.PAYMOB_INTEGRATION_CREDITCARD_ID)
      : Number(process.env.PAYMOB_INTEGRATION_WALLET_ID);

    const billingData = method === PaymentMethodEnum.CARD
      ? {
          first_name:      payment.company?.name?.split(' ')[0] || 'Client',
          last_name:       payment.company?.name?.split(' ').slice(1).join(' ') || 'User',
          email:           payment.company?.email || 'client@example.com',
          phone_number:    payment.company?.phone || '01000000000',
          apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA',
          shipping_method: 'NA', postal_code: 'NA',
          city: 'Cairo', country: 'EG', state: 'NA',
        }
      : {
          phone_number:    payment.company?.phone || '01000000000',
          first_name: 'NA', last_name: 'NA', email: 'NA',
          apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA',
          shipping_method: 'NA', postal_code: 'NA',
          city: 'NA', country: 'EG', state: 'NA',
        };

    const res = await this.httpService.axiosRef.post(
      'https://accept.paymob.com/api/acceptance/payment_keys',
      {
        auth_token:     authToken,
        amount_cents:   amountCents,
        expiration:     3600,
        order_id:       paymobOrderId,
        currency:       'EGP',
        integration_id: integrationId,
        lock_order_when_paid: true,
        billing_data:   billingData,
      },
    );
    return { paymentToken: res.data.token };
  }

  private getNestedValue(obj: any, path: string): string {
    return path.split('.').reduce((cur, prop) => cur?.[prop] ?? '', obj);
  }
}