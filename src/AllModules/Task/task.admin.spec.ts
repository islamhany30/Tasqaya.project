import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './Task.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

// Entities
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
import { Application } from '../../entities/Application';
import { Worker } from '../../entities/Worker';

// Services
import { MailService } from '../../Mail/MailService';
import { PaymentService } from '../Payment/Payment.service';

// Enums
import { TaskStatusEnum } from '../../Enums/task-status.enum';
import { TaskApprovalStatusEnum } from '../../Enums/task-approval.enum';
import { PaymentStatusEnum } from '../../Enums/payment-status.enum';
import { ApplicationStatusEnum } from '../../Enums/application-status.enum';
import { AssignmentTypeEnum } from '../../Enums/assignment-type.enum';
import { WorkerConfirmationStatusEnum } from '../../Enums/worker-confirmation.enum';
import { JobPostStatusEnum } from '../../Enums/job-post-status.enum';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

const mockRepoFactory = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: Date.now(), ...entity })),
  remove: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  createQueryBuilder: jest.fn(),
});

// QB mock for getRawMany / getRawOne queries (stats)
const buildQbMock = (rawMany: any[] = [], rawOne: any = null) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  innerJoinAndSelect: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  setParameter: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(rawMany),
  getRawOne: jest.fn().mockResolvedValue(rawOne),
  getMany: jest.fn().mockResolvedValue(rawMany),
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskService — Admin Features', () => {
  let service: TaskService;
  let taskRepo: any;
  let paymentRepo: any;
  let feedbackRepo: any;
  let jobPostRepo: any;
  let workerRepo: any;
  let applicationRepo: any;
  let taskWorkerRepo: any;
  let supervisorRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
        { provide: getRepositoryToken(Application), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Worker), useValue: mockRepoFactory() },
        {
          provide: PaymentService,
          useValue: { createInitialInvoice: jest.fn().mockResolvedValue({ id: 999 }) },
        },
        {
          provide: MailService,
          useValue: { sendMail: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    taskRepo = module.get(getRepositoryToken(Task));
    paymentRepo = module.get(getRepositoryToken(Payment));
    feedbackRepo = module.get(getRepositoryToken(CompanyFeedback));
    jobPostRepo = module.get(getRepositoryToken(JobPost));
    workerRepo = module.get(getRepositoryToken(Worker));
    applicationRepo = module.get(getRepositoryToken(Application));
    taskWorkerRepo = module.get(getRepositoryToken(TaskWorker));
    supervisorRepo = module.get(getRepositoryToken(TaskSupervisor));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. getAdminDashboardStats
  // ═══════════════════════════════════════════════════════════════════════════
  describe('getAdminDashboardStats', () => {
    // ── helper: wire up all 4 QB sources at once ────────────────────────────
    const setupQbs = ({
      taskStats = [],
      paymentStats = [],
      companyStats = null,
      ratingResult = null,
      recentTasks = [],
    }: {
      taskStats?: any[];
      paymentStats?: any[];
      companyStats?: any;
      ratingResult?: any;
      recentTasks?: any[];
    }) => {
      // taskRepo QB is called 3 times: taskStats, companyStats, recentTasks (find)
      // We handle recentTasks via taskRepo.find directly
      taskRepo.createQueryBuilder
        .mockReturnValueOnce(buildQbMock(taskStats)) // task status groupBy
        .mockReturnValueOnce(buildQbMock([], companyStats)); // company stats

      paymentRepo.createQueryBuilder.mockReturnValue(buildQbMock(paymentStats));

      feedbackRepo.createQueryBuilder.mockReturnValue(buildQbMock([], ratingResult));

      workerRepo.createQueryBuilder.mockReturnValue(
        buildQbMock([], {
          total: '50',
          activeCount: '45',
          avgReliability: '87.5',
        }),
      );

      taskRepo.find.mockResolvedValue(recentTasks);
    };

    // ────────────────────────────────────────────────────────────────────────
    it('should return correct task counts for each status', async () => {
      setupQbs({
        taskStats: [
          { status: TaskStatusEnum.COMPLETED, count: '10' },
          { status: TaskStatusEnum.IN_PROGRESS, count: '3' },
          { status: TaskStatusEnum.PENDING, count: '5' },
          { status: TaskStatusEnum.UNAPPROVED, count: '2' },
        ],
        companyStats: { totalCompanies: '8', activeCompanies: '3' },
        ratingResult: { avg: '4.2', total: '20' },
      });

      const result = await service.getAdminDashboardStats();

      expect(result.data.tasks.completed).toBe(10);
      expect(result.data.tasks.inProgress).toBe(3);
      expect(result.data.tasks.pending).toBe(5);
      expect(result.data.tasks.unapproved).toBe(2);
      expect(result.data.tasks.total).toBe(20);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should return correct payment revenue figures', async () => {
      setupQbs({
        paymentStats: [
          { status: PaymentStatusEnum.PAID, total: '75000', count: '15' },
          { status: PaymentStatusEnum.PENDING, total: '12000', count: '4' },
        ],
        companyStats: { totalCompanies: '5', activeCompanies: '2' },
        ratingResult: { avg: '4.0', total: '10' },
      });

      const result = await service.getAdminDashboardStats();

      expect(result.data.payments.totalRevenue).toBe(75000);
      expect(result.data.payments.pendingRevenue).toBe(12000);
      expect(result.data.payments.paidInvoices).toBe(15);
      expect(result.data.payments.pendingInvoices).toBe(4);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should return correct worker stats', async () => {
      // workerRepo QB returns fixed values from setupQbs helper (50 total, 45 active, 87.5 avg)
      setupQbs({
        companyStats: { totalCompanies: '10', activeCompanies: '4' },
        ratingResult: { avg: '4.5', total: '30' },
      });

      const result = await service.getAdminDashboardStats();

      expect(result.data.workers.total).toBe(50);
      expect(result.data.workers.active).toBe(45);
      expect(result.data.workers.avgReliabilityRate).toBe(87.5);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should return correct company stats', async () => {
      setupQbs({
        companyStats: { totalCompanies: '12', activeCompanies: '5' },
        ratingResult: { avg: '4.1', total: '15' },
      });

      const result = await service.getAdminDashboardStats();

      expect(result.data.companies.total).toBe(12);
      expect(result.data.companies.currentlyActive).toBe(5);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should return correct platform rating', async () => {
      setupQbs({
        companyStats: { totalCompanies: '5', activeCompanies: '2' },
        ratingResult: { avg: '4.75', total: '40' },
      });

      const result = await service.getAdminDashboardStats();

      expect(result.data.platform.averageRating).toBe(4.8); // rounded to 1 decimal
      expect(result.data.platform.totalFeedbacks).toBe(40);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should return recent tasks mapped correctly', async () => {
      setupQbs({
        companyStats: { totalCompanies: '3', activeCompanies: '1' },
        ratingResult: { avg: '4.0', total: '5' },
        recentTasks: [
          {
            id: 1,
            eventName: 'Cairo Tech Summit',
            status: TaskStatusEnum.IN_PROGRESS,
            approvalStatus: TaskApprovalStatusEnum.APPROVED,
            totalCost: 15000,
            createdAt: new Date('2026-03-01'),
            company: { id: 1, name: 'TechCorp' },
          },
          {
            id: 2,
            eventName: 'Expo 2026',
            status: TaskStatusEnum.PENDING,
            approvalStatus: TaskApprovalStatusEnum.APPROVED,
            totalCost: 8000,
            createdAt: new Date('2026-03-05'),
            company: { id: 2, name: 'EventsPro' },
          },
        ],
      });

      const result = await service.getAdminDashboardStats();

      expect(result.data.recentTasks).toHaveLength(2);
      expect(result.data.recentTasks[0].eventName).toBe('Cairo Tech Summit');
      expect(result.data.recentTasks[0].company).toBe('TechCorp');
      expect(result.data.recentTasks[1].totalCost).toBe(8000);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should handle completely empty database gracefully (all zeros)', async () => {
      setupQbs({
        taskStats: [],
        paymentStats: [],
        companyStats: { totalCompanies: '0', activeCompanies: '0' },
        ratingResult: null,
        recentTasks: [],
      });

      // Override workerRepo to return zeros
      workerRepo.createQueryBuilder.mockReturnValue(
        buildQbMock([], { total: '0', activeCount: '0', avgReliability: null }),
      );

      const result = await service.getAdminDashboardStats();

      expect(result.data.tasks.total).toBe(0);
      expect(result.data.payments.totalRevenue).toBe(0);
      expect(result.data.workers.total).toBe(0);
      expect(result.data.workers.avgReliabilityRate).toBe(0);
      expect(result.data.platform.averageRating).toBe(0);
      expect(result.data.recentTasks).toHaveLength(0);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should default to 0 when only PAID payments exist (no PENDING row)', async () => {
      setupQbs({
        paymentStats: [
          { status: PaymentStatusEnum.PAID, total: '50000', count: '10' },
          // no PENDING row at all
        ],
        companyStats: { totalCompanies: '5', activeCompanies: '2' },
        ratingResult: { avg: '4.0', total: '10' },
      });

      const result = await service.getAdminDashboardStats();

      expect(result.data.payments.totalRevenue).toBe(50000);
      expect(result.data.payments.pendingRevenue).toBe(0); // missing row → 0
      expect(result.data.payments.pendingInvoices).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. getAllTasksForAdmin
  // ═══════════════════════════════════════════════════════════════════════════
  describe('getAllTasksForAdmin', () => {
    it('should return all tasks with no filters', async () => {
      taskRepo.find.mockResolvedValue([
        { id: 1, eventName: 'Event A', status: TaskStatusEnum.PENDING },
        { id: 2, eventName: 'Event B', status: TaskStatusEnum.COMPLETED },
      ]);

      const result = await service.getAllTasksForAdmin({});

      expect(result.data.total).toBe(2);
      expect(result.data.tasks).toHaveLength(2);
      expect(taskRepo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: 'DESC' } }));
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should pass status filter to repository', async () => {
      taskRepo.find.mockResolvedValue([{ id: 1, status: TaskStatusEnum.IN_PROGRESS }]);

      const result = await service.getAllTasksForAdmin({
        status: TaskStatusEnum.IN_PROGRESS,
      });

      expect(result.data.total).toBe(1);
      expect(taskRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: TaskStatusEnum.IN_PROGRESS }),
        }),
      );
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should pass approvalStatus filter to repository', async () => {
      taskRepo.find.mockResolvedValue([]);

      await service.getAllTasksForAdmin({
        approvalStatus: TaskApprovalStatusEnum.APPROVED,
      });

      expect(taskRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            approvalStatus: TaskApprovalStatusEnum.APPROVED,
          }),
        }),
      );
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should pass companyId filter to repository', async () => {
      taskRepo.find.mockResolvedValue([]);

      await service.getAllTasksForAdmin({ companyId: 7 });

      expect(taskRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ company: { id: 7 } }),
        }),
      );
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should apply date range filter when both dates provided', async () => {
      taskRepo.find.mockResolvedValue([]);

      await service.getAllTasksForAdmin({
        startDateFrom: '2026-01-01',
        startDateTo: '2026-06-30',
      });

      // Between() wraps the startDate — just verify find was called with startDate key
      expect(taskRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startDate: expect.anything(),
          }),
        }),
      );
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should return empty list when no tasks match filters', async () => {
      taskRepo.find.mockResolvedValue([]);

      const result = await service.getAllTasksForAdmin({
        status: TaskStatusEnum.COMPLETED,
        companyId: 999,
      });

      expect(result.data.total).toBe(0);
      expect(result.data.tasks).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. getTaskDetailsForAdmin
  // ═══════════════════════════════════════════════════════════════════════════
  describe('getTaskDetailsForAdmin', () => {
    const buildFullTask = () => ({
      id: 1,
      eventName: 'Mega Conference',
      location: 'Cairo',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-03'),
      durationHoursPerDay: 8,
      requiredWorkers: 20,
      requiredSupervisors: 2,
      status: TaskStatusEnum.PENDING,
      approvalStatus: TaskApprovalStatusEnum.APPROVED,
      requiredWorkerStatus: 'PENDING',
      hasUniform: true,
      uniformDescription: 'Black shirt',
      genders: ['MALE'],
      createdAt: new Date('2026-03-01'),
      baseWorkersCost: 10000,
      supervisingFees: 800,
      platformFee: 1620,
      totalCost: 12420,
      company: { id: 1, name: 'TechCorp', email: 'tech@corp.com' },
      workerLevel: { id: 2, levelName: 'SILVER' },
      workerTypes: [
        { workerTypeId: { id: 1, typeName: 'ORGANIZING' } },
        { workerTypeId: { id: 2, typeName: 'REGISTRATION' } },
      ],
      jobPost: {
        id: 10,
        status: JobPostStatusEnum.CLOSED,
        deadline: new Date('2026-04-29'),
        publishedAt: new Date('2026-03-10'),
        maxAllowedWorkers: 50,
      },
      supervisors: [
        {
          id: 1,
          supervisorBonus: 400,
          whatsAppGroupLink: 'https://wa.me/group/abc',
          supervisor: {
            id: 5,
            fullName: 'Ahmed Supervisor',
            email: 'ahmed@tasqaya.com',
            phone: '01012345678',
          },
        },
      ],
      taskWorkers: [
        {
          worker: { id: 10, fullName: 'Worker One' },
          assignmentType: AssignmentTypeEnum.PRIMARY,
          backupOrder: null,
          confirmationStatus: WorkerConfirmationStatusEnum.CONFIRMED,
        },
        {
          worker: { id: 11, fullName: 'Worker Two' },
          assignmentType: AssignmentTypeEnum.BACKUP,
          backupOrder: 1,
          confirmationStatus: WorkerConfirmationStatusEnum.PENDING,
        },
      ],
      payment: { status: PaymentStatusEnum.PAID },
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should return full task details correctly', async () => {
      taskRepo.findOne.mockResolvedValue(buildFullTask());

      const result = await service.getTaskDetailsForAdmin(1);

      expect(result.data.id).toBe(1);
      expect(result.data.eventName).toBe('Mega Conference');
      expect(result.data.company.name).toBe('TechCorp');
      expect(result.data.workerLevel.levelName).toBe('SILVER');
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should map workerTypes correctly', async () => {
      taskRepo.findOne.mockResolvedValue(buildFullTask());

      const result = await service.getTaskDetailsForAdmin(1);

      expect(result.data.workerTypes).toHaveLength(2);
      expect(result.data.workerTypes[0].typeName).toBe('ORGANIZING');
      expect(result.data.workerTypes[1].typeName).toBe('REGISTRATION');
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should map financials correctly', async () => {
      taskRepo.findOne.mockResolvedValue(buildFullTask());

      const result = await service.getTaskDetailsForAdmin(1);

      expect(result.data.financials.baseWorkersCost).toBe(10000);
      expect(result.data.financials.supervisingFees).toBe(800);
      expect(result.data.financials.totalCost).toBe(12420);
      expect(result.data.financials.paymentStatus).toBe(PaymentStatusEnum.PAID);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should map supervisors correctly', async () => {
      taskRepo.findOne.mockResolvedValue(buildFullTask());

      const result = await service.getTaskDetailsForAdmin(1);

      expect(result.data.supervisors).toHaveLength(1);
      expect(result.data.supervisors[0].fullName).toBe('Ahmed Supervisor');
      expect(result.data.supervisors[0].whatsAppGroupLink).toBe('https://wa.me/group/abc');
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should map workers list with assignmentType and confirmationStatus', async () => {
      taskRepo.findOne.mockResolvedValue(buildFullTask());

      const result = await service.getTaskDetailsForAdmin(1);

      expect(result.data.workers.total).toBe(2);
      expect(result.data.workers.list[0].assignmentType).toBe(AssignmentTypeEnum.PRIMARY);
      expect(result.data.workers.list[0].confirmationStatus).toBe(WorkerConfirmationStatusEnum.CONFIRMED);
      expect(result.data.workers.list[1].backupOrder).toBe(1);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should return null for jobPost fields when task has no jobPost yet', async () => {
      const task = { ...buildFullTask(), jobPost: null };
      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.getTaskDetailsForAdmin(1);

      expect(result.data.jobPost).toBeNull();
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should return null paymentStatus when task has no payment', async () => {
      const task = { ...buildFullTask(), payment: null };
      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.getTaskDetailsForAdmin(1);

      expect(result.data.financials.paymentStatus).toBeNull();
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should throw NotFoundException when task does not exist', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(service.getTaskDetailsForAdmin(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. getJobPostApplicants
  // ═══════════════════════════════════════════════════════════════════════════
  describe('getJobPostApplicants', () => {
    const buildApplicant = (id: number, reliability: number, status = ApplicationStatusEnum.PENDING) => ({
      id,
      status,
      appliedAt: new Date(`2026-03-0${id}`),
      worker: {
        id: id + 100,
        fullName: `Worker ${id}`,
        email: `worker${id}@test.com`,
        phone: `0100000000${id}`,
        reliabilityRate: reliability,
        score: reliability,
        completedTasks: id * 2,
        level: { levelName: 'GOLD' },
      },
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should return applicants with correct structure', async () => {
      jobPostRepo.findOne.mockResolvedValue({
        id: 1,
        status: JobPostStatusEnum.OPEN,
        deadline: new Date('2026-04-01'),
        maxAllowedWorkers: 30,
        task: { id: 5, eventName: 'Job Fair' },
      });

      const qb = buildQbMock([buildApplicant(1, 95), buildApplicant(2, 88), buildApplicant(3, 76)]);
      applicationRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.getJobPostApplicants(1);

      expect(result.data.totalApplications).toBe(3);
      expect(result.data.applicants[0].worker.reliabilityRate).toBe(95);
      expect(result.data.applicants[1].worker.fullName).toBe('Worker 2');
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should include application status for each applicant', async () => {
      jobPostRepo.findOne.mockResolvedValue({
        id: 2,
        status: JobPostStatusEnum.CLOSED,
        deadline: new Date('2026-04-01'),
        maxAllowedWorkers: 10,
        task: { id: 6, eventName: 'Conference' },
      });

      const qb = buildQbMock([
        buildApplicant(1, 90, ApplicationStatusEnum.ACCEPTED),
        buildApplicant(2, 80, ApplicationStatusEnum.BACKUP),
        buildApplicant(3, 70, ApplicationStatusEnum.REJECTED),
      ]);
      applicationRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.getJobPostApplicants(2);

      expect(result.data.applicants[0].status).toBe(ApplicationStatusEnum.ACCEPTED);
      expect(result.data.applicants[1].status).toBe(ApplicationStatusEnum.BACKUP);
      expect(result.data.applicants[2].status).toBe(ApplicationStatusEnum.REJECTED);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should return zero applicants for a fresh job post', async () => {
      jobPostRepo.findOne.mockResolvedValue({
        id: 3,
        status: JobPostStatusEnum.OPEN,
        deadline: new Date('2026-05-01'),
        maxAllowedWorkers: 20,
        task: { id: 7, eventName: 'Empty Event' },
      });

      const qb = buildQbMock([]);
      applicationRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.getJobPostApplicants(3);

      expect(result.data.totalApplications).toBe(0);
      expect(result.data.applicants).toHaveLength(0);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should include jobPost metadata in the response', async () => {
      jobPostRepo.findOne.mockResolvedValue({
        id: 4,
        status: JobPostStatusEnum.OPEN,
        deadline: new Date('2026-04-15'),
        maxAllowedWorkers: 25,
        task: { id: 8, eventName: 'Trade Show' },
      });

      const qb = buildQbMock([buildApplicant(1, 88)]);
      applicationRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.getJobPostApplicants(4);

      expect(result.data.jobPostId).toBe(4);
      expect(result.data.taskId).toBe(8);
      expect(result.data.eventName).toBe('Trade Show');
      expect(result.data.maxAllowedWorkers).toBe(25);
      expect(result.data.jobPostStatus).toBe(JobPostStatusEnum.OPEN);
    });

    // ────────────────────────────────────────────────────────────────────────
    it('should throw NotFoundException when jobPost does not exist', async () => {
      jobPostRepo.findOne.mockResolvedValue(null);

      await expect(service.getJobPostApplicants(999)).rejects.toThrow(NotFoundException);
    });
  });
});
