import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Admin } from '../../entities/Admin';
import { AuthService } from '../../Auth/Auth.service';
import { IAuthUser } from '../../Auth/interfaces/IAuthUser.interface';
import { UserRole } from '../../Enums/User.role';
import { CompanyService } from '../Company/Company.service';
import { CreateAdminDto } from './Dto/CreateAdmin.dto';
import { UpdateAdminDto } from './Dto/UpdateAdmin.dto';
import * as path from 'path';
import * as fs from 'fs';
import { SupervisorService } from '../Supervisor/Supervisor.service';
import { WorkerService } from '../Worker/Worker.service';
import { GetTasksFilterDto } from '../Task/Dto/GetTasksFilter.dto';
import { TaskService } from '../Task/Task.service';
import { CloudinaryService } from 'src/Cloudinary/cloudinary.service';
// new
import { Task } from '../../entities/Task';
import { TaskWorker } from '../../entities/TaskWorker';
import { AssignmentTypeEnum } from '../../Enums/assignment-type.enum';
import { WorkerConfirmationStatusEnum } from '../../Enums/worker-confirmation.enum';
import { TaskStatusEnum } from '../../Enums/task-status.enum';
import { requiredWorkersStatusEnum } from '../../Enums/required-workers.enum';
import { ConfirmationTokenService } from '../Confirmation/Confirmation-token.service';
import { Attendance } from '../../entities/Attendance';
import { Worker } from '../../entities/Worker';
import { WorkerLevel } from '../../entities/WorkerLevel';
import { AttendanceStatusEnum } from '../../Enums/attendance-status.enum';
@Injectable()
export class AdminService implements IAuthUser {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly authService: AuthService,
    private readonly companyService: CompanyService,
    private readonly supervisorService: SupervisorService,
    private readonly workerService: WorkerService,
    private readonly taskService: TaskService,
    private readonly cloudinaryService:CloudinaryService,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,

    @InjectRepository(TaskWorker)
    private readonly taskWorkerRepo: Repository<TaskWorker>,
    @InjectRepository(Attendance) private readonly attendanceRepo: Repository<Attendance>,
  @InjectRepository(Worker) private readonly workerRepo: Repository<Worker>,
  @InjectRepository(WorkerLevel) private readonly workerLevelRepo: Repository<WorkerLevel>,

    private readonly confirmationTokenService: ConfirmationTokenService,
  ) {}

  //IAuthUser Implementation (called by AuthService)
  async findByEmail(email: string): Promise<any> {
    return this.adminRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<any> {
    return this.adminRepository.findOne({ where: { id } });
  }

  async validatePassword(plainText: string, user: Admin): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(plainText, user.password);
  }

  async createUser(data: Partial<Admin>, manager?: EntityManager): Promise<any> {
    const repo = manager ? manager.getRepository(Admin) : this.adminRepository;
    const admin = repo.create(data);
    return await repo.save(admin);
  }

  // async createUser(data: Partial<Company>, manager?: EntityManager): Promise<any> {
  //     const repo = manager ? manager.getRepository(Company) : this.companyRepository;
  //     const company = repo.create(data);
  //     return await repo.save(company);
  //   }

  async verifyUser(userId: number): Promise<void> {
    await this.adminRepository.update(userId, {
      isVerified: true,
      verificationCode: null,
      verificationCodeExpiry: null,
    });
  }

  async setVerificationCode(userId: number, code: string, expiry: Date): Promise<void> {
    await this.adminRepository.update(userId, {
      verificationCode: code,
      verificationCodeExpiry: expiry,
    });
  }

  async setResetCode(email: string, code: string, expiry: Date): Promise<void> {
    await this.adminRepository.update(
      { email },
      {
        resetCode: code,
        resetCodeExpiry: expiry,
      },
    );
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.adminRepository.update(userId, {
      password: hashedPassword,
    });
  }

  async clearResetCode(userId: number): Promise<void> {
    await this.adminRepository.update(userId, {
      resetCode: null,
      resetCodeExpiry: null,
    });
  }

  async deactivateUser(userId: number): Promise<any> {
    await this.adminRepository.update(userId, {
      isActive: false,
    });
  }

  async deleteUser(userId: number): Promise<any> {
    await this.adminRepository.delete(userId);
  }

  //Delegations -> These will be called by the admin controller
  //Pass (this) as the userService
  async register(dto: CreateAdminDto) {
    const { confirmPassword, ...rest } = dto;
    return this.authService.register(rest, 'Verify your admin account', this, UserRole.ADMIN);
  }

  async verifyAdmin(code: string, adminId: number) {
    return this.authService.verifyUser(code, adminId, this);
  }

  async resendVerification(adminId: number) {
    return this.authService.resendVerification(adminId, this);
  }

  async changePassword(adminId: number, dto: { oldPassword: string; newPassword: string }) {
    return this.authService.changePassword(adminId, dto.oldPassword, dto.newPassword, this);
  }

  //Hard delete
  async deleteAccount(admnId: number, dto: { password: string }) {
    return this.authService.deleteAccount(admnId, dto.password, this);
  }

  // ─── Admin-Specific Domain Logic ──────────────────────────────────

  async getAdmins() {
    const admins = this.adminRepository.find();

    if (!admins) throw new NotFoundException('No Admins is found');

    return {
      message: 'Admins Fetched successfully',
      data: {
        admins,
      },
    };
  }

  async getAdminById(id: number) {
    const admin = await this.adminRepository.findOne({ where: { id } });

    if (!admin) throw new NotFoundException('Admin not found');

    return admin;
  }

  async editProfile(id: number, dto: UpdateAdminDto) {
    const admin = await this.adminRepository.findOne({ where: { id } });

    if (!admin) throw new NotFoundException('Admin not found');

    //Only update fields that are provided in the DTO (allow partial updates)
    //Because i want the other optional fields in the dto if not updated to be in the response as well
    //Because i am using classSerializer, the undefined fields will be excluded from the response, so i want to keep the existing values for those fields in the response
    Object.keys(dto).forEach((key) => {
      if (dto[key] !== undefined) {
        admin[key] = dto[key];
      }
    });

    await this.adminRepository.save(admin);

    return {
      message: 'Admin profile is updated successfully',
      data: {
        admin,
      },
    };
  }

 async updateProfileImage(adminId: number, imageFile: Express.Multer.File) {
  // 1. التأكد من وجود الشركة
  const admin = await this.adminRepository.findOne({ where: { id: adminId } });
  if (!admin) throw new NotFoundException('admin not found');

  try {
    // 2. الرفع على Cloudinary (بياخد الـ Buffer من الرامات مباشرة)
    const uploadResult = await this.cloudinaryService.uploadFile(imageFile);
    
    // ملاحظة: لو حابب تمسح القديم من كلوديناري هتحتاج الـ public_id
    // بس حالياً اللينك الجديد هيستبدل القديم في الداتا بيز وده كافي جداً للمشروع
    
    const newImageUrl = uploadResult.secure_url;

    // 3. تحديث المسار في الداتا بيز باللينك الجديد
    admin.profileImage = newImageUrl;
    await this.adminRepository.save(admin);

    return { 
      message: 'admin profile image updated successfully', 
      profileImage: newImageUrl 
    };
  } catch (error) {
    throw new BadRequestException('Failed to upload image to Cloudinary');
  }
}

  async changeCompanyStatus(id: number, dto: { isActive: boolean }) {
    return this.companyService.changeStatus(id, dto.isActive);
  }

  async getAllCompaniesForAdmin() {
    return this.companyService.getAllCompanies();
  }

  async getCompanyById(id: number) {
    return this.companyService.getCompanyById(id);
  }

  async changeSupervisorStatus(id: number, dto: { isActive: boolean }) {
    return this.supervisorService.changeStatus(id, dto.isActive);
  }

  async getAllSupervisors() {
    return this.supervisorService.getAllSupervisors();
  }

  async getSupervisorById(id: number) {
    return this.supervisorService.getSupervisorById(id);
  }

  async changeWorkerStatus(id: number, dto: { isActive: boolean }) {
    return this.workerService.changeStatus(id, dto.isActive);
  }

  async getWorkerByID(id: number) {
    return this.workerService.getWorkerById(id);
  }

  async getAllWorkers() {
    return this.workerService.getAllWorkers();
  }

  async getAllTasksForAdmin(dto: GetTasksFilterDto) {
    return this.taskService.getAllTasksForAdmin(dto);
  }

  async getTaskDetailsForAdmin(id: number) {
    return this.taskService.getTaskDetailsForAdmin(id);
  }

  async getJobPostApplicantsForAdmin(id: number) {
    return this.taskService.getJobPostApplicants(id);
  }

  async getAdminDashboardStats(): Promise<any> {
    return this.taskService.getAdminDashboardStats();
  }

    // ================= DEMO & MANUAL TRIGGER ENDPOINTS =================

  async filterJobPostForDemo(jobPostId: number) {
    return this.taskService.filterJobPostWorkers(jobPostId);
  }

  async triggerConfirmationForDemo(taskId: number) {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['taskWorkers', 'taskWorkers.worker'],
    });

    if (!task) throw new NotFoundException('Task not found');

    const primaryWorkers = await this.taskWorkerRepo.find({
      where: {
        task: { id: taskId },
        assignmentType: AssignmentTypeEnum.PRIMARY,
        confirmationStatus: WorkerConfirmationStatusEnum.PENDING,
      },
      relations: ['worker', 'task'],
    });

    if (primaryWorkers.length === 0) {
      throw new BadRequestException('No primary pending workers found for this task');
    }

    for (const tw of primaryWorkers) {
      await this.confirmationTokenService.issueTokenAndNotify(tw);
    }

    return {
      message: `✅ Confirmation emails sent to ${primaryWorkers.length} primary workers`,
      taskId,
      count: primaryWorkers.length,
    };
  }

  async startTaskForDemo(taskId: number) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    if (task.status === TaskStatusEnum.IN_PROGRESS) {
      throw new BadRequestException('Task is already in progress');
    }

    task.status = TaskStatusEnum.IN_PROGRESS;
    await this.taskRepo.save(task);

    return {
      message: '🚀 Task started successfully (Demo)',
      taskId,
      newStatus: task.status,
    };
  }

  async completeTaskForDemo(taskId: number) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    if (task.status === TaskStatusEnum.COMPLETED) {
      throw new BadRequestException('Task is already completed');
    }

    task.status = TaskStatusEnum.COMPLETED;
    task.requiredWorkerStatus = requiredWorkersStatusEnum.COMPLETED;
    await this.taskRepo.save(task);
    await this.updateWorkersPerformanceForTask(task);

    return {
      message: '✅ Task completed successfully (Demo)',
      taskId,
      newStatus: task.status,
    };
  }
  async updateWorkersPerformanceForTask(task: Task) {
    const taskWorkers = await this.taskWorkerRepo.find({
      where: { task: { id: task.id }, confirmationStatus: WorkerConfirmationStatusEnum.CONFIRMED },
      relations: ['worker', 'worker.level'],
    });

    const allLevels = await this.workerLevelRepo.find({ order: { minScore: 'ASC' } });

    for (const tw of taskWorkers) {
      const worker = tw.worker;
      const presentDays = await this.attendanceRepo.count({
        where: { taskId: task.id, workerId: worker.id, status: AttendanceStatusEnum.PRESENT }
      });

      const taskStart = new Date(task.startDate);
      const taskEnd = new Date(task.endDate);
      const totalDays = Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const currentTaskRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
      
      const allAbsent = presentDays === 0 && totalDays > 0;
      const scoreChange = allAbsent ? -5 : 5;
      const newScore = Math.max(0, (worker.score || 0) + scoreChange);
      
      const newLevel = allLevels.filter(l => l.minScore !== null && newScore >= l.minScore)
                                .sort((a, b) => b.minScore - a.minScore)[0] || worker.level;

      await this.workerRepo.update(worker.id, {
        reliabilityRate: Math.min(parseFloat(currentTaskRate.toFixed(2)), 99.99),
        completedTasks: (worker.completedTasks || 0) + 1,
        score: newScore,
        level: newLevel,
      });
    }
  }
}

