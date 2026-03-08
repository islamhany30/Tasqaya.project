import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './Payment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../../entities/Payment';
import { Task } from '../../entities/Task';
import { HttpService } from '@nestjs/axios';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatusEnum } from '../../Enums/payment-status.enum';
import { PaymentMethodEnum } from '../../Enums/payment-method.enum';

describe('PaymentService - Full Coverage', () => {
  let service: PaymentService;
  let paymentRepo: any;
  let taskRepo: any;
  let httpService: any;

  const mockRepoFactory = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((entity) =>
      Promise.resolve({ id: Date.now(), ...entity }),
    ),
    createQueryBuilder: jest.fn(),
  });

  // qb mock factory
  const buildQbMock = (getMany: any[] = []) => {
    const qb: any = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(getMany),
    };
    return qb;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Task), useValue: mockRepoFactory() },
        {
          provide: HttpService,
          useValue: { axiosRef: { post: jest.fn() } },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    taskRepo = module.get(getRepositoryToken(Task));
    httpService = module.get<HttpService>(HttpService);
  });

  // =========================================================================
  // 1. validatePaymobHmac
  // =========================================================================
  describe('validatePaymobHmac', () => {
    it('should return true when HMAC matches', () => {
      const crypto = require('crypto');
      const secret = 'TEST_SECRET';
      process.env.PAYMOB_HMAC_SECRET = secret;

      const payload = {
        amount_cents: '1000',
        created_at: '2024-01-01',
        currency: 'EGP',
        error_occured: 'false',
        has_parent_transaction: 'false',
        id: '123',
        integration_id: '456',
        is_3d_secure: 'false',
        is_auth: 'false',
        is_capture: 'false',
        is_refunded: 'false',
        is_standalone_payment: 'true',
        is_voided: 'false',
        order: { id: '789' },
        owner: '111',
        pending: 'false',
        source_data: { pan: '1234', sub_type: 'visa', type: 'card' },
        success: 'true',
      };

      const keys = [
        'amount_cents','created_at','currency','error_occured',
        'has_parent_transaction','id','integration_id','is_3d_secure',
        'is_auth','is_capture','is_refunded','is_standalone_payment',
        'is_voided','order.id','owner','pending',
        'source_data.pan','source_data.sub_type','source_data.type','success',
      ];

      const dataString = keys
        .map((k) => {
          const parts = k.split('.');
          let value: any = payload;
          for (const part of parts) value = value?.[part];
          return String(value ?? '');
        })
        .join('');

      const correctHmac = crypto
        .createHmac('sha512', secret)
        .update(dataString)
        .digest('hex');

      const result = service.validatePaymobHmac(correctHmac, payload);
      expect(result).toBe(true);
    });

    it('should return false when HMAC does not match', () => {
      const result = service.validatePaymobHmac('wrong_hmac', {});
      expect(result).toBe(false);
    });

    it('should handle missing nested fields gracefully', () => {
      // payload ناقص — المفروض يرجع false مش يطير exception
      const result = service.validatePaymobHmac('any_hmac', {});
      expect(typeof result).toBe('boolean');
    });
  });

  // =========================================================================
  // 2. createInitialInvoice
  // =========================================================================
  describe('createInitialInvoice', () => {
    it('should create and save a PENDING invoice correctly', async () => {
      const task: any = {
        id: 1,
        baseWorkersCost: 5000,
        platformFee: 500,
        supervisingFees: 400,
        totalCost: 5900,
      };

      const result = await service.createInitialInvoice(task, 42);

      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          task: { id: 1 },
          company: { id: 42 },
          workersCost: 5000,
          platformFee: 500,
          supervisingFees: 400,
          totalAmount: 5900,
          status: PaymentStatusEnum.PENDING,
          paymentMethod: 'PENDING',
        }),
      );
      expect(paymentRepo.save).toHaveBeenCalled();
    });

    it('should generate a transactionId that includes the task id', async () => {
      const task: any = { id: 10, baseWorkersCost: 0, platformFee: 0, supervisingFees: 0, totalCost: 0 };

      await service.createInitialInvoice(task, 1);

      const transactionId = (paymentRepo.create.mock.calls[0][0] as any).transactionId;
      // format المتوقع: ORDER_{taskId}_{timestamp}
      expect(transactionId).toContain('ORDER_10_');
      expect(transactionId).toMatch(/^ORDER_10_\d+$/);
    });
  });

  // =========================================================================
  // 3. processSuccessfulPayment
  // =========================================================================
  describe('processSuccessfulPayment', () => {
    it('should update payment to PAID status', async () => {
      const payment: any = {
        id: 1,
        status: PaymentStatusEnum.PENDING,
        paymentMethod: 'PENDING',
      };
      paymentRepo.findOne.mockResolvedValue(payment);

      const result = await service.processSuccessfulPayment(
        1,
        'BANK_TX_001',
        PaymentMethodEnum.CARD,
      );

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatusEnum.PAID,
          paymentMethod: PaymentMethodEnum.CARD,
          bankTransactionId: 'BANK_TX_001',
        }),
      );
      expect(result.status).toBe('success');
      expect(result.bankTransactionId).toBe('BANK_TX_001');
    });

    it('should accept paymentId as string', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 5 });

      await service.processSuccessfulPayment('5', 'TX_STR', PaymentMethodEnum.WALLET);

      expect(paymentRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5 } }),
      );
    });

    it('should throw NotFoundException if payment not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.processSuccessfulPayment(999, 'TX', PaymentMethodEnum.CARD),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set paidAt to current date', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 1 });
      const before = new Date();

      await service.processSuccessfulPayment(1, 'TX', PaymentMethodEnum.CARD);

      const savedArg = paymentRepo.save.mock.calls[0][0];
      expect(savedArg.paidAt).toBeInstanceOf(Date);
      expect(savedArg.paidAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  // =========================================================================
  // 4. getCompanyInvoices
  // =========================================================================
  describe('getCompanyInvoices', () => {
    it('should return all invoices for a company', async () => {
      paymentRepo.find.mockResolvedValue([
        { id: 1, totalAmount: 5000, status: PaymentStatusEnum.PAID },
        { id: 2, totalAmount: 3000, status: PaymentStatusEnum.PENDING },
      ]);

      const result = await service.getCompanyInvoices(10);

      expect(paymentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { company: { id: 10 } },
          order: { createdAt: 'DESC' },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no invoices', async () => {
      paymentRepo.find.mockResolvedValue([]);
      const result = await service.getCompanyInvoices(99);
      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // 5. getCompanyInvoiceDetails
  // =========================================================================
  describe('getCompanyInvoiceDetails', () => {
    it('should return full invoice details correctly', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        status: PaymentStatusEnum.PAID,
        totalAmount: 5900,
        transactionId: 'TX_123',
        paymentMethod: PaymentMethodEnum.CARD,
        paidAt: new Date('2024-01-15'),
        createdAt: new Date('2024-01-10'),
        workersCost: 5000,
        supervisingFees: 400,
        platformFee: 500,
        task: {
          id: 10,
          eventName: 'Concert',
          startDate: new Date(),
          endDate: new Date(),
          location: 'Cairo',
        },
      });

      const result = await service.getCompanyInvoiceDetails(1, 42);

      expect(result.invoice.id).toBe(1);
      expect(result.invoice.totalAmount).toBe(5900);
      expect(result.costBreakdown.workersCost).toBe(5000);
      expect(result.taskDetails.eventName).toBe('Concert');
    });

    it('should throw NotFoundException if invoice not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(service.getCompanyInvoiceDetails(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // 6. applyLateFees
  // =========================================================================
  describe('applyLateFees', () => {
    it('should add 500 to each late invoice totalAmount', async () => {
      const lateInvoices = [
        { id: 1, totalAmount: 5000 },
        { id: 2, totalAmount: 3000 },
      ];

      const qbMock = buildQbMock(lateInvoices);
      paymentRepo.createQueryBuilder = jest.fn().mockReturnValue(qbMock);

      await service.applyLateFees();

      expect(paymentRepo.save).toHaveBeenCalledTimes(2);
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 5500 }),
      );
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 3500 }),
      );
    });

    it('should do nothing if no late invoices found', async () => {
      const qbMock = buildQbMock([]);
      paymentRepo.createQueryBuilder = jest.fn().mockReturnValue(qbMock);

      await service.applyLateFees();

      expect(paymentRepo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 7. initiatePayment
  // =========================================================================
  describe('initiatePayment', () => {
    const mockPayment = (overrides = {}) => ({
      id: 1,
      totalAmount: 1000,
      status: PaymentStatusEnum.PENDING,
      company: { name: 'Test Co', email: 'test@co.com', phone: '01000000000' },
      ...overrides,
    });

    const mockPaymobResponses = () => {
      httpService.axiosRef.post
        .mockResolvedValueOnce({ data: { token: 'AUTH_TOKEN' } })       // auth
        .mockResolvedValueOnce({ data: { id: 'ORDER_123' } })           // order
        .mockResolvedValueOnce({ data: { token: 'PAYMENT_TOKEN' } });   // payment key
    };

    beforeEach(() => {
      process.env.PAYMOB_API_KEY = 'TEST_KEY';
      process.env.PAYMOB_INTEGRATION_CREDITCARD_ID = '111';
      process.env.PAYMOB_INTEGRATION_WALLET_ID = '222';
      process.env.PAYMOB_IFRAME_ID = '999';
    });

    it('should return paymentUrl for CARD method', async () => {
      paymentRepo.findOne.mockResolvedValue(mockPayment());
      mockPaymobResponses();

      const result = await service.initiatePayment(1, 42, PaymentMethodEnum.CARD);

      expect(result.paymentMethod).toBe(PaymentMethodEnum.CARD);
      expect(result.paymentUrl).toContain('PAYMENT_TOKEN');
      expect(result.paymentToken).toBe('PAYMENT_TOKEN');
    });

    it('should return paymentToken and suggestedPhone for WALLET method', async () => {
      paymentRepo.findOne.mockResolvedValue(mockPayment());
      mockPaymobResponses();

      const result = await service.initiatePayment(1, 42, PaymentMethodEnum.WALLET);

      expect(result.paymentMethod).toBe(PaymentMethodEnum.WALLET);
      expect(result.paymentToken).toBe('PAYMENT_TOKEN');
      expect(result.suggestedPhone).toBe('01000000000');
    });

    it('should throw NotFoundException if invoice not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.initiatePayment(999, 1, PaymentMethodEnum.CARD),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if invoice is already PAID', async () => {
      paymentRepo.findOne.mockResolvedValue(
        mockPayment({ status: PaymentStatusEnum.PAID }),
      );
      await expect(
        service.initiatePayment(1, 42, PaymentMethodEnum.CARD),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if Paymob API fails', async () => {
      paymentRepo.findOne.mockResolvedValue(mockPayment());
      httpService.axiosRef.post.mockRejectedValue(new Error('Network Error'));

      await expect(
        service.initiatePayment(1, 42, PaymentMethodEnum.CARD),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use default phone if company has no phone', async () => {
      paymentRepo.findOne.mockResolvedValue(
        mockPayment({ company: { name: 'Co', email: 'e@e.com', phone: null } }),
      );
      mockPaymobResponses();

      const result = await service.initiatePayment(1, 42, PaymentMethodEnum.WALLET);
      expect(result.suggestedPhone).toBe('01000000000');
    });
  });
});