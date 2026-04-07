import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import { Repository } from 'typeorm';
import { WorkerService } from './Worker.service';
import { Worker } from 'src/entities/Worker';
import { JobPost } from 'src/entities/JobPost';
import { Application } from 'src/entities/Application';
import { Task } from 'src/entities/Task';
import { AuthService } from 'src/Auth/Auth.service';
import { TaskService } from '../Task/Task.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { JobPostStatusEnum } from 'src/Enums/job-post-status.enum';
import { ApplicationStatusEnum } from 'src/Enums/application-status.enum';

describe('WorkerService - Full Coverage', () => {
  let service: WorkerService;
  let module: TestingModule;
  let workerRepo: any;
  let jobPostRepo: any;
  let applicationRepo: any;
  let taskRepo: any;
  let authService: any;
  let taskService: any;

  const mockRepoFactory = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn().mockImplementation((dto) => ({ ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: Date.now(), ...entity })),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
  });

  const buildJobPostQueryBuilderMock = (countResult = 0, rawManyResult: any[] = []) => {
    const queryBuilder: any = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(countResult),
      getRawMany: jest.fn().mockResolvedValue(rawManyResult),
    };
    return queryBuilder;
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        WorkerService,
        { provide: getRepositoryToken(Worker), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(JobPost), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Application), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Task), useValue: mockRepoFactory() },
        {
          provide: AuthService,
          useValue: {
            register: jest.fn().mockResolvedValue({}),
            verifyUser: jest.fn().mockResolvedValue({}),
            resendVerification: jest.fn().mockResolvedValue({}),
            login: jest.fn().mockResolvedValue({ token: 'token' }),
            forgotPassword: jest.fn().mockResolvedValue({}),
            verifyResetCode: jest.fn().mockResolvedValue({}),
            resetPassword: jest.fn().mockResolvedValue({}),
            changePassword: jest.fn().mockResolvedValue({}),
            deactivateAccount: jest.fn().mockResolvedValue({}),
            deleteAccount: jest.fn().mockResolvedValue({}),
            accountRepo: { findOne: jest.fn() },
          },
        },
        {
          provide: TaskService,
          useValue: {
            filterJobPostWorkers: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<WorkerService>(WorkerService);
    workerRepo = module.get(getRepositoryToken(Worker));
    jobPostRepo = module.get(getRepositoryToken(JobPost));
    applicationRepo = module.get(getRepositoryToken(Application));
    taskRepo = module.get(getRepositoryToken(Task));
    authService = module.get(AuthService);
    taskService = module.get(TaskService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findByEmail and findById', () => {
    it('should return worker by email', async () => {
      workerRepo.findOne.mockResolvedValue({ id: 1, email: 'worker@example.com' });
      const result = await service.findByEmail('worker@example.com');
      expect(result).toEqual({ id: 1, email: 'worker@example.com' });
      expect(workerRepo.findOne).toHaveBeenCalledWith({ where: { email: 'worker@example.com' } });
    });

    it('should return worker by id', async () => {
      workerRepo.findOne.mockResolvedValue({ id: 2 });
      const result = await service.findById(2);
      expect(result).toEqual({ id: 2 });
      expect(workerRepo.findOne).toHaveBeenCalledWith({ where: { id: 2 } });
    });
  });

  describe('validatePassword', () => {
    it('should return true when bcrypt compare succeeds', async () => {
      const hashed = await bcrypt.hash('plain', 1);
      const result = await service.validatePassword('plain', { password: hashed });
      expect(result).toBe(true);
    });

    it('should return false when bcrypt compare fails', async () => {
      const hashed = await bcrypt.hash('other', 1);
      const result = await service.validatePassword('plain', { password: hashed });
      expect(result).toBe(false);
    });
  });

  describe('basic repository operations', () => {
    it('should create a user', async () => {
      workerRepo.save.mockResolvedValue({ id: 3, email: 'new@worker.com' });
      const result = await service.createUser({ email: 'new@worker.com' } as any);
      expect(workerRepo.create).toHaveBeenCalledWith({ email: 'new@worker.com' });
      expect(workerRepo.save).toHaveBeenCalled();
      expect(result).toEqual({ id: 3, email: 'new@worker.com' });
    });

    it('should set verification code', async () => {
      await service.setVerificationCode(5, 'abc', new Date('2026-01-01'));
      expect(workerRepo.update).toHaveBeenCalledWith(5, {
        verificationCode: 'abc',
        verificationCodeExpiry: new Date('2026-01-01'),
      });
    });

    it('should clear reset code', async () => {
      await service.clearResetCode(6);
      expect(workerRepo.update).toHaveBeenCalledWith(6, {
        resetCode: null,
        resetCodeExpiry: null,
      });
    });
  });

  describe('auth delegations', () => {
    it('should register through authService', async () => {
      const dto = { email: 'test@example.com', password: 'pass', confirmPassword: 'pass' } as any;
      await service.register(dto);
      expect(authService.register).toHaveBeenCalledWith(
        { email: 'test@example.com', password: 'pass' },
        'A verification code sent to you by email',
        service,
        expect.any(String),
      );
    });

    it('should login through authService', async () => {
      const result = await service.login({ email: 'test@example.com', password: 'pass' });
      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'pass');
      expect(result).toEqual({ token: 'token' });
    });

    it('should verify reset code when account exists', async () => {
      authService.accountRepo.findOne.mockResolvedValue({ id: 7, email: 'test@example.com' });
      await service.verifyResetCode({ email: 'test@example.com', code: '1234' });
      expect(authService.verifyResetCode).toHaveBeenCalledWith(7, '1234');
    });

    it('should throw when verify reset code account missing', async () => {
      authService.accountRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyResetCode({ email: 'missing@example.com', code: '1234' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('worker domain logic', () => {
    it('should change status successfully', async () => {
      workerRepo.findOne.mockResolvedValue({ id: 8 });
      const result = await service.changeStatus(8, false);
      expect(workerRepo.update).toHaveBeenCalledWith(8, { isActive: false });
      expect(result).toEqual({ message: 'Worker account has been deactivated successfully' });
    });

    it('should throw when changing status of nonexistent worker', async () => {
      workerRepo.findOne.mockResolvedValue(null);
      await expect(service.changeStatus(99, true)).rejects.toThrow(NotFoundException);
    });

    it('should get all workers', async () => {
      workerRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const result = await service.getAllWorkers();
      expect(result.data.workers).toHaveLength(2);
      expect(result.message).toBe('Workers fetched successfully');
    });

    it('should return empty worker list when no workers exist', async () => {
      workerRepo.find.mockResolvedValue([]);
      const result = await service.getAllWorkers();
      expect(result.data.workers).toEqual([]);
      expect(result.message).toBe('Workers fetched successfully');
    });

    it('should fetch a worker by id', async () => {
      workerRepo.findOne.mockResolvedValue({ id: 10 });
      const result = await service.getWorkerById(10);
      expect(result.data.worker).toEqual({ id: 10 });
    });

    it('should edit profile successfully', async () => {
      const worker = { id: 12, firstName: 'Old', save: jest.fn() } as any;
      workerRepo.findOne.mockResolvedValue(worker);
      workerRepo.save.mockResolvedValue({ ...worker, firstName: 'New' });

      const dto = { firstName: 'New' } as any;
      const result = await service.editProfile(12, dto);

      expect(workerRepo.save).toHaveBeenCalledWith(worker);
      expect(result.data.worker.firstName).toBe('New');
    });

    it('should throw on edit profile if worker absent', async () => {
      workerRepo.findOne.mockResolvedValue(null);
      await expect(service.editProfile(999, { firstName: 'New' } as any)).rejects.toThrow(NotFoundException);
    });

    it('should upload profile image and delete old file if present', async () => {
      const existingPath = `${process.cwd()}/tmp-old-worker-profile.png`;
      fs.writeFileSync(existingPath, 'x');
      const worker = { id: 13, profileImage: existingPath } as any;
      workerRepo.findOne.mockResolvedValue(worker);
      workerRepo.save.mockResolvedValue({ ...worker, profileImage: '/tmp/new.png' });

      const result = await service.uploadProfileImage(13, '/tmp/new.png');

      expect(fs.existsSync(existingPath)).toBe(false);
      expect(workerRepo.save).toHaveBeenCalledWith({ ...worker, profileImage: '/tmp/new.png' });
      expect(result.profileImage).toBe('/tmp/new.png');
    });

    it('should throw when uploading profile image for missing worker', async () => {
      workerRepo.findOne.mockResolvedValue(null);
      await expect(service.uploadProfileImage(99, '/tmp/new.png')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAvailableJobs', () => {
    it('should throw when worker not found', async () => {
      workerRepo.findOne.mockResolvedValue(null);
      await expect(service.getAvailableJobs(1, { offset: 0, limit: 10 } as any)).rejects.toThrow(NotFoundException);
    });

    it('should return paginated jobs', async () => {
      workerRepo.findOne.mockResolvedValue({ id: 1, level: { id: 5 }, gender: 'Male' });
      const queryBuilder = buildJobPostQueryBuilderMock(1, [
        {
          jp_id: 11,
          task_eventName: 'Event',
          task_location: 'Venue',
          task_startDate: '2026-05-01',
          task_endDate: '2026-05-02',
          task_requiredWorkers: 10,
          task_durationHoursPerDay: 8,
          jp_status: 'OPEN',
          jp_deadline: '2026-04-15',
          jp_publishedAt: '2026-04-01',
          level_id: 5,
          level_levelName: 'Senior',
          level_workerHourlyRate: 100,
          task_genders: 'Male,Female',
          app_id: null,
          applicationsCount: '0',
        },
      ]);
      jobPostRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getAvailableJobs(1, {
        offset: 0,
        limit: 10,
        sortBy: 'deadline',
        sortDirection: 'ASC',
      } as any);

      expect(result.data.jobs[0].id).toBe(11);
      expect(result.data.pagination.total).toBe(1);
      expect(jobPostRepo.createQueryBuilder).toHaveBeenCalledWith('jp');
    });
  });

  describe('applyForJob', () => {
    const worker = {
      id: 2,
      isVerified: true,
      isActive: true,
      gender: 'Male',
      level: { id: 10 },
    };
    const jobPost = {
      id: 3,
      status: JobPostStatusEnum.OPEN,
      deadline: new Date(Date.now() + 1000000),
      maxAllowedWorkers: 10,
      task: {
        workerLevel: { id: 10 },
        genders: 'Male,Female',
        eventName: 'Event',
        location: 'Venue',
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        requiredWorkers: 20,
        durationHoursPerDay: 8,
      },
    };

    it('should throw when worker not found', async () => {
      workerRepo.findOne.mockResolvedValue(null);
      await expect(service.applyForJob(2, { jobPostId: 3 } as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw when worker is not verified', async () => {
      workerRepo.findOne.mockResolvedValue({ ...worker, isVerified: false });
      await expect(service.applyForJob(2, { jobPostId: 3 } as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw when job post is missing', async () => {
      workerRepo.findOne.mockResolvedValue(worker);
      jobPostRepo.findOne.mockResolvedValue(null);
      await expect(service.applyForJob(2, { jobPostId: 3 } as any)).rejects.toThrow(NotFoundException);
    });

    it('should create application successfully', async () => {
      workerRepo.findOne.mockResolvedValue(worker);
      jobPostRepo.findOne.mockResolvedValue(jobPost);
      applicationRepo.findOne.mockResolvedValue(null);
      applicationRepo.count.mockResolvedValue(0);
      applicationRepo.save.mockResolvedValue({
        id: 20,
        jobPost,
        worker,
        status: ApplicationStatusEnum.PENDING,
        appliedAt: new Date(),
      });
      applicationRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 20,
        jobPost,
        worker,
        status: ApplicationStatusEnum.PENDING,
        appliedAt: new Date(),
      });

      const result = await service.applyForJob(2, { jobPostId: 3 } as any);
      expect(result.message).toBe('Successfully applied for the job');
      expect(result.data.application.jobPost.id).toBe(3);
    });

    it('should reject duplicate application', async () => {
      workerRepo.findOne.mockResolvedValue(worker);
      jobPostRepo.findOne.mockResolvedValue(jobPost);
      applicationRepo.findOne.mockResolvedValue({ id: 42 });
      await expect(service.applyForJob(2, { jobPostId: 3 } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyApplications and withdrawApplication', () => {
    it('should throw when worker not found for applications', async () => {
      workerRepo.findOne.mockResolvedValue(null);
      await expect(service.getMyApplications(5)).rejects.toThrow(NotFoundException);
    });

    it('should return my applications paginated', async () => {
      workerRepo.findOne.mockResolvedValue({ id: 5 });
      applicationRepo.count.mockResolvedValue(1);
      applicationRepo.find.mockResolvedValue([
        {
          id: 30,
          worker: { id: 5 },
          jobPost: {
            id: 7,
            status: JobPostStatusEnum.OPEN,
            task: {
              eventName: 'Event',
              location: 'Venue',
              startDate: '2026-06-01',
              endDate: '2026-06-02',
              requiredWorkers: 5,
              durationHoursPerDay: 8,
              workerLevel: { id: 10, levelName: 'Senior', workerHourlyRate: 120 },
              genders: 'Female',
            },
          },
          status: ApplicationStatusEnum.PENDING,
          appliedAt: new Date('2026-04-01'),
        },
      ]);

      const result = await service.getMyApplications(5, { offset: 0, limit: 10 } as any);
      expect(result.data.applications[0].id).toBe(30);
      expect(result.data.pagination.total).toBe(1);
    });

    it('should withdraw application successfully', async () => {
      applicationRepo.findOne.mockResolvedValue({ id: 40, worker: { id: 5 }, status: ApplicationStatusEnum.PENDING });
      const result = await service.withdrawApplication(40, 5);
      expect(applicationRepo.delete).toHaveBeenCalledWith(40);
      expect(result.message).toBe('Application withdrawn successfully');
    });

    it('should throw when withdrawing missing application', async () => {
      applicationRepo.findOne.mockResolvedValue(null);
      await expect(service.withdrawApplication(99, 5)).rejects.toThrow(NotFoundException);
    });

    it('should throw when withdrawing another users application', async () => {
      applicationRepo.findOne.mockResolvedValue({ id: 41, worker: { id: 6 }, status: ApplicationStatusEnum.PENDING });
      await expect(service.withdrawApplication(41, 5)).rejects.toThrow(ForbiddenException);
    });

    it('should throw when withdrawing non-pending application', async () => {
      applicationRepo.findOne.mockResolvedValue({ id: 42, worker: { id: 5 }, status: ApplicationStatusEnum.ACCEPTED });
      await expect(service.withdrawApplication(42, 5)).rejects.toThrow(BadRequestException);
    });
  });
});
