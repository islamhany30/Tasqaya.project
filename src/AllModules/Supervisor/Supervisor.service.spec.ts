import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { SupervisorService } from './Supervisor.service';
import { Supervisor } from 'src/entities/Supervisor';
import { TaskSupervisor } from 'src/entities/TaskSupervisor';
import { Attendance } from 'src/entities/Attendance';
import { TaskWorker } from 'src/entities/TaskWorker';
import { SupervisorPayout } from 'src/entities/SupervisorPayout';
import { AuthService } from 'src/Auth/Auth.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttendanceStatusEnum } from 'src/Enums/attendance-status.enum';
import { WorkerConfirmationStatusEnum } from 'src/Enums/worker-confirmation.enum';
import { TaskStatusEnum } from 'src/Enums/task-status.enum';
import { PayoutStatusEnum } from 'src/Enums/payout-status.enum';

describe('SupervisorService - Full Coverage', () => {
  let service: SupervisorService;
  let module: TestingModule;
  let supervisorRepo: any;
  let taskSupervisorRepo: any;
  let attendanceRepo: any;
  let taskWorkerRepo: any;
  let supervisorPayoutRepo: any;
  let authService: any;

  const mockRepoFactory = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn().mockImplementation((dto) => ({ ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: Date.now(), ...entity })),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        SupervisorService,
        { provide: getRepositoryToken(Supervisor), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(TaskSupervisor), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Attendance), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(TaskWorker), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(SupervisorPayout), useValue: mockRepoFactory() },
        {
          provide: AuthService,
          useValue: {
            register: jest.fn().mockResolvedValue({}),
            verifyUser: jest.fn().mockResolvedValue({}),
            resendVerification: jest.fn().mockResolvedValue({}),
            changePassword: jest.fn().mockResolvedValue({}),
            deactivateAccount: jest.fn().mockResolvedValue({}),
            deleteAccount: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<SupervisorService>(SupervisorService);
    supervisorRepo = module.get(getRepositoryToken(Supervisor));
    taskSupervisorRepo = module.get(getRepositoryToken(TaskSupervisor));
    attendanceRepo = module.get(getRepositoryToken(Attendance));
    taskWorkerRepo = module.get(getRepositoryToken(TaskWorker));
    supervisorPayoutRepo = module.get(getRepositoryToken(SupervisorPayout));
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('repository helpers', () => {
    it('should find supervisor by email', async () => {
      supervisorRepo.findOne.mockResolvedValue({ id: 1, email: 'sup@example.com' });
      const result = await service.findByEmail('sup@example.com');
      expect(result).toEqual({ id: 1, email: 'sup@example.com' });
      expect(supervisorRepo.findOne).toHaveBeenCalledWith({ where: { email: 'sup@example.com' } });
    });

    it('should find supervisor by id', async () => {
      supervisorRepo.findOne.mockResolvedValue({ id: 2 });
      const result = await service.findById(2);
      expect(result).toEqual({ id: 2 });
      expect(supervisorRepo.findOne).toHaveBeenCalledWith({ where: { id: 2 } });
    });

    it('should validate password correctly', async () => {
      const hashed = await bcrypt.hash('secret', 1);
      const result = await service.validatePassword('secret', { password: hashed });
      expect(result).toBe(true);
    });

    it('should return false if bcrypt compare fails', async () => {
      const hashed = await bcrypt.hash('different', 1);
      const result = await service.validatePassword('secret', { password: hashed });
      expect(result).toBe(false);
    });
  });

  describe('createUser with optional manager', () => {
    it('should use repository when no manager supplied', async () => {
      supervisorRepo.create.mockReturnValue({ email: 'new@sup.com' });
      const result = await service.createUser({ email: 'new@sup.com' } as any);
      expect(supervisorRepo.create).toHaveBeenCalledWith({ email: 'new@sup.com' });
      expect(supervisorRepo.save).toHaveBeenCalled();
      expect(result.email).toBe('new@sup.com');
    });

    it('should use entity manager repository when manager supplied', async () => {
      const manager = { getRepository: jest.fn().mockReturnValue(mockRepoFactory()) } as any;
      const result = await service.createUser({ email: 'mgr@sup.com' } as any, manager);
      expect(manager.getRepository).toHaveBeenCalledWith(Supervisor);
      expect(result.email).toBe('mgr@sup.com');
    });
  });

  describe('verification and reset flows', () => {
    it('should set verification code', async () => {
      await service.setVerificationCode(7, 'code', new Date('2026-04-07'));
      expect(supervisorRepo.update).toHaveBeenCalledWith(7, {
        verificationCode: 'code',
        verificationCodeExpiry: new Date('2026-04-07'),
      });
    });

    it('should clear reset code', async () => {
      await service.clearResetCode(9);
      expect(supervisorRepo.update).toHaveBeenCalledWith(9, {
        resetCode: null,
        resetCodeExpiry: null,
      });
    });
  });

  describe('auth delegation', () => {
    it('should register through authService', async () => {
      const dto = { email: 'sup@domain.com', password: 'pass', confirmPassword: 'pass' } as any;
      await service.register(dto);
      expect(authService.register).toHaveBeenCalledWith(
        { email: 'sup@domain.com', password: 'pass' },
        'Verify you supervisor account.',
        service,
        expect.any(String),
      );
    });

    it('should call verifySupervisor via authService', async () => {
      await service.verifySupervisor('1234', 5);
      expect(authService.verifyUser).toHaveBeenCalledWith('1234', 5, service);
    });

    it('should call resendVerification via authService', async () => {
      await service.resendVerification(8);
      expect(authService.resendVerification).toHaveBeenCalledWith(8, service);
    });

    it('should call changePassword via authService', async () => {
      await service.changePassword(10, { oldPassword: 'old', newPassword: 'new' });
      expect(authService.changePassword).toHaveBeenCalledWith(10, 'old', 'new', service);
    });
  });

  describe('domain operations', () => {
    it('should change status successfully', async () => {
      supervisorRepo.findOne.mockResolvedValue({ id: 12 });
      const result = await service.changeStatus(12, true);
      expect(supervisorRepo.update).toHaveBeenCalledWith(12, { isActive: true });
      expect(result.message).toContain('activated successfully');
    });

    it('should throw if supervisor not found when changing status', async () => {
      supervisorRepo.findOne.mockResolvedValue(null);
      await expect(service.changeStatus(99, true)).rejects.toThrow(NotFoundException);
    });

    it('should fetch all supervisors', async () => {
      supervisorRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const result = await service.getAllSupervisors();
      expect(result.data.supervisors).toHaveLength(2);
      expect(result.message).toBe('Supervisors fetched successfully');
    });

    it('should throw when no supervisors are found', async () => {
      supervisorRepo.find.mockResolvedValue(null);
      await expect(service.getAllSupervisors()).rejects.toThrow(NotFoundException);
    });

    it('should get supervisor by id', async () => {
      supervisorRepo.findOne.mockResolvedValue({ id: 20 });
      const result = await service.getSupervisorById(20);
      expect(result.data.supervisor.id).toBe(20);
    });

    it('should throw when supervisor by id not found', async () => {
      supervisorRepo.findOne.mockResolvedValue(null);
      await expect(service.getSupervisorById(21)).rejects.toThrow(NotFoundException);
    });

    it('should edit profile successfully', async () => {
      const supervisor = { id: 22, firstName: 'Old' } as any;
      supervisorRepo.findOne.mockResolvedValue(supervisor);
      supervisorRepo.save.mockResolvedValue({ ...supervisor, firstName: 'New' });
      const result = await service.editProfile(22, { firstName: 'New' } as any);
      expect(supervisorRepo.save).toHaveBeenCalledWith(supervisor);
      expect(result.data.supervisor.firstName).toBe('New');
    });

    it('should throw when editing missing profile', async () => {
      supervisorRepo.findOne.mockResolvedValue(null);
      await expect(service.editProfile(99, { firstName: 'New' } as any)).rejects.toThrow(NotFoundException);
    });

    it('should upload profile image and remove old file', async () => {
      const existingPath = `${process.cwd()}/tmp-supervisor-image.png`;
      fs.writeFileSync(existingPath, 'content');
      const supervisor = { id: 33, profileImage: existingPath } as any;
      supervisorRepo.findOne.mockResolvedValue(supervisor);
      supervisorRepo.save.mockResolvedValue({ ...supervisor, profileImage: '/tmp/new-image.png' });

      const result = await service.updateProfileImage(33, '/tmp/new-image.png');
      expect(supervisorRepo.save).toHaveBeenCalledWith({ ...supervisor, profileImage: '/tmp/new-image.png' });
      expect(result.profileImage).toBe('/tmp/new-image.png');
      expect(fs.existsSync(existingPath)).toBe(false);
    });

    it('should throw when uploading image for missing supervisor', async () => {
      supervisorRepo.findOne.mockResolvedValue(null);
      await expect(service.updateProfileImage(99, '/tmp/new.png')).rejects.toThrow(NotFoundException);
    });
  });

  describe('attendance upload', () => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 1);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 1);

    it('should upload attendance successfully', async () => {
      const assignment = {
        task: {
          id: 100,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      } as any;

      taskSupervisorRepo.findOne.mockResolvedValue(assignment);
      attendanceRepo.findOne.mockResolvedValue(null);
      taskWorkerRepo.find.mockResolvedValue([
        {
          worker: { id: 501, fullName: 'Jane Doe' },
        },
      ]);
      attendanceRepo.create.mockImplementation((dto) => dto);
      attendanceRepo.save.mockResolvedValue([{}]);
      taskSupervisorRepo.save.mockResolvedValue(assignment);

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet([
        { workerId: 501, checkIn: '08:00', checkOut: '16:00', status: 'PRESENT' },
      ]);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const result = await service.uploadAttendance(100, 55, { buffer } as any);
      expect(result.recordsCount).toBe(1);
      expect(result.message).toContain('Attendance uploaded successfully');
      expect(taskSupervisorRepo.save).toHaveBeenCalled();
    });

    it('should throw if supervisor not assigned to task', async () => {
      taskSupervisorRepo.findOne.mockResolvedValue(null);
      await expect(service.uploadAttendance(100, 55, { buffer: Buffer.alloc(0) } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when attendance already uploaded today', async () => {
      taskSupervisorRepo.findOne.mockResolvedValue({ task: { startDate, endDate } } as any);
      attendanceRepo.findOne.mockResolvedValue({});
      await expect(service.uploadAttendance(100, 55, { buffer: Buffer.alloc(0) } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('dashboard and task queries', () => {
    it('should build dashboard summary', async () => {
      taskSupervisorRepo.find.mockResolvedValue([
        { task: { status: TaskStatusEnum.IN_PROGRESS, id: 1, startDate: '2026-05-01', eventName: 'A', location: 'X' } },
        { task: { status: TaskStatusEnum.COMPLETED, id: 2, startDate: '2026-04-01', eventName: 'B', location: 'Y' } },
        { task: { status: TaskStatusEnum.PENDING, id: 3, startDate: '2026-06-01', eventName: 'C', location: 'Z' } },
      ]);
      supervisorPayoutRepo.find.mockResolvedValue([
        { amount: '100.5', status: PayoutStatusEnum.PAID },
        { amount: 200, status: PayoutStatusEnum.PAID },
      ]);

      const result = await service.getDashboard(55);
      expect(result.totalTasks).toBe(3);
      expect(result.currentTasks).toBe(1);
      expect(result.completedTasks).toBe(1);
      expect(result.upcomingTasks).toBe(1);
      expect(result.totalEarnings).toBe(300.5);
      expect(result.nextTask.id).toBe(3);
    });

    it('should return my tasks with optional status filter', async () => {
      taskSupervisorRepo.find.mockResolvedValue([
        {
          task: {
            id: 40,
            eventName: 'Task A',
            location: 'Loc',
            startDate: '2026-05-10',
            endDate: '2026-05-12',
            status: TaskStatusEnum.IN_PROGRESS,
            requiredWorkers: 5,
            durationHoursPerDay: 8,
            workerLevel: { levelName: 'Junior' },
          },
          supervisorBonus: 250,
          whatsAppGroupLink: 'http://chat',
        },
      ]);

      const result = await service.getMyTasks(55, TaskStatusEnum.IN_PROGRESS);
      expect(result.count).toBe(1);
      expect(result.tasks[0].workerLevel).toBe('Junior');
      expect(result.tasks[0].supervisorBonus).toBe(250);
    });
  });

  describe('attendance template and task details', () => {
    it('should generate attendance template', async () => {
      const assignment = { task: { id: 11 } } as any;
      taskSupervisorRepo.findOne.mockResolvedValue(assignment);
      taskWorkerRepo.find.mockResolvedValue([
        { worker: { id: 1, fullName: 'A Worker' } },
        { worker: { id: 2, fullName: 'B Worker' } },
      ]);

      const result = await service.getAttendanceTemplate(55, 11);
      expect(result.fileName).toContain('attendance_task_11_');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should throw when attendance template assignment is missing', async () => {
      taskSupervisorRepo.findOne.mockResolvedValue(null);
      await expect(service.getAttendanceTemplate(55, 11)).rejects.toThrow(NotFoundException);
    });

    it('should throw when no confirmed workers for template', async () => {
      taskSupervisorRepo.findOne.mockResolvedValue({ task: { id: 11 } } as any);
      taskWorkerRepo.find.mockResolvedValue([]);
      await expect(service.getAttendanceTemplate(55, 11)).rejects.toThrow(BadRequestException);
    });

    it('should return task details for supervisor', async () => {
      taskSupervisorRepo.findOne.mockResolvedValue({
        task: {
          id: 22,
          eventName: 'Event',
          location: 'Loc',
          startDate: '2026-05-01',
          endDate: '2026-05-02',
          requiredWorkers: 10,
          requiredSupervisors: 2,
          workerLevel: { id: 1, levelName: 'Senior' },
          workerTypes: [{ id: 99 }],
          durationHoursPerDay: 8,
          requiredWorkerStatus: 'OPEN',
          supervisingFees: 500,
        },
        supervisorBonus: 80,
        whatsAppGroupLink: 'http://chat',
      } as any);

      const result = await service.getTaskDetailsForSupervisor(22, 55);
      expect(result.id).toBe(22);
      expect(result.financials.supervisingFees).toBe(500);
    });

    it('should throw when task details assignment missing', async () => {
      taskSupervisorRepo.findOne.mockResolvedValue(null);
      await expect(service.getTaskDetailsForSupervisor(22, 55)).rejects.toThrow(NotFoundException);
    });
  });
});
