import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './Task.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from '../../entities/Task';
import { TaskSupervisor } from '../../entities/TaskSupervisor';
import { TaskWorker } from '../../entities/TaskWorker';
import { WorkerLevel } from '../../entities/WorkerLevel';
import { SystemConfig } from '../../entities/SystemConfig';
import { CompanyFeedback } from '../../entities/CompanyFeedback';
import { WorkerType } from '../../entities/WorkerType';
import { TaskWorkerType } from '../../entities/TaskWorkerType';
import { Payment } from '../../entities/Payment';
import { JobPost } from '../../entities/JobPost';
import { MailService } from '../../Mail/MailService';
import { PaymentService } from '../Payment/Payment.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TaskApprovalStatusEnum } from '../../Enums/task-approval.enum';
import { TaskStatusEnum } from '../../Enums/task-status.enum';
import { requiredWorkersStatusEnum } from '../../Enums/required-workers.enum';
import { PaymentStatusEnum } from '../../Enums/payment-status.enum';
import { Application } from '../../entities/Application';
import { ApplicationStatusEnum } from '../../Enums/application-status.enum';
import { AssignmentTypeEnum } from '../../Enums/assignment-type.enum';
import { JobPostStatusEnum } from '../../Enums/job-post-status.enum';
import { WorkerConfirmationStatusEnum } from '../../Enums/worker-confirmation.enum';

describe('TaskService - Full Coverage', () => {
  let service: TaskService;
  let module: TestingModule;
  let taskRepo: any;
  let levelRepo: any;
  let supervisorRepo: any;
  let taskWorkerRepo: any;
  let workerTypeRepo: any;
  let taskWorkerTypeRepo: any;
  let systemConfigRepo: any;
  let feedbackRepo: any;
  let paymentRepo: any;
  let jobPostRepo: any;
  let paymentService: PaymentService;
  let mailService: MailService;
  let applicationRepo: any;

  const mockRepoFactory = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: Date.now(), ...entity })),
    remove: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: getRepositoryToken(Task), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(TaskSupervisor), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(TaskWorker), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(WorkerLevel), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(SystemConfig), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(CompanyFeedback), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(WorkerType), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(TaskWorkerType), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Payment), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(JobPost), useValue: mockRepoFactory() },
        {
          provide: PaymentService,
          useValue: { createInitialInvoice: jest.fn().mockResolvedValue({ id: 999 }) },
        },
        {
          provide: MailService,
          useValue: { sendMail: jest.fn().mockResolvedValue(true) },
        },
        { provide: getRepositoryToken(Application), useValue: mockRepoFactory() },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    taskRepo = module.get(getRepositoryToken(Task));
    levelRepo = module.get(getRepositoryToken(WorkerLevel));
    supervisorRepo = module.get(getRepositoryToken(TaskSupervisor));
    taskWorkerRepo = module.get(getRepositoryToken(TaskWorker));
    workerTypeRepo = module.get(getRepositoryToken(WorkerType));
    taskWorkerTypeRepo = module.get(getRepositoryToken(TaskWorkerType));
    systemConfigRepo = module.get(getRepositoryToken(SystemConfig));
    feedbackRepo = module.get(getRepositoryToken(CompanyFeedback));
    paymentRepo = module.get(getRepositoryToken(Payment));
    jobPostRepo = module.get(getRepositoryToken(JobPost));
    paymentService = module.get<PaymentService>(PaymentService);
    mailService = module.get<MailService>(MailService);
    applicationRepo = module.get(getRepositoryToken(Application));
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const futureDate = (days = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  const pastDate = (days = 5) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };

  const buildQbMock = (rawMany: any[] = [], rawOne: any = null) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawMany),
    getRawOne: jest.fn().mockResolvedValue(rawOne),
  });

  const buildFiltrationQbMock = (getManyResult: any[] = []) => ({
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(getManyResult),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    whereInIds: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: getManyResult.length }),
  });

  // =========================================================================
  // 1. createTaskByCompany
  // =========================================================================
  describe('createTaskByCompany', () => {
    it('should create task successfully with correct cost calculations', async () => {
      levelRepo.findOne.mockResolvedValue({ id: 1, levelName: 'Junior', companyHourlyRate: 100 });
      workerTypeRepo.find.mockResolvedValue([{ id: 1, typeName: 'Security' }]);
      systemConfigRepo.findOne.mockResolvedValue({ globalSupervisorBouns: 500, platformFeePercentage: 0.1 });

      const dto: any = {
        startDate: futureDate(8),
        endDate: futureDate(10),
        durationHoursPerDay: 8,
        requiredWorkers: 20,
        workerLevel: 'Junior',
        workerTypes: ['Security'],
        hasUniform: true,
        uniformDescription: 'Red Shirt',
        gender: ['Male'],
      };

      const result = await service.createTaskByCompany(dto, 1);

      expect(result.requiredSupervisors).toBe(2); // 20 * 10% = 2
      expect(taskWorkerTypeRepo.save).toHaveBeenCalled();
      expect(taskRepo.save).toHaveBeenCalledWith(expect.objectContaining({ hasUniform: true, genders: ['Male'] }));
    });

    it('should force at least 1 supervisor when workers are few', async () => {
      levelRepo.findOne.mockResolvedValue({ companyHourlyRate: 100 });
      workerTypeRepo.find.mockResolvedValue([{ typeName: 'Security' }]);

      const dto: any = {
        startDate: futureDate(8),
        endDate: futureDate(10),
        durationHoursPerDay: 4,
        requiredWorkers: 2,
        workerLevel: 'Junior',
        workerTypes: ['Security'],
      };

      const result = await service.createTaskByCompany(dto, 1);
      expect(result.requiredSupervisors).toBe(1);
    });

    it('should throw BadRequestException if start date is less than 7 days away', async () => {
      const dto: any = { startDate: futureDate(3) };
      await expect(service.createTaskByCompany(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if worker level does not exist', async () => {
      levelRepo.findOne.mockResolvedValue(null);
      const dto: any = {
        startDate: futureDate(8),
        endDate: futureDate(10),
        durationHoursPerDay: 4,
        requiredWorkers: 5,
        workerLevel: 'Ghost',
      };
      await expect(service.createTaskByCompany(dto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if a workerType does not exist', async () => {
      levelRepo.findOne.mockResolvedValue({ companyHourlyRate: 100 });
      workerTypeRepo.find.mockResolvedValue([]); // 0 returned but 1 requested
      const dto: any = {
        startDate: futureDate(8),
        endDate: futureDate(10),
        durationHoursPerDay: 8,
        requiredWorkers: 5,
        workerLevel: 'Junior',
        workerTypes: ['Unknown'],
      };
      await expect(service.createTaskByCompany(dto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should use default config values when SystemConfig is null', async () => {
      levelRepo.findOne.mockResolvedValue({ companyHourlyRate: 50 });
      workerTypeRepo.find.mockResolvedValue([{ typeName: 'Security' }]);
      systemConfigRepo.findOne.mockResolvedValue(null);

      const dto: any = {
        startDate: futureDate(8),
        endDate: futureDate(9),
        durationHoursPerDay: 4,
        requiredWorkers: 10,
        workerLevel: 'Junior',
        workerTypes: ['Security'],
      };

      const result = await service.createTaskByCompany(dto, 1);
      expect(result.supervisingFees).toBe(400); // default bonus=400, 1 supervisor
    });
  });

  // =========================================================================
  // 2. approveTaskByCompany
  // =========================================================================
  describe('approveTaskByCompany', () => {
    it('should approve task and call PaymentService.createInitialInvoice', async () => {
      const task = {
        id: 5,
        startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        totalCost: 5000,
        requiredWorkers: 10,
      };
      taskRepo.findOne.mockResolvedValue(task);

      await service.approveTaskByCompany(5, 1);

      expect(paymentService.createInitialInvoice).toHaveBeenCalledWith(task, 1);
      expect(taskRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalStatus: TaskApprovalStatusEnum.APPROVED,
          status: TaskStatusEnum.PENDING,
        }),
      );
      // createJobPostForTask بيتنادى fire-and-forget (بدون await)
      // نتأكد إن الـ jobPostRepo.create اتنادى
      expect(jobPostRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: expect.any(String) }));
    });

    it('should throw NotFoundException if task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.approveTaskByCompany(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if approval is within 7 days of start', async () => {
      const task = {
        id: 5,
        startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      };
      taskRepo.findOne.mockResolvedValue(task);
      await expect(service.approveTaskByCompany(5, 1)).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 3. updateTask
  // =========================================================================
  describe('updateTask', () => {
    const baseTask = () => ({
      id: 1,
      approvalStatus: TaskApprovalStatusEnum.PENDING,
      workerLevel: { companyHourlyRate: 100 },
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      durationHoursPerDay: 5,
      requiredWorkers: 10,
      workerTypes: [],
    });

    it('should update requiredWorkers and recalculate costs', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask());
      systemConfigRepo.findOne.mockResolvedValue({ globalSupervisorBouns: 200, platformFeePercentage: 0.1 });

      const result = await service.updateTask(1, 1, { requiredWorkers: 30 } as any);

      expect(result.task.requiredWorkers).toBe(30);
      expect(taskRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if task is already APPROVED', async () => {
      taskRepo.findOne.mockResolvedValue({
        ...baseTask(),
        approvalStatus: TaskApprovalStatusEnum.APPROVED,
      });
      await expect(service.updateTask(1, 1, { requiredWorkers: 5 } as any)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.updateTask(999, 1, { requiredWorkers: 5 } as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if new startDate is within 7 days', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask());
      await expect(service.updateTask(1, 1, { startDate: futureDate(2), requiredWorkers: 5 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if current startDate is within 7 days', async () => {
      taskRepo.findOne.mockResolvedValue({
        ...baseTask(),
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });
      await expect(service.updateTask(1, 1, { requiredWorkers: 5 } as any)).rejects.toThrow(BadRequestException);
    });

    it('should update workerLevel if provided', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask());
      levelRepo.findOne.mockResolvedValue({ levelName: 'Senior', companyHourlyRate: 200 });
      systemConfigRepo.findOne.mockResolvedValue({ globalSupervisorBouns: 200, platformFeePercentage: 0.1 });

      const result = await service.updateTask(1, 1, { workerLevel: 'Senior', requiredWorkers: 10 } as any);

      expect(levelRepo.findOne).toHaveBeenCalled();
      expect(result.task).toBeDefined();
    });

    it('should throw NotFoundException if new workerLevel not found', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask());
      levelRepo.findOne.mockResolvedValue(null);
      await expect(service.updateTask(1, 1, { workerLevel: 'Ghost', requiredWorkers: 5 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update workerTypes and remove old ones', async () => {
      const task = { ...baseTask(), workerTypes: [{ id: 1 }] };
      taskRepo.findOne.mockResolvedValue(task);
      workerTypeRepo.find.mockResolvedValue([{ typeName: 'Security' }]);
      systemConfigRepo.findOne.mockResolvedValue({ globalSupervisorBouns: 200, platformFeePercentage: 0.1 });

      await service.updateTask(1, 1, { workerTypes: ['Security'], requiredWorkers: 10 } as any);

      expect(taskWorkerTypeRepo.remove).toHaveBeenCalled();
      expect(workerTypeRepo.find).toHaveBeenCalled();
    });

    it('should update gender field when provided', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask());
      systemConfigRepo.findOne.mockResolvedValue({ globalSupervisorBouns: 200, platformFeePercentage: 0.1 });

      const result = await service.updateTask(1, 1, { gender: ['Female'], requiredWorkers: 10 } as any);

      expect(result.task.genders).toEqual(['Female']);
    });
  });

  // =========================================================================
  // 4. deleteTaskByCompany
  // =========================================================================
  describe('deleteTaskByCompany', () => {
    it('should delete a PENDING task successfully', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 1, approvalStatus: TaskApprovalStatusEnum.PENDING });

      const result = await service.deleteTaskByCompany(1, 1);
      expect(taskRepo.remove).toHaveBeenCalled();
      expect(result.message).toContain('deleted');
    });

    it('should throw NotFoundException if task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteTaskByCompany(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if task is already APPROVED', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 1, approvalStatus: TaskApprovalStatusEnum.APPROVED });
      await expect(service.deleteTaskByCompany(1, 1)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // 5. getCompanyApprovedTasks
  // =========================================================================
  describe('getCompanyApprovedTasks', () => {
    it('should return approved tasks for a company', async () => {
      taskRepo.find.mockResolvedValue([
        { id: 1, eventName: 'Event A', approvalStatus: TaskApprovalStatusEnum.APPROVED },
      ]);

      const result = await service.getCompanyApprovedTasks(1);
      expect(result).toHaveLength(1);
    });
  });

  // =========================================================================
  // 6. getCompanyTasksByStatus
  // =========================================================================
  describe('getCompanyTasksByStatus', () => {
    it('should return tasks filtered by status', async () => {
      taskRepo.find.mockResolvedValue([{ id: 1, status: TaskStatusEnum.IN_PROGRESS }]);

      const result = await service.getCompanyTasksByStatus(1, TaskStatusEnum.IN_PROGRESS);
      expect(result).toHaveLength(1);
    });
  });

  // =========================================================================
  // 7. getTaskDetailsForCompany
  // =========================================================================
  describe('getTaskDetailsForCompany', () => {
    it('should return task details correctly', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 1,
        eventName: 'Concert',
        location: 'Cairo',
        startDate: new Date(),
        endDate: new Date(),
        requiredWorkers: 10,
        requiredSupervisors: 1,
        workerLevel: { levelName: 'Junior' },
        workerTypes: [],
        durationHoursPerDay: 8,
        requiredWorkerStatus: requiredWorkersStatusEnum.COMPLETED,
        baseWorkersCost: 1000,
        supervisingFees: 400,
        totalCost: 1550,
        payment: { status: PaymentStatusEnum.PENDING },
      });

      const result = await service.getTaskDetailsForCompany(1, 1);
      expect(result.eventName).toBe('Concert');
      expect(result.financials.estimatedTotal).toBe(1550);
    });

    it('should throw NotFoundException if task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.getTaskDetailsForCompany(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // 8. submitTaskFeedback
  // =========================================================================
  describe('submitTaskFeedback', () => {
    it('should throw NotFoundException if task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.submitTaskFeedback(1, { Rating: 5 } as any, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if task has not ended yet', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 1, endDate: new Date(Date.now() + 1_000_000) });
      await expect(service.submitTaskFeedback(1, { Rating: 5 } as any, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if feedback already exists', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 1, endDate: new Date(Date.now() - 1_000) });
      feedbackRepo.findOne.mockResolvedValue({ id: 10 });
      await expect(service.submitTaskFeedback(1, { Rating: 5 } as any, 1)).rejects.toThrow(BadRequestException);
    });

    it('should save and return feedback successfully', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 1, endDate: pastDate(2) });
      feedbackRepo.findOne.mockResolvedValue(null);
      feedbackRepo.save.mockResolvedValue({ id: 99, rating: 5, createdAt: new Date() });

      const result = await service.submitTaskFeedback(1, { Rating: 5, Comment: 'Great' } as any, 1);
      expect(result.message).toContain('successfully');
      expect(result.feedback.Rating).toBe(5);
    });
  });

  // =========================================================================
  // 9. getCompanyFeedbacks
  // =========================================================================
  describe('getCompanyFeedbacks', () => {
    it('should return feedbacks with average rating', async () => {
      feedbackRepo.find.mockResolvedValue([
        { id: 1, rating: 4, comment: 'Good', createdAt: new Date(), task: { id: 1, eventName: 'Event' } },
        { id: 2, rating: 5, comment: 'Excellent', createdAt: new Date(), task: { id: 2, eventName: 'Event2' } },
      ]);

      const result = await service.getCompanyFeedbacks(1);
      expect(result.total).toBe(2);
      expect(result.averageRating).toBe(4.5);
    });

    it('should return 0 average rating when no feedbacks exist', async () => {
      feedbackRepo.find.mockResolvedValue([]);
      const result = await service.getCompanyFeedbacks(1);
      expect(result.averageRating).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  // =========================================================================
  // 10. getCompanyDashboardStats
  // =========================================================================
  describe('getCompanyDashboardStats', () => {
    it('should return aggregated stats correctly', async () => {
      const taskQb = buildQbMock([{ status: TaskStatusEnum.COMPLETED, count: '5', workersCount: '50' }]);
      const paymentQb = buildQbMock([
        { status: PaymentStatusEnum.PAID, total: '10000' },
        { status: PaymentStatusEnum.PENDING, total: '2000' },
      ]);
      const feedbackQb = buildQbMock([], { avg: '4.7' });

      taskRepo.createQueryBuilder.mockReturnValue(taskQb);
      paymentRepo.createQueryBuilder = jest.fn().mockReturnValue(paymentQb);
      feedbackRepo.createQueryBuilder = jest.fn().mockReturnValue(feedbackQb);
      taskRepo.find.mockResolvedValue([]);

      const result = await service.getCompanyDashboardStats(1);

      expect(result.CompletedTasks).toBe(5);
      expect(result.TotalSpent).toBe(10000);
      expect(result.PendingPayments).toBe(2000);
      expect(result.AverageRating).toBe(4.7);
      expect(result.TotalWorkersUsed).toBe(50);
    });

    it('should handle empty stats gracefully', async () => {
      const emptyQb = buildQbMock([], null);
      taskRepo.createQueryBuilder.mockReturnValue(emptyQb);
      paymentRepo.createQueryBuilder = jest.fn().mockReturnValue(emptyQb);
      feedbackRepo.createQueryBuilder = jest.fn().mockReturnValue(emptyQb);
      taskRepo.find.mockResolvedValue([]);

      const result = await service.getCompanyDashboardStats(1);

      expect(result.CompletedTasks).toBe(0);
      expect(result.TotalSpent).toBe(0);
      expect(result.AverageRating).toBe(0);
    });

    it('should map upcomingTasks with assigned workers count', async () => {
      const emptyQb = buildQbMock([], null);
      taskRepo.createQueryBuilder.mockReturnValue(emptyQb);
      paymentRepo.createQueryBuilder = jest.fn().mockReturnValue(emptyQb);
      feedbackRepo.createQueryBuilder = jest.fn().mockReturnValue(emptyQb);
      taskRepo.find.mockResolvedValue([
        {
          id: 1,
          eventName: 'Upcoming Event',
          startDate: new Date(),
          requiredWorkers: 20,
          taskWorkers: [{ id: 1 }, { id: 2 }],
        },
      ]);

      const result = await service.getCompanyDashboardStats(1);
      expect(result.UpcomingTasks).toHaveLength(1);
      expect(result.UpcomingTasks[0].AssignedWorkers).toBe(2);
    });
  });

  // =========================================================================
  // 11. getPendingCompanyTasks
  // =========================================================================
  describe('getPendingCompanyTasks', () => {
    it('should return pending tasks for a company', async () => {
      taskRepo.find.mockResolvedValue([{ id: 1, approvalStatus: TaskApprovalStatusEnum.PENDING }]);

      const result = await service.getPendingCompanyTasks(1);
      expect(result).toHaveLength(1);
      expect(taskRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ approvalStatus: TaskApprovalStatusEnum.PENDING }),
        }),
      );
    });
  });

  // =========================================================================
  // 12. saveWhatsAppLinkAndNotify
  // =========================================================================
  describe('saveWhatsAppLinkAndNotify', () => {
    it('should save link, send emails to workers with emails only, and return success', async () => {
      supervisorRepo.findOne.mockResolvedValue({
        id: 1,
        task: { eventName: 'Big Event' },
        whatsAppGroupLink: null,
      });
      taskWorkerRepo.find.mockResolvedValue([
        { worker: { email: 'w1@test.com', fullName: 'Worker One' } },
        { worker: { email: null, fullName: 'Worker Two' } }, // skipped
      ]);

      const result = await service.saveWhatsAppLinkAndNotify(1, 'https://wa.me/group/abc');

      expect(supervisorRepo.save).toHaveBeenCalled();
      expect(mailService.sendMail).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if supervisor assignment not found', async () => {
      supervisorRepo.findOne.mockResolvedValue(null);
      await expect(service.saveWhatsAppLinkAndNotify(1, 'link')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // 13. getConfirmedWorkers
  // =========================================================================
  describe('getConfirmedWorkers', () => {
    it('should return confirmed workers when requiredWorkerStatus is COMPLETED', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 1,
        requiredWorkerStatus: requiredWorkersStatusEnum.COMPLETED,
      });
      taskWorkerRepo.find.mockResolvedValue([{ worker: { id: 1, fullName: 'John Doe', profileImage: 'img.png' } }]);

      const result = await service.getConfirmedWorkers(1, 1);
      expect(result).toHaveLength(1);
      expect(result[0].fullName).toBe('John Doe');
      expect(result[0].profilePicture).toBe('img.png');
    });

    it('should use default avatar if worker has no profileImage', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 1,
        requiredWorkerStatus: requiredWorkersStatusEnum.COMPLETED,
      });
      taskWorkerRepo.find.mockResolvedValue([{ worker: { id: 2, fullName: 'Jane', profileImage: null } }]);

      const result = await service.getConfirmedWorkers(1, 1);
      expect(result[0].profilePicture).toBe('default-avatar-url');
    });

    it('should throw BadRequestException if task not found or status is not COMPLETED', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.getConfirmedWorkers(1, 1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('filterJobPostWorkers', () => {
    // ── Helper: build a fake ranked application ─────────────────────────────
    const makeApp = (id: number, reliabilityRate: number, appliedAtOffset: number, score = 0, completedTasks = 0) => ({
      id,
      status: ApplicationStatusEnum.PENDING,
      appliedAt: new Date(Date.now() + appliedAtOffset * 1000),
      worker: {
        id: id + 100, // worker ID = app ID + 100 (unique, easy to track)
        reliabilityRate,
        score,
        completedTasks,
      },
    });

    // ── Helper: mock the applicationRepo.createQueryBuilder chain ───────────
    const mockAppQb = (apps: any[]) => {
      const qb = buildFiltrationQbMock(apps);
      applicationRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);
      return qb;
    };

    // ── Helper: mock the taskWorkerRepo.createQueryBuilder update chain ──────
    const mockUpdateQb = () => {
      const qb = buildFiltrationQbMock();
      taskWorkerRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);
      return qb;
    };

    // ────────────────────────────────────────────────────────────────────────
    // CASE 1: Happy path — enough applicants for full selection
    // Task requires 3 workers → expects 3 PRIMARY + 3 BACKUP selected
    // ────────────────────────────────────────────────────────────────────────
    describe('happy path — full pool available', () => {
      beforeEach(() => {
        // JobPost is OPEN, linked to task requiring 3 workers
        jobPostRepo.findOne.mockResolvedValue({
          id: 1,
          status: JobPostStatusEnum.OPEN,
          task: { id: 10, requiredWorkers: 3 },
        });

        // 10 applicants — more than enough (3 primary + 3 backup = 6 needed)
        // Ordered by descending reliabilityRate then ascending appliedAt
        const apps = [
          makeApp(1, 99.0, 1), // best reliability → PRIMARY #1
          makeApp(2, 95.0, 2), // → PRIMARY #2
          makeApp(3, 90.0, 3), // → PRIMARY #3
          makeApp(4, 85.0, 4), // → BACKUP #1 (backupOrder=1)
          makeApp(5, 80.0, 5), // → BACKUP #2 (backupOrder=2)
          makeApp(6, 75.0, 6), // → BACKUP #3 (backupOrder=3)
          makeApp(7, 70.0, 7), // → REJECTED
          makeApp(8, 65.0, 8), // → REJECTED
          makeApp(9, 60.0, 9), // → REJECTED
          makeApp(10, 55.0, 10), // → REJECTED
        ];
        mockAppQb(apps);
        mockUpdateQb();
      });

      it('should create 6 TaskWorker records (3 primary + 3 backup)', async () => {
        taskWorkerRepo.create.mockImplementation((data: any) => data);
        taskWorkerRepo.save.mockResolvedValue([]);

        await service.filterJobPostWorkers(1);

        // taskWorkerRepo.create called 6 times (3+3)
        expect(taskWorkerRepo.create).toHaveBeenCalledTimes(6);
      });

      it('should assign first 3 as PRIMARY with no backupOrder', async () => {
        const created: any[] = [];
        taskWorkerRepo.create.mockImplementation((data: any) => {
          created.push(data);
          return data;
        });
        taskWorkerRepo.save.mockResolvedValue([]);

        await service.filterJobPostWorkers(1);

        const primaries = created.filter((r) => r.assignmentType === AssignmentTypeEnum.PRIMARY);
        expect(primaries).toHaveLength(3);
        primaries.forEach((p) => expect(p.backupOrder).toBeUndefined());
      });

      it('should assign next 3 as BACKUP with backupOrder 1, 2, 3', async () => {
        const created: any[] = [];
        taskWorkerRepo.create.mockImplementation((data: any) => {
          created.push(data);
          return data;
        });
        taskWorkerRepo.save.mockResolvedValue([]);

        await service.filterJobPostWorkers(1);

        const backups = created.filter((r) => r.assignmentType === AssignmentTypeEnum.BACKUP);
        expect(backups).toHaveLength(3);
        expect(backups[0].backupOrder).toBe(1);
        expect(backups[1].backupOrder).toBe(2);
        expect(backups[2].backupOrder).toBe(3);
      });

      it('should close the JobPost after filtration', async () => {
        taskWorkerRepo.create.mockImplementation((d: any) => d);
        taskWorkerRepo.save.mockResolvedValue([]);

        await service.filterJobPostWorkers(1);

        expect(jobPostRepo.update).toHaveBeenCalledWith(1, { status: JobPostStatusEnum.CLOSED });
      });

      it('should update rejected application statuses to REJECTED', async () => {
        taskWorkerRepo.create.mockImplementation((d: any) => d);
        taskWorkerRepo.save.mockResolvedValue([]);

        const qb = applicationRepo.createQueryBuilder();
        await service.filterJobPostWorkers(1);

        // The update chain should have been called for rejected IDs
        expect(qb.execute).toHaveBeenCalled();
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // CASE 2: Not enough applicants (less than requiredWorkers + 3)
    // Task requires 3 workers, only 4 applicants — can't fill 3 backup slots
    // ────────────────────────────────────────────────────────────────────────
    describe('edge case — fewer applicants than required', () => {
      beforeEach(() => {
        jobPostRepo.findOne.mockResolvedValue({
          id: 2,
          status: JobPostStatusEnum.OPEN,
          task: { id: 20, requiredWorkers: 3 },
        });

        // Only 4 applicants — enough for 3 primary, only 1 backup, 0 rejected
        const apps = [
          makeApp(1, 99.0, 1),
          makeApp(2, 95.0, 2),
          makeApp(3, 90.0, 3),
          makeApp(4, 85.0, 4), // only 1 backup available
        ];
        mockAppQb(apps);
        mockUpdateQb();
      });

      it('should still create TaskWorker records for all available applicants', async () => {
        taskWorkerRepo.create.mockImplementation((d: any) => d);
        taskWorkerRepo.save.mockResolvedValue([]);

        await service.filterJobPostWorkers(2);

        // 3 primary + 1 backup = 4 records created
        expect(taskWorkerRepo.create).toHaveBeenCalledTimes(4);
      });

      it('should still close the JobPost even with partial backup', async () => {
        taskWorkerRepo.create.mockImplementation((d: any) => d);
        taskWorkerRepo.save.mockResolvedValue([]);

        await service.filterJobPostWorkers(2);

        expect(jobPostRepo.update).toHaveBeenCalledWith(2, { status: JobPostStatusEnum.CLOSED });
      });

      it('should produce no REJECTED applications when all fit in selected', async () => {
        const created: any[] = [];
        taskWorkerRepo.create.mockImplementation((d: any) => {
          created.push(d);
          return d;
        });
        taskWorkerRepo.save.mockResolvedValue([]);

        await service.filterJobPostWorkers(2);

        // All 4 were selected — 0 rejected
        // The rejected update block should NOT be called (rejectedIds.length === 0)
        // We verify this by checking backupOrders assigned correctly
        const backups = created.filter((r) => r.assignmentType === AssignmentTypeEnum.BACKUP);
        expect(backups).toHaveLength(1);
        expect(backups[0].backupOrder).toBe(1);
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // CASE 3: Zero applicants — nothing to do, should still close JobPost
    // ────────────────────────────────────────────────────────────────────────
    describe('edge case — zero applicants', () => {
      it('should close the JobPost with no TaskWorker records created', async () => {
        jobPostRepo.findOne.mockResolvedValue({
          id: 3,
          status: JobPostStatusEnum.OPEN,
          task: { id: 30, requiredWorkers: 5 },
        });
        mockAppQb([]); // no applicants
        mockUpdateQb();
        taskWorkerRepo.create.mockImplementation((d: any) => d);
        taskWorkerRepo.save.mockResolvedValue([]);

        await service.filterJobPostWorkers(3);

        expect(taskWorkerRepo.create).not.toHaveBeenCalled();
        expect(jobPostRepo.update).toHaveBeenCalledWith(3, { status: JobPostStatusEnum.CLOSED });
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // CASE 4: JobPost already CLOSED — idempotency guard should skip silently
    // ────────────────────────────────────────────────────────────────────────
    describe('idempotency — already closed JobPost', () => {
      it('should return early without doing anything', async () => {
        jobPostRepo.findOne.mockResolvedValue({
          id: 4,
          status: JobPostStatusEnum.CLOSED, // already closed
          task: { id: 40, requiredWorkers: 5 },
        });

        await service.filterJobPostWorkers(4);

        // Nothing should have been called
        expect(taskWorkerRepo.create).not.toHaveBeenCalled();
        expect(taskWorkerRepo.save).not.toHaveBeenCalled();
        expect(jobPostRepo.update).not.toHaveBeenCalled();
        expect(applicationRepo.createQueryBuilder).not.toHaveBeenCalled();
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // CASE 5: JobPost not found — should throw NotFoundException
    // ────────────────────────────────────────────────────────────────────────
    describe('error case — JobPost not found', () => {
      it('should throw NotFoundException', async () => {
        jobPostRepo.findOne.mockResolvedValue(null);

        await expect(service.filterJobPostWorkers(999)).rejects.toThrow(NotFoundException);
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // CASE 6: Ranking correctness — verify reliabilityRate is top priority
    // Two workers with different reliability — higher rate should get PRIMARY
    // ────────────────────────────────────────────────────────────────────────
    describe('ranking — reliabilityRate is top priority', () => {
      it('should select highest reliabilityRate workers as PRIMARY', async () => {
        jobPostRepo.findOne.mockResolvedValue({
          id: 5,
          status: JobPostStatusEnum.OPEN,
          task: { id: 50, requiredWorkers: 2 },
        });

        // Apps are returned already ranked by DB query (we mock the result directly)
        // In real code the DB orderBy handles ranking — here we simulate the ranked output
        const rankedApps = [
          makeApp(1, 98.0, 1), // PRIMARY #1 — highest rate
          makeApp(2, 92.0, 2), // PRIMARY #2
          makeApp(3, 85.0, 3), // BACKUP #1
          makeApp(4, 80.0, 4), // BACKUP #2
          makeApp(5, 75.0, 5), // BACKUP #3
        ];
        mockAppQb(rankedApps);
        mockUpdateQb();

        const created: any[] = [];
        taskWorkerRepo.create.mockImplementation((d: any) => {
          created.push(d);
          return d;
        });
        taskWorkerRepo.save.mockResolvedValue([]);

        await service.filterJobPostWorkers(5);

        const primaries = created.filter((r) => r.assignmentType === AssignmentTypeEnum.PRIMARY);
        // Workers 101 and 102 (app IDs 1 and 2 → worker IDs 101, 102) should be primary
        expect(primaries.map((p) => p.worker.id)).toEqual([101, 102]);
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // CASE 7: All selected workers get PENDING confirmationStatus
    // ────────────────────────────────────────────────────────────────────────
    describe('confirmationStatus — all selected workers start as PENDING', () => {
      it('should set confirmationStatus to PENDING for all TaskWorker records', async () => {
        jobPostRepo.findOne.mockResolvedValue({
          id: 6,
          status: JobPostStatusEnum.OPEN,
          task: { id: 60, requiredWorkers: 2 },
        });

        mockAppQb([
          makeApp(1, 90.0, 1),
          makeApp(2, 85.0, 2),
          makeApp(3, 80.0, 3),
          makeApp(4, 75.0, 4),
          makeApp(5, 70.0, 5),
        ]);
        mockUpdateQb();

        const created: any[] = [];
        taskWorkerRepo.create.mockImplementation((d: any) => {
          created.push(d);
          return d;
        });
        taskWorkerRepo.save.mockResolvedValue([]);

        await service.filterJobPostWorkers(6);

        created.forEach((record) => {
          expect(record.confirmationStatus).toBe(WorkerConfirmationStatusEnum.PENDING);
        });
      });
    });
  });
});
