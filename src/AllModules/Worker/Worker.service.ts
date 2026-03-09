import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import { Worker } from 'src/entities/Worker';
import { JobPost } from 'src/entities/JobPost';
import { Application } from 'src/entities/Application';
import { Task } from 'src/entities/Task';
import { CreateWorkerDto } from './Dto/CreateWorker.dto';
import { UpdateWorkerDto } from './Dto/UpdateWorker.dto';
import { PaginationDto } from './Dto/PaginationDto';
import { GetWorkerJobsQueryDto } from './Dto/GetWorkerJobsQueryDto';
import { CreateApplicationDto } from './Dto/CreateApplicationDto';
import { UserRole } from 'src/Enums/User.role';
import { JobPostStatusEnum } from 'src/Enums/job-post-status.enum';
import { ApplicationStatusEnum } from 'src/Enums/application-status.enum';
import { IAuthUser } from 'src/Auth/interfaces/IAuthUser.interface';
import { AuthService } from 'src/Auth/Auth.service';
import { TaskService } from '../Task/Task.service';

@Injectable()
export class WorkerService implements IAuthUser {
  constructor(
    @InjectRepository(Worker) private readonly workerRepository: Repository<Worker>,
    @InjectRepository(JobPost) private readonly jobPostRepository: Repository<JobPost>,
    @InjectRepository(Application) private readonly applicationRepository: Repository<Application>,
    @InjectRepository(Task) private readonly taskRepository: Repository<Task>,
    private readonly taskService: TaskService,
    private readonly authService: AuthService,
  ) {}

  async findByEmail(email: string): Promise<any> {
    return await this.workerRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<any> {
    return await this.workerRepository.findOne({ where: { id } });
  }

  async validatePassword(plainText: string, user: any): Promise<boolean> {
    try {
      return await bcrypt.compare(plainText, user.password);
    } catch {
      return false;
    }
  }

  async createUser(data: Partial<Worker>): Promise<any> {
    const admin = this.workerRepository.create(data);
    return await this.workerRepository.save(admin);
  }

  async verifyUser(userId: number): Promise<void> {
    await this.workerRepository.update(userId, {
      isVerified: true,
      verificationCode: null,
      verificationCodeExpiry: null,
    });
  }

  async setVerificationCode(userId: number, code: string, expiry: Date): Promise<void> {
    await this.workerRepository.update(userId, {
      verificationCode: code,
      verificationCodeExpiry: expiry,
    });
  }

  async setResetCode(email: string, code: string, expiry: Date): Promise<void> {
    await this.workerRepository.update(
      { email },
      {
        resetCode: code,
        resetCodeExpiry: expiry,
      },
    );
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.workerRepository.update(userId, {
      password: hashedPassword,
    });
  }

  async clearResetCode(userId: number): Promise<void> {
    await this.workerRepository.update(userId, {
      resetCode: null,
      resetCodeExpiry: null,
    });
  }

  async deactivateUser(userId: number): Promise<any> {
    await this.workerRepository.update(userId, {
      isActive: false,
    });
  }

  async deleteUser(userId: number): Promise<any> {
    await this.workerRepository.delete(userId);
  }

  //~~~~~~~~~~~~~~~~DELEGATIONS TO AUTH SERVICE BY PASSING this KEYWORD~~~~~~~~~~~~~~~~~~~~~

  async register(dto: CreateWorkerDto): Promise<any> {
    const { confirmPassword, ...rest } = dto;
    return this.authService.register(rest, 'A verification code sent to you by email', this, UserRole.WORKER);
  }

  async verifyWorker(code: string, workerId: number): Promise<any> {
    return this.authService.verifyUser(code, workerId, this);
  }

  async resendVerification(workerId: number): Promise<any> {
    return this.authService.resendVerification(workerId, this);
  }

  async login(dto: { email: string; password: string }): Promise<any> {
    return this.authService.login(dto.email, dto.password);
  }

  async forgotPassword(dto: { email: string }): Promise<any> {
    return this.authService.forgotPassword(dto.email);
  }

  async verifyResetCode(dto: { email: string; code: string }): Promise<any> {
    const account = await this.authService['accountRepo'].findOne({ where: { email: dto.email } });

    if (!account) throw new NotFoundException('User not found');

    return this.authService.verifyResetCode(account.id, dto.code);
  }

  async resetPassword(dto: { email: string; newPassword: string }): Promise<any> {
    const account = await this.authService['accountRepo'].findOne({ where: { email: dto.email } });
    if (!account) throw new NotFoundException('User not found');
    return this.authService.resetPassword(account.id, dto.newPassword);
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

  //~~~~~~~~~~~~~~~~~~~~~WORKER DOMAIN SPECIFIC LOGIC~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  async changeStatus(workerId: number, isActive: boolean): Promise<any> {
    const worker = await this.findById(workerId);

    if (!worker) throw new NotFoundException('User not found');

    await this.workerRepository.update(workerId, { isActive });

    return {
      message: `Worker account has been ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }

  //For Admins
  async getAllWorkers(): Promise<any> {
    const workers = await this.workerRepository.find();

    if (!workers) throw new NotFoundException('Workers not found');

    return {
      message: 'Workers fetched successfully',
      data: {
        workers,
      },
    };
  }

  async getWorkerById(workerId: number): Promise<any> {
    const worker = await this.findById(workerId);

    if (!worker) throw new NotFoundException('User not found');

    return {
      message: 'Worker profile fetched successfully',
      data: {
        worker,
      },
    };
  }

  async editProfile(workerId: number, dto: UpdateWorkerDto): Promise<any> {
    const worker = await this.findById(workerId);

    if (!worker) throw new NotFoundException('User not found');

    Object.keys(dto).forEach((key) => {
      if (dto[key] !== undefined) worker[key] = dto[key];
    });

    await this.workerRepository.save(worker);

    return {
      message: 'Worker profile updated successfully',
      data: {
        worker,
      },
    };
  }

  async uploadProfileImage(workerId: number, newImagePath: string): Promise<any> {
    const worker = await this.findById(workerId);

    if (!worker) throw new NotFoundException('User not found');

    if (worker.profileImage && fs.existsSync(worker.profileImage)) {
      fs.unlinkSync(worker.profileImage);
    }

    worker.profileImage = newImagePath;
    this.workerRepository.save(worker);

    return {
      message: 'Profile image updated successfully',
      profileImage: newImagePath,
    };
  }

  // ==================== JOB BROWSING & APPLICATION METHODS ====================

  async getAvailableJobs(workerId: number, query: GetWorkerJobsQueryDto): Promise<any> {
    // Fetch worker to get level and gender
    const worker = await this.workerRepository.findOne({
      where: { id: workerId },
      relations: ['level'],
    });

    if (!worker) throw new NotFoundException('Worker not found');

    // Build QueryBuilder query
    let queryBuilder = this.jobPostRepository
      .createQueryBuilder('jp') // job post alias
      .innerJoinAndSelect('jp.task', 'task') // join task
      .innerJoinAndSelect('task.workerLevel', 'level') // join worker level
      .leftJoin('applications', 'app', 'app.jobPostId = jp.id AND app.workerId = :workerId', { workerId }) // left join to check if current worker has applied
      .addSelect('COUNT(DISTINCT appCount.id)', 'applicationsCount') // count total applications for each job post
      .leftJoin('applications', 'appCount', 'appCount.jobPostId = jp.id'); // join again for counting total applications

    // Base filters
    queryBuilder = queryBuilder
      .where('jp.status = :status', { status: JobPostStatusEnum.OPEN })
      .andWhere('jp.deadline > :now', { now: new Date() });

    // Optional filters
    if (query.workerLevelId) {
      queryBuilder = queryBuilder.andWhere('task.workerLevelId = :levelId', { levelId: query.workerLevelId });
    }

    if (query.genders && query.genders.length > 0) {
      // Match gender - check if job genders match filter
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          query.genders!.forEach((gender, index) => {
            if (index === 0) {
              qb.where('FIND_IN_SET(:gender' + index + ', task.genders) > 0', { ['gender' + index]: gender });
            } else {
              qb.orWhere('FIND_IN_SET(:gender' + index + ', task.genders) > 0', { ['gender' + index]: gender });
            }
          });
        }),
      );
    }

    if (query.startDate) {
      queryBuilder = queryBuilder.andWhere('task.startDate >= :startDate', { startDate: query.startDate });
    }

    if (query.endDate) {
      queryBuilder = queryBuilder.andWhere('task.endDate <= :endDate', { endDate: query.endDate });
    }

    if (query.keyword) {
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('task.eventName LIKE :keyword', { keyword: `%${query.keyword}%` }).orWhere(
            'task.location LIKE :keyword',
            {
              keyword: `%${query.keyword}%`,
            },
          );
        }),
      );
    }

    // Apply sorting
    queryBuilder = queryBuilder.orderBy(`jp.${query.sortBy}`, query.sortDirection).groupBy('jp.id');

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder = queryBuilder.skip(query.offset).take(query.limit);

    const jobPosts = await queryBuilder.getRawMany();

    // Transform results to JobListResponseDto format
    // Note: getRawMany returns raw database results, so we need to map them to our desired format
    const jobs = jobPosts.map((jp) => ({
      id: jp.jp_id,
      eventName: jp.task_eventName,
      location: jp.task_location,
      startDate: jp.task_startDate,
      endDate: jp.task_endDate,
      requiredWorkers: jp.task_requiredWorkers,
      durationHoursPerDay: jp.task_durationHoursPerDay,
      status: jp.jp_status,
      deadline: jp.jp_deadline,
      publishedAt: jp.jp_publishedAt,
      workerLevel: {
        id: jp.level_id,
        levelName: jp.level_levelName,
        workerHourlyRate: jp.level_workerHourlyRate,
      },
      genders: jp.task_genders ? jp.task_genders.split(',') : [],
      workersApplied: parseInt(jp.applicationsCount) || 0,
      hasUserApplied: !!jp.app_id,
    }));

    const totalPages = Math.ceil(total / query.limit); //

    return {
      message: 'Available jobs fetched successfully',
      data: {
        jobs,
        pagination: {
          total,
          limit: query.limit,
          offset: query.offset,
          totalPages,
        },
      },
    };
  }

  async applyForJob(workerId: number, dto: CreateApplicationDto): Promise<any> {
    // Validate worker exists and is verified
    const worker = await this.workerRepository.findOne({
      where: { id: workerId },
      relations: ['level'],
    });

    if (!worker) throw new NotFoundException('Worker not found');
    if (!worker.isVerified) throw new BadRequestException('Worker account is not verified');
    if (!worker.isActive) throw new BadRequestException('Worker account is deactivated');

    // Validate jobPost exists
    const jobPost = await this.jobPostRepository.findOne({
      where: { id: dto.jobPostId },
      relations: ['task', 'task.workerLevel'],
    });

    if (!jobPost) throw new NotFoundException('Job post not found');

    // Check jobPost status and deadline
    if (jobPost.status !== JobPostStatusEnum.OPEN) {
      throw new BadRequestException('This job post is no longer open for applications');
    }

    if (jobPost.deadline < new Date()) {
      throw new BadRequestException('The application deadline for this job has passed');
    }

    // Check for duplicate application
    const existingApp = await this.applicationRepository.findOne({
      where: { jobPost: { id: dto.jobPostId }, worker: { id: workerId } },
    });

    if (existingApp) throw new BadRequestException("You've already applied for this job");

    // Validate worker level matches
    if (worker.level.id !== jobPost.task.workerLevel.id) {
      throw new BadRequestException('Your worker level does not match the job requirements');
    }

    // Validate worker gender matches
    const genders = Array.isArray(jobPost.task.genders)
      ? jobPost.task.genders
      : jobPost.task.genders
        ? String(jobPost.task.genders).split(',')
        : [];
    if (genders.length > 0 && !genders.includes(worker.gender)) {
      throw new BadRequestException('Your gender does not match the job requirements');
    }

    // Check if max allowed workers reached
    const applicationCount = await this.applicationRepository.count({
      where: { jobPost: { id: dto.jobPostId } },
    });

    if (applicationCount >= jobPost.maxAllowedWorkers * 2.5) {
      //Save the last application
      const lastApplication = this.applicationRepository.create();

      lastApplication.jobPost = jobPost;
      lastApplication.worker = worker;
      lastApplication.status = ApplicationStatusEnum.PENDING;
      lastApplication.appliedAt = new Date();

      await this.applicationRepository.save(lastApplication);

      //Trigger the filter feature from task service
      await this.taskService.filterJobPostWorkers(jobPost.id);

      //Throw exception message
      throw new BadRequestException('This job post has reached the maximum number of applications');
    }

    // Create application
    const application = this.applicationRepository.create({
      jobPost,
      worker,
      status: ApplicationStatusEnum.PENDING,
      appliedAt: new Date(),
    });

    await this.applicationRepository.save(application);

    // Return application with job details
    const savedApp = await this.applicationRepository.findOne({
      where: { id: application.id },
      relations: ['jobPost', 'jobPost.task', 'jobPost.task.workerLevel'],
    });

    if (!savedApp) throw new NotFoundException('Failed to retrieve created application');

    const taskGenders = Array.isArray(savedApp.jobPost.task.genders)
      ? savedApp.jobPost.task.genders
      : savedApp.jobPost.task.genders
        ? String(savedApp.jobPost.task.genders).split(',')
        : [];

    return {
      message: 'Successfully applied for the job',
      data: {
        application: {
          id: savedApp.id,
          jobPostId: savedApp.jobPost.id,
          workerId: savedApp.worker.id,
          status: savedApp.status,
          appliedAt: savedApp.appliedAt,
          jobPost: {
            id: savedApp.jobPost.id,
            eventName: savedApp.jobPost.task.eventName,
            location: savedApp.jobPost.task.location,
            startDate: savedApp.jobPost.task.startDate,
            endDate: savedApp.jobPost.task.endDate,
            requiredWorkers: savedApp.jobPost.task.requiredWorkers,
            durationHoursPerDay: savedApp.jobPost.task.durationHoursPerDay,
            status: savedApp.jobPost.status,
            deadline: savedApp.jobPost.deadline,
            publishedAt: savedApp.jobPost.publishedAt,
            workerLevel: {
              id: savedApp.jobPost.task.workerLevel.id,
              levelName: savedApp.jobPost.task.workerLevel.levelName,
              workerHourlyRate: savedApp.jobPost.task.workerLevel.workerHourlyRate,
            },
            genders: taskGenders,
          },
        },
      },
    };
  }

  async getMyApplications(workerId: number, pagination: PaginationDto = new PaginationDto()): Promise<any> {
    const worker = await this.workerRepository.findOne({ where: { id: workerId } });

    if (!worker) throw new NotFoundException('Worker not found');

    // Get total count
    const total = await this.applicationRepository.count({
      where: { worker: { id: workerId } },
    });

    // Fetch applications with pagination
    const applications = await this.applicationRepository.find({
      where: { worker: { id: workerId } },
      relations: ['jobPost', 'jobPost.task', 'jobPost.task.workerLevel'],
      order: { appliedAt: 'DESC' },
      skip: pagination.offset,
      take: pagination.limit,
    });

    // Transform to response format
    const appResponses = applications.map((app) => {
      const taskGenders = Array.isArray(app.jobPost.task.genders)
        ? app.jobPost.task.genders
        : app.jobPost.task.genders
          ? String(app.jobPost.task.genders).split(',')
          : [];

      return {
        id: app.id,
        jobPostId: app.jobPost.id,
        workerId: app.worker.id,
        status: app.status,
        appliedAt: app.appliedAt,
        jobPost: {
          id: app.jobPost.id,
          eventName: app.jobPost.task.eventName,
          location: app.jobPost.task.location,
          startDate: app.jobPost.task.startDate,
          endDate: app.jobPost.task.endDate,
          requiredWorkers: app.jobPost.task.requiredWorkers,
          durationHoursPerDay: app.jobPost.task.durationHoursPerDay,
          status: app.jobPost.status,
          deadline: app.jobPost.deadline,
          publishedAt: app.jobPost.publishedAt,
          workerLevel: {
            id: app.jobPost.task.workerLevel.id,
            levelName: app.jobPost.task.workerLevel.levelName,
            workerHourlyRate: app.jobPost.task.workerLevel.workerHourlyRate,
          },
          genders: taskGenders,
        },
      };
    });

    const totalPages = Math.ceil(total / pagination.limit);

    return {
      message: 'Your applications fetched successfully',
      data: {
        applications: appResponses,
        pagination: {
          total,
          limit: pagination.limit,
          offset: pagination.offset,
          totalPages,
        },
      },
    };
  }

  async withdrawApplication(applicationId: number, workerId: number): Promise<any> {
    // Validate application exists
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['worker', 'jobPost'],
    });

    if (!application) throw new NotFoundException('Application not found');

    // Validate worker owns this application
    if (application.worker.id !== workerId) {
      throw new ForbiddenException('You can only withdraw your own applications');
    }

    // Validate application is still pending
    if (application.status !== ApplicationStatusEnum.PENDING) {
      throw new BadRequestException('Cannot withdraw an application that has already been reviewed');
    }

    // Delete application
    await this.applicationRepository.delete(applicationId);

    return {
      message: 'Application withdrawn successfully',
    };
  }
}
