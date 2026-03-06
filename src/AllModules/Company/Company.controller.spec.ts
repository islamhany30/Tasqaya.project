import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from './Company.controller';
import { CompanyService } from './Company.service';
import { TaskService } from '../Task/Task.service';
import { PaymentService } from '../Payment/Payment.service';
import { BadRequestException } from '@nestjs/common';
import { TaskStatusEnum } from '../../Enums/task-status.enum';
import { PaymentMethodEnum } from '../../Enums/payment-method.enum';
import { JwtAuthGuard } from '../../Auth/auth.guards';
import { JwtRegisterAuthGuard } from '../../Auth/auth.guards.register';

// ── Mock Guards ───────────────────────────────────────────────────────────────
// بدل ما NestJS يحاول يبني الـ guards الحقيقية ويطلب JwtService + DataSource
// بنديهم mock بسيط يعدّي على طول
const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('CompanyController - Full Coverage', () => {
  let controller: CompanyController;
  let companyService: any;
  let taskService: any;
  let paymentService: any;

  const mockCompanyService = () => ({
    register: jest.fn(),
    verifyCompany: jest.fn(),
    resendVerification: jest.fn(),
    login: jest.fn(),
    forgotPassword: jest.fn(),
    verifyResetCode: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
    updateProfileImage: jest.fn(),
    getCompanyById: jest.fn(),
    editProfile: jest.fn(),
    deactivateAccount: jest.fn(),
    deleteAccount: jest.fn(),
  });

  const mockTaskService = () => ({
    createTaskByCompany: jest.fn(),
    approveTaskByCompany: jest.fn(),
    getCompanyApprovedTasks: jest.fn(),
    getCompanyTasksByStatus: jest.fn(),
    getTaskDetailsForCompany: jest.fn(),
    updateTask: jest.fn(),
    deleteTaskByCompany: jest.fn(),
    submitTaskFeedback: jest.fn(),
    getCompanyFeedbacks: jest.fn(),
    getPendingCompanyTasks: jest.fn(),
    getCompanyDashboardStats: jest.fn(),
    getConfirmedWorkers: jest.fn(),
  });

  const mockPaymentService = () => ({
    getCompanyInvoices: jest.fn(),
    getCompanyInvoiceDetails: jest.fn(),
    initiatePayment: jest.fn(),
  });

  // req mock helper
  const mockReq = (sub = 1) => ({ user: { sub } });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [
        { provide: CompanyService, useValue: mockCompanyService() },
        { provide: TaskService, useValue: mockTaskService() },
        { provide: PaymentService, useValue: mockPaymentService() },
      ],
    })
      // ← هنا الحل: بنستبدل الـ guards الحقيقية بـ mock بدون أي dependencies
      .overrideGuard(JwtAuthGuard).useValue(mockGuard)
      .overrideGuard(JwtRegisterAuthGuard).useValue(mockGuard)
      .compile();

    controller = module.get<CompanyController>(CompanyController);
    companyService = module.get<CompanyService>(CompanyService);
    taskService = module.get<TaskService>(TaskService);
    paymentService = module.get<PaymentService>(PaymentService);
  });

  // =========================================================================
  // Auth & Profile
  // =========================================================================
  describe('registerCompany', () => {
    it('should call companyService.register with dto', async () => {
      const dto: any = { email: 'co@test.com', password: '123456' };
      companyService.register.mockResolvedValue({ message: 'Registered' });

      const result = await controller.registerCompany(dto);

      expect(companyService.register).toHaveBeenCalledWith(dto);
      expect(result.message).toBe('Registered');
    });
  });

  describe('verify', () => {
    it('should call companyService.verifyCompany with code and userId', async () => {
      companyService.verifyCompany.mockResolvedValue({ message: 'Verified' });
      const dto: any = { VERIFICATIONCODE: '123456' };

      const result = await controller.verify(dto, mockReq(5));

      expect(companyService.verifyCompany).toHaveBeenCalledWith('123456', 5);
      expect(result.message).toBe('Verified');
    });
  });

  describe('resendVerification', () => {
    it('should call companyService.resendVerification with userId', async () => {
      companyService.resendVerification.mockResolvedValue({ message: 'Sent' });

      const result = await controller.resendVerification(mockReq(3));

      expect(companyService.resendVerification).toHaveBeenCalledWith(3);
      expect(result.message).toBe('Sent');
    });
  });

  describe('login', () => {
    it('should call companyService.login with dto', async () => {
      const dto: any = { email: 'co@test.com', password: '123456' };
      companyService.login.mockResolvedValue({ token: 'jwt_token' });

      const result = await controller.login(dto);

      expect(companyService.login).toHaveBeenCalledWith(dto);
      expect(result.token).toBe('jwt_token');
    });
  });

  describe('forgotPassword', () => {
    it('should call companyService.forgotPassword with dto', async () => {
      const dto: any = { email: 'co@test.com' };
      companyService.forgotPassword.mockResolvedValue({ message: 'Code sent' });

      const result = await controller.forgotPassword(dto);

      expect(companyService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result.message).toBe('Code sent');
    });
  });

  describe('verifyResetCode', () => {
    it('should call companyService.verifyResetCode with dto', async () => {
      const dto: any = { code: '999' };
      companyService.verifyResetCode.mockResolvedValue({ message: 'Code verified' });

      const result = await controller.verifyResetCode(dto);

      expect(companyService.verifyResetCode).toHaveBeenCalledWith(dto);
      expect(result.message).toBe('Code verified');
    });
  });

  describe('resetPassword', () => {
    it('should call companyService.resetPassword with dto', async () => {
      const dto: any = { newPassword: 'newPass123' };
      companyService.resetPassword.mockResolvedValue({ message: 'Password reset' });

      const result = await controller.resetPassword(dto);

      expect(companyService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result.message).toBe('Password reset');
    });
  });

  describe('changePassword', () => {
    it('should call companyService.changePassword with userId and dto', async () => {
      const dto: any = { oldPassword: 'old', newPassword: 'new' };
      companyService.changePassword.mockResolvedValue({ message: 'Changed' });

      await controller.changePassword(dto, mockReq(7));

      expect(companyService.changePassword).toHaveBeenCalledWith(7, dto);
    });
  });

  describe('uploadProfileImage', () => {
    it('should call companyService.updateProfileImage with userId and image path', async () => {
      const image: any = { path: '/uploads/company-img.jpg' };
      companyService.updateProfileImage.mockResolvedValue({ message: 'Updated' });

      const result = await controller.uploadProfileImage(image, mockReq(2));

      expect(companyService.updateProfileImage).toHaveBeenCalledWith(2, '/uploads/company-img.jpg');
      expect(result.message).toBe('Updated');
    });

    it('should throw BadRequestException if no image provided', async () => {
      await expect(
        controller.uploadProfileImage(undefined as any, mockReq(2)),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getProfile', () => {
    it('should call companyService.getCompanyById with userId', async () => {
      companyService.getCompanyById.mockResolvedValue({ id: 1, name: 'Test Co' });

      const result = await controller.getProfile(mockReq(1));

      expect(companyService.getCompanyById).toHaveBeenCalledWith(1);
      expect(result.name).toBe('Test Co');
    });
  });

  describe('editProfile', () => {
    it('should call companyService.editProfile with userId and dto', async () => {
      const dto: any = { name: 'New Name' };
      companyService.editProfile.mockResolvedValue({ message: 'Updated' });

      await controller.editProfile(mockReq(4), dto);

      expect(companyService.editProfile).toHaveBeenCalledWith(4, dto);
    });
  });

  describe('deactivateAccount', () => {
    it('should call companyService.deactivateAccount with userId and dto', async () => {
      const dto: any = { password: 'pass123' };
      companyService.deactivateAccount.mockResolvedValue({ message: 'Deactivated' });

      await controller.deactivateAccount(mockReq(6), dto);

      expect(companyService.deactivateAccount).toHaveBeenCalledWith(6, dto);
    });
  });

  describe('deleteAccount', () => {
    it('should call companyService.deleteAccount with userId and dto', async () => {
      const dto: any = { password: 'pass123' };
      companyService.deleteAccount.mockResolvedValue({ message: 'Deleted' });

      await controller.deleteAccount(mockReq(8), dto);

      expect(companyService.deleteAccount).toHaveBeenCalledWith(8, dto);
    });
  });

  // =========================================================================
  // Tasks
  // =========================================================================
  describe('create (createTask)', () => {
    it('should call taskService.createTaskByCompany with dto and companyId', async () => {
      const dto: any = { eventName: 'Concert', requiredWorkers: 10 };
      taskService.createTaskByCompany.mockResolvedValue({ id: 1, ...dto });

      const result = await controller.create(dto, mockReq(9));

      expect(taskService.createTaskByCompany).toHaveBeenCalledWith(dto, 9);
      expect(result.eventName).toBe('Concert');
    });
  });

  describe('approve', () => {
    it('should call taskService.approveTaskByCompany with taskId and companyId', async () => {
      taskService.approveTaskByCompany.mockResolvedValue({ message: 'Approved' });

      const result = await controller.approve(5, mockReq(1));

      expect(taskService.approveTaskByCompany).toHaveBeenCalledWith(5, 1);
      expect(result.message).toBe('Approved');
    });
  });

  describe('getMyTasks', () => {
    it('should return tasks with count', async () => {
      taskService.getCompanyApprovedTasks.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await controller.getMyTasks(mockReq(1));

      expect(result.count).toBe(2);
      expect(result.tasks).toHaveLength(2);
    });
  });

  describe('getPending', () => {
    it('should call getCompanyTasksByStatus with PENDING', async () => {
      taskService.getCompanyTasksByStatus.mockResolvedValue([{ id: 1 }]);

      await controller.getPending(mockReq(1));

      expect(taskService.getCompanyTasksByStatus).toHaveBeenCalledWith(
        1,
        TaskStatusEnum.PENDING,
      );
    });
  });

  describe('getInProgress', () => {
    it('should call getCompanyTasksByStatus with IN_PROGRESS', async () => {
      taskService.getCompanyTasksByStatus.mockResolvedValue([]);

      await controller.getInProgress(mockReq(1));

      expect(taskService.getCompanyTasksByStatus).toHaveBeenCalledWith(
        1,
        TaskStatusEnum.IN_PROGRESS,
      );
    });
  });

  describe('getCompleted', () => {
    it('should call getCompanyTasksByStatus with COMPLETED', async () => {
      taskService.getCompanyTasksByStatus.mockResolvedValue([]);

      await controller.getCompleted(mockReq(1));

      expect(taskService.getCompanyTasksByStatus).toHaveBeenCalledWith(
        1,
        TaskStatusEnum.COMPLETED,
      );
    });
  });

  describe('getTaskDetails', () => {
    it('should call taskService.getTaskDetailsForCompany with taskId and companyId', async () => {
      taskService.getTaskDetailsForCompany.mockResolvedValue({ id: 10, eventName: 'Event' });

      const result = await controller.getTaskDetails(10, mockReq(1));

      expect(taskService.getTaskDetailsForCompany).toHaveBeenCalledWith(10, 1);
      expect(result.eventName).toBe('Event');
    });
  });

  describe('update', () => {
    it('should call taskService.updateTask with taskId, companyId and dto', async () => {
      const dto: any = { requiredWorkers: 20 };
      taskService.updateTask.mockResolvedValue({ message: 'Updated', task: {} });

      const result = await controller.update(3, dto, mockReq(1));

      expect(taskService.updateTask).toHaveBeenCalledWith(3, 1, dto);
      expect(result.message).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('should call taskService.deleteTaskByCompany with taskId and companyId', async () => {
      taskService.deleteTaskByCompany.mockResolvedValue({ message: 'Deleted' });

      const result = await controller.delete(7, mockReq(1));

      expect(taskService.deleteTaskByCompany).toHaveBeenCalledWith(7, 1);
      expect(result.message).toBe('Deleted');
    });
  });

  // =========================================================================
  // Payments
  // =========================================================================
  describe('getMyInvoices', () => {
    it('should call paymentService.getCompanyInvoices with companyId', async () => {
      paymentService.getCompanyInvoices.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await controller.getMyInvoices(mockReq(1));

      expect(paymentService.getCompanyInvoices).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(2);
    });
  });

  describe('getInvoiceDetails', () => {
    it('should call paymentService.getCompanyInvoiceDetails with paymentId and companyId', async () => {
      paymentService.getCompanyInvoiceDetails.mockResolvedValue({ invoice: { id: 5 } });

      const result = await controller.getInvoiceDetails(5, mockReq(1));

      expect(paymentService.getCompanyInvoiceDetails).toHaveBeenCalledWith(5, 1);
      expect(result.invoice.id).toBe(5);
    });
  });

  describe('payInvoice', () => {
    it('should call paymentService.initiatePayment with CARD method', async () => {
      const body: any = { method: PaymentMethodEnum.CARD };
      paymentService.initiatePayment.mockResolvedValue({
        paymentMethod: PaymentMethodEnum.CARD,
        paymentUrl: 'https://paymob.com/pay',
        paymentToken: 'TOKEN_123',
      });

      const result = await controller.payInvoice(10, body, mockReq(1));

      expect(paymentService.initiatePayment).toHaveBeenCalledWith(10, 1, PaymentMethodEnum.CARD);
      expect(result.paymentUrl).toContain('paymob');
    });

    it('should handle WALLET payment method', async () => {
      const body: any = { method: PaymentMethodEnum.WALLET };
      paymentService.initiatePayment.mockResolvedValue({
        paymentMethod: PaymentMethodEnum.WALLET,
        paymentToken: 'TOKEN_456',
        suggestedPhone: '01000000000',
      });

      const result = await controller.payInvoice(11, body, mockReq(2));

      expect(paymentService.initiatePayment).toHaveBeenCalledWith(11, 2, PaymentMethodEnum.WALLET);
      expect(result.suggestedPhone).toBe('01000000000');
    });
  });

  // =========================================================================
  // Feedback
  // =========================================================================
  describe('submitFeedback', () => {
    it('should call taskService.submitTaskFeedback with taskId, dto and companyId', async () => {
      const dto: any = { Rating: 5, Comment: 'Excellent' };
      taskService.submitTaskFeedback.mockResolvedValue({ message: 'Feedback submitted' });

      const result = await controller.submitFeedback(3, dto, mockReq(1));

      expect(taskService.submitTaskFeedback).toHaveBeenCalledWith(3, dto, 1);
      expect(result.message).toBe('Feedback submitted');
    });
  });

  describe('getMyFeedbacks', () => {
    it('should call taskService.getCompanyFeedbacks with companyId', async () => {
      taskService.getCompanyFeedbacks.mockResolvedValue({
        feedbacks: [],
        total: 0,
        averageRating: 0,
      });

      const result = await controller.getMyFeedbacks(mockReq(1));

      expect(taskService.getCompanyFeedbacks).toHaveBeenCalledWith(1);
      expect(result.total).toBe(0);
    });
  });

  // =========================================================================
  // Dashboard
  // =========================================================================
  describe('getDashboardStats', () => {
    it('should call taskService.getCompanyDashboardStats with companyId', async () => {
      taskService.getCompanyDashboardStats.mockResolvedValue({
        CompletedTasks: 5,
        ActiveTasks: 2,
        TotalSpent: 10000,
      });

      const result = await controller.getDashboardStats(mockReq(1));

      expect(taskService.getCompanyDashboardStats).toHaveBeenCalledWith(1);
      expect(result.CompletedTasks).toBe(5);
    });
  });

  // =========================================================================
  // Confirmed Workers
  // =========================================================================
  describe('getConfirmedWorkersForTask', () => {
    it('should call taskService.getConfirmedWorkers with taskId and companyId', async () => {
      taskService.getConfirmedWorkers.mockResolvedValue([
        { id: 1, fullName: 'John', profilePicture: 'img.png' },
      ]);

      const result = await controller.getConfirmedWorkersForTask(15, mockReq(1));

      expect(taskService.getConfirmedWorkers).toHaveBeenCalledWith(15, 1);
      expect(result[0].fullName).toBe('John');
    });
  });
});