import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Payment } from '../../entities/Payment';
import { Task } from '../../entities/Task';
import { PaymentStatusEnum } from '../../Enums/payment-status.enum';
import { PaymentMethodEnum } from '../../Enums/payment-method.enum';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  systemconfig: any;
  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    private readonly httpService: HttpService,
  ) {}

  validatePaymobHmac(hmacFromUrl: string, payload: any): boolean {
    const secureHash = process.env.PAYMOB_HMAC_SECRET || 'YOUR_PAYMOB_HMAC_SECRET';

    // fields بالترتيب الرسمي حسب Paymob docs
    const keys = [
      'amount_cents',
      'created_at',
      'currency',
      'error_occured',
      'has_parent_transaction',
      'id',
      'integration_id',
      'is_3d_secure',
      'is_auth',
      'is_capture',
      'is_refunded',
      'is_standalone_payment',
      'is_voided',
      'order.id',
      'owner',
      'pending',
      'source_data.pan',
      'source_data.sub_type',
      'source_data.type',
      'success',
    ];

    const dataString = keys
      .map((k) => {
        const parts = k.split('.');
        let value: any = payload;
        for (const part of parts) value = value?.[part];
        return String(value ?? '');
      })
      .join('');

    const hashed = crypto.createHmac('sha512', secureHash).update(dataString).digest('hex');
    return hashed === hmacFromUrl;
  }

  async createInitialInvoice(task: Task, companyId: number) {
    const merchantOrderId = `ORDER_${task.id}_${Date.now()}`;

    const invoice = this.paymentRepo.create({
      task: { id: task.id },
      company: { id: companyId },
      workersCost: task.baseWorkersCost,
      platformFee: task.platformFee,
      supervisingFees: task.supervisingFees,
      totalAmount: task.totalCost,
      status: PaymentStatusEnum.PENDING,
      transactionId: merchantOrderId,
      paymentMethod: 'PENDING',
    });

    return await this.paymentRepo.save(invoice);
  }

  async processSuccessfulPayment(paymentId: number | string, bankTransactionId: string, method: PaymentMethodEnum) {
    const payment = await this.paymentRepo.findOne({ where: { id: Number(paymentId) } });
    if (!payment) throw new NotFoundException('Payment not found');

    payment.status = PaymentStatusEnum.PAID;
    payment.paymentMethod = method;
    payment.bankTransactionId = bankTransactionId;
    payment.paidAt = new Date();

    await this.paymentRepo.save(payment);
    return { status: 'success', paymentId, method, bankTransactionId };
  }

  async getCompanyInvoices(companyId: number): Promise<Payment[]> {
    return await this.paymentRepo.find({
      where: { company: { id: companyId } },
      relations: ['taskId'],
      select: {
        id: true,
        totalAmount: true,
        status: true,
        paidAt: true,
        task: {
          eventName: true,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getCompanyInvoiceDetails(paymentId: number, companyId: number) {
    const payment = await this.paymentRepo.findOne({
      where: {
        id: paymentId,
        company: { id: companyId },
      },
      relations: ['taskId'],
    });

    if (!payment) {
      throw new NotFoundException('Invoice not found or unauthorized');
    }

    return {
      invoice: {
        id: payment.id,
        status: payment.status,
        totalAmount: payment.totalAmount,
        transactionId: payment.transactionId,
        paymentMethod: payment.paymentMethod,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      },
      costBreakdown: {
        workersCost: payment.workersCost,
        supervisingFees: payment.supervisingFees,
        platformFee: payment.platformFee,
        totalAmount: payment.totalAmount,
      },
      taskDetails: {
        id: payment.task.id,
        eventName: payment.task.eventName,
        startDate: payment.task.startDate,
        endDate: payment.task.endDate,
        location: payment.task.location,
      },
    };
  }

  async applyLateFees() {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const lateInvoices = await this.paymentRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.taskId', 't')
      .where('p.status = :status', { status: PaymentStatusEnum.PENDING })
      .andWhere('t.endDate < :deadline', { deadline: fiveDaysAgo })
      .getMany();

    for (const inv of lateInvoices) {
      inv.totalAmount = Number(inv.totalAmount) + 500;
      await this.paymentRepo.save(inv);
    }
  }

  async initiatePayment(
    paymentId: number,
    companyId: number,
    method: PaymentMethodEnum,
  ): Promise<{
    paymentMethod: PaymentMethodEnum;
    paymentUrl?: string;
    paymentToken: string;
    suggestedPhone?: string;
  }> {
    // 1️⃣ جلب بيانات الفاتورة
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, company: { id: companyId } },
      relations: ['taskId', 'company'],
    });

    if (!payment) {
      throw new NotFoundException('Invoice not found or unauthorized');
    }

    if (payment.status === PaymentStatusEnum.PAID) {
      throw new BadRequestException('This invoice is already paid');
    }

    try {
      // 2️⃣ Authenticate مع Paymob للحصول على authToken
      const authResponse = await this.httpService.axiosRef.post('https://accept.paymob.com/api/auth/tokens', {
        api_key: process.env.PAYMOB_API_KEY,
      });
      const authToken: string = authResponse.data.token;

      // 3️⃣ تحويل المبلغ للقروش (Cents)
      const amountCents = Math.round(Number(payment.totalAmount) * 100);

      // merchant_order_id فريد لتجنب أي مشاكل duplicate
      const merchantOrderId = `payment-${payment.id}-${Date.now()}`;

      // 4️⃣ إنشاء Order في Paymob
      const orderResponse = await this.httpService.axiosRef.post('https://accept.paymob.com/api/ecommerce/orders', {
        auth_token: authToken,
        delivery_needed: false,
        amount_cents: amountCents,
        currency: 'EGP',
        merchant_order_id: merchantOrderId,
        items: [],
      });
      const paymobOrderId: string = String(orderResponse.data.id);

      // 5️⃣ اختيار integration_id حسب الطريقة
      const integrationId =
        method === PaymentMethodEnum.CARD
          ? Number(process.env.PAYMOB_INTEGRATION_CREDITCARD_ID)
          : Number(process.env.PAYMOB_INTEGRATION_WALLET_ID);

      // 6️⃣ إنشاء Payment Key (التوكن الرئيسي)
      const paymentKeyPayload: any = {
        auth_token: authToken,
        amount_cents: amountCents,
        expiration: 3600, // 1 ساعة صلاحية
        order_id: paymobOrderId,
        currency: 'EGP',
        integration_id: integrationId,
        lock_order_when_paid: true,
      };

      // billing_data مطلوب للـ CARD (iframe)، واختياري/مبسط للـ WALLET
      if (method === PaymentMethodEnum.CARD) {
        paymentKeyPayload.billing_data = {
          first_name: payment.company?.name?.split(' ')[0] || 'Client',
          last_name: payment.company?.name?.split(' ').slice(1).join(' ') || 'User',
          email: payment.company?.email || 'client@example.com',
          phone_number: payment.company?.phone || '01000000000',
          apartment: 'NA',
          floor: 'NA',
          street: 'NA',
          building: 'NA',
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'Cairo',
          country: 'EG',
          state: 'NA',
        };
      } else if (method === PaymentMethodEnum.WALLET) {
        paymentKeyPayload.billing_data = {
          phone_number: payment.company?.phone || '01000000000',
          // الباقي NA عشان Paymob يقبله
          first_name: 'NA',
          last_name: 'NA',
          email: 'NA',
          apartment: 'NA',
          floor: 'NA',
          street: 'NA',
          building: 'NA',
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'NA',
          country: 'EG',
          state: 'NA',
        };
      }

      const paymentKeyResponse = await this.httpService.axiosRef.post(
        'https://accept.paymob.com/api/acceptance/payment_keys',
        paymentKeyPayload,
      );

      const paymentToken: string = paymentKeyResponse.data.token;

      // 7️⃣ الـ Response حسب الطريقة
      if (method === PaymentMethodEnum.CARD) {
        const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;

        return {
          paymentMethod: PaymentMethodEnum.CARD,
          paymentUrl,
          paymentToken, // اختياري - لو الـ frontend عايز يحتفظ بيه
        };
      }

      // WALLET: الـ frontend لازم يعمل POST request لـ Paymob باستخدام الـ token + رقم المحفظة
      return {
        paymentMethod: PaymentMethodEnum.WALLET,
        paymentToken,
        suggestedPhone: payment.company?.phone || '01000000000', // لعرضه في الـ UI كـ default
      };
    } catch (error) {
      console.error('Paymob API Error:', error.response?.data || error.message);
      if (error.response?.data) {
        console.error('Details:', JSON.stringify(error.response.data, null, 2));
      }
      throw new BadRequestException('Failed to initiate payment with Paymob');
    }
  }
}
