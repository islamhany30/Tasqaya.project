import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import { Supervisor } from '../../entities/Supervisor';
import { CreateSupervisorDto } from './Dto/CreateSupervisor.dto';
import { UserRole } from 'src/Enums/User.role';
import { IAuthUser } from 'src/Auth/interfaces/IAuthUser.interface';
import { AuthService } from 'src/Auth/Auth.service';
import { updateSupervisorDto } from './Dto/UpdateSupervisor.dto';
import { TaskSupervisor } from 'src/entities/TaskSupervisor';
import { Attendance } from 'src/entities/Attendance';
import { TaskWorker } from 'src/entities/TaskWorker';
import * as XLSX from 'xlsx';
import { AttendanceStatusEnum } from 'src/Enums/attendance-status.enum';
import { WorkerConfirmationStatusEnum } from 'src/Enums/worker-confirmation.enum';
import { TaskStatusEnum } from 'src/Enums/task-status.enum';
import { PayoutStatusEnum } from 'src/Enums/payout-status.enum';
import { SupervisorPayout } from 'src/entities/SupervisorPayout';
import { CloudinaryService } from 'src/Cloudinary/cloudinary.service';

@Injectable()
export class SupervisorService implements IAuthUser {
  constructor(
    @InjectRepository(Supervisor) private readonly supervisorRepository: Repository<Supervisor>,
    private readonly authService: AuthService,
    @InjectRepository(TaskSupervisor)
    private readonly taskSupervisorRepo: Repository<TaskSupervisor>,

    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,

    @InjectRepository(TaskWorker)
    private readonly taskWorkerRepo: Repository<TaskWorker>,

    @InjectRepository(SupervisorPayout)
    private readonly supervisorPayoutRepo: Repository<SupervisorPayout>,

    private readonly cloudinaryService:CloudinaryService
  ) {}

  async findByEmail(email: string): Promise<any> {
    return await this.supervisorRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<any> {
    return await this.supervisorRepository.findOne({ where: { id } });
  }

  async validatePassword(plainText: string, user: any): Promise<boolean> {
    try {
      return await bcrypt.compare(plainText, user.password);
    } catch {
      return false;
    }
  }

  async createUser(data: Partial<Supervisor>, manager?: EntityManager): Promise<any> {
    const repo = manager ? manager.getRepository(Supervisor) : this.supervisorRepository;
    const company = repo.create(data);
    return await repo.save(company);
  }

  async verifyUser(userId: number): Promise<void> {
    await this.supervisorRepository.update(userId, {
      isVerified: true,
      verificationCode: null,
      verificationCodeExpiry: null,
    });
  }

  async setVerificationCode(userId: number, code: string, expiry: Date): Promise<void> {
    await this.supervisorRepository.update(userId, {
      verificationCode: code,
      verificationCodeExpiry: expiry,
    });
  }

  async setResetCode(email: string, code: string, expiry: Date): Promise<void> {
    await this.supervisorRepository.update(
      { email },
      {
        resetCode: code,
        resetCodeExpiry: expiry,
      },
    );
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.supervisorRepository.update(userId, {
      password: hashedPassword,
    });
  }

  async clearResetCode(userId: number): Promise<void> {
    await this.supervisorRepository.update(userId, {
      resetCode: null,
      resetCodeExpiry: null,
    });
  }

  async deactivateUser(userId: number): Promise<any> {
    await this.supervisorRepository.update(userId, {
      isActive: false,
    });
  }

  async deleteUser(userId: number): Promise<any> {
    await this.supervisorRepository.delete(userId);
  }

  //~~~~~~~~~~~~~~~~DELEGATIONS TO AUTH BY PASSING this KEYWORD~~~~~~~~~~~~~~~~~~~~~
  async register(dto: CreateSupervisorDto): Promise<any> {
    const { confirmPassword, ...rest } = dto;
    return this.authService.register(rest, 'Verify you supervisor account.', this, UserRole.SUPERVISOR);
  }

  async verifySupervisor(code: string, supervisorId: number): Promise<any> {
    return this.authService.verifyUser(code, supervisorId, this);
  }

  async resendVerification(supervisorId: number): Promise<any> {
    return this.authService.resendVerification(supervisorId, this);
  }

  async changePassword(supervisorId: number, dto: { oldPassword: string; newPassword: string }): Promise<any> {
    return this.authService.changePassword(supervisorId, dto.oldPassword, dto.newPassword, this);
  }

  async deactivateAccount(supervisorId: number, dto: { password: string }): Promise<any> {
    return this.authService.deactivateAccount(supervisorId, dto.password, this);
  }

  async deleteAccount(supervisorId: number, dto: { password: string }): Promise<any> {
    return this.authService.deleteAccount(supervisorId, dto.password, this);
  }

  //~~~~~~~~~~~~~~~~~~~SUPERVISOR DOMAIN SPECIFIC LOGIC~~~~~~~~~~~~~~~~~~~~~~~
  async changeStatus(supervisorId: number, isActive: boolean): Promise<any> {
    const supervisor = await this.findById(supervisorId);

    if (!supervisor) throw new NotFoundException('Supervisor not found');

    await this.supervisorRepository.update(supervisorId, { isActive });

    return {
      message: `Supervisor account has been ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }

  async getAllSupervisors(): Promise<any> {
    const supervisors = await this.supervisorRepository.find();

    if (!supervisors) throw new NotFoundException('Supervisors are not found');

    return {
      message: 'Supervisors fetched successfully',
      data: {
        supervisors,
      },
    };
  }

  async getSupervisorById(id: number): Promise<any> {
    const supervisor = await this.findById(id);

    if (!supervisor) throw new NotFoundException('Supervisor not found');

    return {
      message: 'supervisor fetched successfully',
      data: {
        supervisor,
      },
    };
  }

  async editProfile(supervisorId: number, dto: updateSupervisorDto): Promise<any> {
    const supervisor = await this.findById(supervisorId);

    if (!supervisor) throw new NotFoundException('Supervisor is not found');

    Object.keys(dto).forEach((key) => {
      if (dto[key] !== undefined) {
        supervisor[key] = dto[key];
      }
    });

    await this.supervisorRepository.save(supervisor);

    return {
      message: 'Supervisor profile updated successfully!',
      data: {
        supervisor,
      },
    };
  }

  async updateProfileImage(supervisorId: number, imageFile: Express.Multer.File) {
  // 1. التأكد من وجود الشركة
  const supervisor = await this.supervisorRepository.findOne({ where: { id: supervisorId } });
  if (!supervisor) throw new NotFoundException('supervisor not found');

  try {
    // 2. الرفع على Cloudinary (بياخد الـ Buffer من الرامات مباشرة)
    const uploadResult = await this.cloudinaryService.uploadFile(imageFile);
    
    // ملاحظة: لو حابب تمسح القديم من كلوديناري هتحتاج الـ public_id
    // بس حالياً اللينك الجديد هيستبدل القديم في الداتا بيز وده كافي جداً للمشروع
    
    const newImageUrl = uploadResult.secure_url;

    // 3. تحديث المسار في الداتا بيز باللينك الجديد
    supervisor.profileImage = newImageUrl;
    await this.supervisorRepository.save(supervisor);

    return { 
      message: 'supervisor profile image updated successfully', 
      profileImage: newImageUrl 
    };
  } catch (error) {
    throw new BadRequestException('Failed to upload image to Cloudinary');
  }
}

  
      async uploadAttendance(taskId: number, supervisorId: number, file: Express.Multer.File) {
	// 1. التأكد إن الـ supervisor assigned على التاسك دي
	const assignment = await this.taskSupervisorRepo.findOne({
  	where: {
    	task: { id: taskId },
    	supervisor: { id: supervisorId },
  	},
  	relations: ['task'],
	});

	if (!assignment) {
  	throw new NotFoundException('You are not assigned as a supervisor for this task');
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const taskStart = new Date(assignment.task.startDate);
	taskStart.setHours(0, 0, 0, 0);

	const taskEnd = new Date(assignment.task.endDate);
	taskEnd.setHours(0, 0, 0, 0);

	// 2. التأكد إن اليوم ده جوا فترة التاسك
 	if (today < taskStart || today > taskEnd) {
  	throw new BadRequestException('Cannot upload attendance outside the task period');
 	}

	const dateOnly = today.toISOString().split('T')[0]; // "2026-03-07"

	// 3. Check لو الحضور اترفع النهارده قبل كده
	const existingToday = await this.attendanceRepo.findOne({
  	where: {
    	task: { id: taskId },
    	attendanceDate: dateOnly as any,
  	},
	});

	if (existingToday) {
  	throw new BadRequestException('Attendance for today has already been uploaded');
	}

	// 4. parse الـ excel
	const workbook = XLSX.read(file.buffer, { type: 'buffer' });
	const sheet = workbook.Sheets[workbook.SheetNames[0]];
	const rows: any[] = XLSX.utils.sheet_to_json(sheet);

	if (!rows || rows.length === 0) {
  	throw new BadRequestException('Excel file is empty or has invalid format');
	}

	// 5. جيب العمال الـ confirmed للتاسك دي
	const confirmedWorkers = await this.taskWorkerRepo.find({
  	where: {
    	task: { id: taskId },
    	confirmationStatus: WorkerConfirmationStatusEnum.CONFIRMED,
  	},
  	relations: ['worker'],
	});

	if (confirmedWorkers.length === 0) {
  	throw new BadRequestException('No confirmed workers found for this task');
	}

	// بناء Map للوصول السريع للـ worker object كامل
	const workerMap = new Map(confirmedWorkers.map((tw) => [tw.worker.id, tw.worker]));
	const confirmedWorkerIds = new Set(workerMap.keys());

	// 6. بناء الـ attendance records
	const attendanceRecords = rows
  	.filter((row) => confirmedWorkerIds.has(Number(row.workerId)))
  	.map((row) => {
    	const worker = workerMap.get(Number(row.workerId));

    	const dateStr = today.toISOString().split('T')[0];
//     	const checkIn = row.checkIn ? new Date(
// ${dateStr}T${row.checkIn}
// ) : null;
//     	const checkOut = row.checkOut ? new Date(
// ${dateStr}T${row.checkOut}
// ) : null;
		const checkIn = row.checkIn ? new Date(`${dateStr}T${row.checkIn}`) : null;
		const checkOut = row.checkOut ? new Date(`${dateStr}T${row.checkOut}`) : null;

    	const status =
      	row.status?.toUpperCase() === 'PRESENT' ? AttendanceStatusEnum.PRESENT : AttendanceStatusEnum.ABSENT;

    	return this.attendanceRepo.create({
      	task: assignment.task,
      	worker: worker,
      	attendanceDate: today,
      	checkInTime: checkIn,
      	checkOutTime: checkOut,
      	status,
    	});
  	});

	if (attendanceRecords.length === 0) {
  	throw new BadRequestException('No valid worker IDs found in the excel file');
	}

	// 7. حفظ الـ attendance records
	await this.attendanceRepo.save(attendanceRecords);

	// 8. تخزين الـ excel blob في TaskSupervisor للأرشفة
	assignment.attendanceFile = file.buffer;
	assignment.attendanceUploadedAt = new Date();
	await this.taskSupervisorRepo.save(assignment);

	return {
//   	message:
// Attendance uploaded successfully for ${attendanceRecords.length} workers
// ,
	message: `Attendance uploaded successfully for ${attendanceRecords.length} workers`,
  	date: today.toISOString().split('T')[0],
  	recordsCount: attendanceRecords.length,
	};
  }
  // async getMyTasks(supervisorId: number, status?: TaskStatusEnum): Promise<any> {
  //   const assignments = await this.taskSupervisorRepo.find({
  //     where: {
  //       supervisor: { id: supervisorId },
  //       ...(status && { task: { status } }),
  //     },
  //     relations: ['task', 'task.workerLevel'],
  //     order: { task: { startDate: 'ASC' } },
  //   });

  //   const tasks = assignments.map((a) => ({
  //     id: a.task.id,
  //     eventName: a.task.eventName,
  //     location: a.task.location,
  //     startDate: a.task.startDate,
  //     endDate: a.task.endDate,
  //     status: a.task.status,
  //     requiredWorkers: a.task.requiredWorkers,
  //     durationHoursPerDay: a.task.durationHoursPerDay,
  //     workerLevel: a.task.workerLevel?.levelName,
  //     supervisorBonus: a.supervisorBonus,
  //     whatsAppGroupLink: a.whatsAppGroupLink,
  //   }));

  //   return { count: tasks.length, tasks };
  // }

  async getMyTasks(supervisorId: number): Promise<any> {
    const assignments = await this.taskSupervisorRepo.find({
      where: {
        supervisor: { id: supervisorId },
      },
      relations: ['task', 'task.workerLevel'],
      order: { task: { startDate: 'ASC' } },
    });

    const tasks = assignments.map((a) => ({
      id: a.task.id,
      eventName: a.task.eventName,
      location: a.task.location,
      startDate: a.task.startDate,
      endDate: a.task.endDate,
      status: a.task.status,
      requiredWorkers: a.task.requiredWorkers,
      durationHoursPerDay: a.task.durationHoursPerDay,
      workerLevel: a.task.workerLevel?.levelName,
      supervisorBonus: a.supervisorBonus,
      whatsAppGroupLink: a.whatsAppGroupLink,
    }));

    return { count: tasks.length, tasks };
  }

  async getAttendanceTemplate(
  supervisorId: number,
  taskId: number,
): Promise<{ buffer: Buffer; fileName: string }> {
  // ==================================================
  // Validate Supervisor Assignment
  // ==================================================

  const assignment = await this.taskSupervisorRepo.findOne({
    where: {
      task: { id: taskId },
      supervisor: { id: supervisorId },
    },
    relations: ['task'],
  });

  if (!assignment) {
    throw new NotFoundException(
      'You are not assigned as a supervisor for this task',
    );
  }

  // ==================================================
  // Validate Workers Confirmation
  // ==================================================

  const confirmedWorkers =
    await this.taskWorkerRepo.find({
      where: {
        task: { id: taskId },
        confirmationStatus:
          WorkerConfirmationStatusEnum.CONFIRMED,
      },
      relations: ['worker'],
    });

  if (confirmedWorkers.length === 0) {
    throw new BadRequestException(
      'No confirmed workers yet for this task — template not available',
    );
  }

  // ==================================================
  // Create Workbook
  // ==================================================

  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'Tasqaya System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(
    'Attendance',
    {
      views: [
        {
          state: 'frozen',
          ySplit: 1,
        },
      ],
    },
  );

  // ==================================================
  // Columns
  // ==================================================

  worksheet.columns = [
    {
      header: 'workerId',
      key: 'workerId',
      width: 15,
      hidden: true,
    },
    {
      header: 'workerName',
      key: 'workerName',
      width: 30,
    },
    {
      header: 'checkIn',
      key: 'checkIn',
      width: 15,
    },
    {
      header: 'checkOut',
      key: 'checkOut',
      width: 15,
    },
    {
      header: 'status',
      key: 'status',
      width: 20,
    },
  ];

  // ==================================================
  // Header Style
  // ==================================================

  const headerRow = worksheet.getRow(1);

  headerRow.font = {
    bold: true,
    size: 12,
  };

  headerRow.alignment = {
    vertical: 'middle',
    horizontal: 'center',
  };

  headerRow.height = 22;

  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // ==================================================
  // Add Workers
  // ==================================================

  confirmedWorkers.forEach((tw) => {
    worksheet.addRow({
      workerId: tw.worker.id,
      workerName: tw.worker.fullName,
      checkIn: '',
      checkOut: '',
      status: '',
    });
  });

  // ==================================================
  // Auto Filter
  // ==================================================

  worksheet.autoFilter = {
    from: 'A1',
    to: 'E1',
  };

  // ==================================================
  // Notes
  // ==================================================

  worksheet.getCell('A1').note =
    'Internal worker identifier. Do not modify.';

  worksheet.getCell('B1').note =
    'Worker full name (read-only).';

  worksheet.getCell('C1').note =
    'Check-in time (HH:mm e.g. 08:00).';

  worksheet.getCell('D1').note =
    'Check-out time (HH:mm e.g. 17:00).';

  worksheet.getCell('E1').note =
    'Allowed values: PRESENT or ABSENT only.';

  // ==================================================
  // Protection + Validation
  // ==================================================

  for (
    let row = 2;
    row <= worksheet.rowCount;
    row++
  ) {
    // lock IDs + names
    worksheet.getCell(`A${row}`).protection = {
      locked: true,
    };

    worksheet.getCell(`B${row}`).protection = {
      locked: true,
    };

    // unlock editable fields
    worksheet.getCell(`C${row}`).protection = {
      locked: false,
    };

    worksheet.getCell(`D${row}`).protection = {
      locked: false,
    };

    worksheet.getCell(`E${row}`).protection = {
      locked: false,
    };

    // dropdown status
    worksheet.getCell(`E${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"PRESENT,ABSENT"'],
      showErrorMessage: true,
      errorTitle: 'Invalid Status',
      error: 'Choose PRESENT or ABSENT only',
    };
  }

  // ==================================================
  // Protect Sheet
  // ==================================================

  await worksheet.protect(
    process.env.EXCEL_PROTECTION_PASSWORD ||
      'Tasqaya@2026',
    {
      selectLockedCells: true,
      selectUnlockedCells: true,
      autoFilter: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      deleteColumns: false,
      deleteRows: false,
      sort: false,
    },
  );

  // ==================================================
  // Generate File
  // ==================================================

  const buffer = Buffer.from(
    await workbook.xlsx.writeBuffer(),
  );

  const fileName = `attendance_task_${taskId}_${
    new Date().toISOString().split('T')[0]
  }.xlsx`;

  return {
    buffer,
    fileName,
  };
}

  async getTaskDetailsForSupervisor(taskId: number, supervisorId: number) {
    const assignment = await this.taskSupervisorRepo.findOne({
      where: {
        task: { id: taskId },
        supervisor: { id: supervisorId },
      },
      relations: ['task', 'task.workerLevel', 'task.workerTypes', 'task.workerTypes.workerTypeId', 'task.payment'],
    });

    if (!assignment) {
      throw new NotFoundException('Task not found or you are not assigned to it');
    }

    const task = assignment.task;

    return {
      id: task.id,
      eventName: task.eventName,
      location: task.location,
      startDate: task.startDate,
      endDate: task.endDate,
      requiredWorkers: task.requiredWorkers,
      requiredSupervisors: task.requiredSupervisors,
      workerLevel: task.workerLevel,
      workerTypes: task.workerTypes,
      durationHoursPerDay: task.durationHoursPerDay,
      requiredWorkerStatus: task.requiredWorkerStatus,
      supervisorBonus: assignment.supervisorBonus,
      whatsAppGroupLink: assignment.whatsAppGroupLink,

      financials: {
        supervisingFees: task.supervisingFees,
      },
    };

	  
  }

	async getDashboard(supervisorId: number): Promise<any> {
  // 1. جلب كل المهام المسندة للمشرف
  const assignments = await this.taskSupervisorRepo.find({
    where: { supervisor: { id: supervisorId } },
    relations: ['task'],
  });

  const tasks = assignments.map((a) => a.task);

  // 2. حساب إحصائيات المهام
  const totalTasks = tasks.length;
  const currentTasks = tasks.filter((t) => t.status === TaskStatusEnum.IN_PROGRESS).length;
  const completedTasks = tasks.filter((t) => t.status === TaskStatusEnum.COMPLETED).length;
  const upcomingTasks = tasks.filter((t) => t.status === TaskStatusEnum.PENDING).length;

  // 3. حساب إجمالي الأرباح المدفوعة
  const payouts = await this.supervisorPayoutRepo.find({
    where: {
      supervisor: { id: supervisorId },
      status: PayoutStatusEnum.PAID,
    },
  });

  // التأكد من تحويل القيمة لـ Number لتجنب أخطاء الجمع
  const totalEarnings = payouts.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // 4. تحديد المهمة القادمة (أقرب مهمة من حيث تاريخ البدء)
  const nextTask = tasks
    .filter((t) => t.status === TaskStatusEnum.PENDING)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] || null;

  // 5. إرجاع البيانات النهائية
  return {
    totalTasks,
    currentTasks,
    completedTasks,
    upcomingTasks,
    totalEarnings: parseFloat(totalEarnings.toFixed(2)),
    nextTask: nextTask
      ? { 
          id: nextTask.id, 
          eventName: nextTask.eventName, 
          startDate: nextTask.startDate, 
          location: nextTask.location 
        }
      : null,
  };
}

  
}
