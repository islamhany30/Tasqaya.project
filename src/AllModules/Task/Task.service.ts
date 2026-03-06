import { Injectable, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { Task } from '../../entities/Task';
import { WorkerLevel } from '../../entities/WorkerLevel'; 
import { CreateTaskDto } from './Dto/Create.task.dto';
import { TaskApprovalStatusEnum } from '../../Enums/task-approval.enum';
import { TaskStatusEnum } from '../../Enums/task-status.enum';
import { UpdateTaskDto } from './Dto/Update.task.dto';
import { PaymentService } from '../Payment/Payment.service';
import { SystemConfig } from '../../entities/SystemConfig';
import { CompanyFeedback } from '../../entities/CompanyFeedback';
import { CreateFeedbackDto } from '../Company/Dto/create-feedback.dto';
import { PaymentStatusEnum } from '../../Enums/payment-status.enum';
import { WorkerType } from '../../entities/WorkerType';
import { TaskWorkerType } from '../../entities/TaskWorkerType';
import { Payment } from '../../entities/Payment';
import { WorkerConfirmationStatusEnum } from '../../Enums/worker-confirmation.enum';
import { MailService } from '../../Mail/MailService';
import { TaskSupervisor } from '../../entities/TaskSupervisor';
import { TaskWorker } from '../../entities/TaskWorker';
import { requiredWorkersStatusEnum } from '../../Enums/required-workers.enum';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,

    @InjectRepository(WorkerLevel)
    private readonly levelRepo: Repository<WorkerLevel>,
    @InjectRepository(SystemConfig)
    private readonly systemconfig: Repository<SystemConfig>,
    @InjectRepository(CompanyFeedback)
    private readonly feedbackRepo: Repository<CompanyFeedback>,
    @InjectRepository(WorkerType)
    private readonly workerTypeRepo: Repository<WorkerType>,
    @InjectRepository(TaskWorkerType)
    private readonly taskWorkerTypeRepo: Repository<TaskWorkerType>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(TaskSupervisor)
    private readonly taskSupervisorRepo: Repository<TaskSupervisor>,
    @InjectRepository(TaskWorker)
    private readonly taskWorkerRepo: Repository<TaskWorker>,


    private readonly paymentService: PaymentService,
    private readonly mailService: MailService

  ) {}
async createTaskByCompany(dto: CreateTaskDto, companyId: number) {
  const startDate = new Date(dto.startDate);
  const endDate = new Date(dto.endDate);
  const today = new Date();

  const minStartDate = new Date();
  minStartDate.setDate(today.getDate() + 7);
  if (startDate < minStartDate) {
    throw new BadRequestException('StartDate must be at least 7 days from today');
  }

  if (endDate < startDate) {
    throw new BadRequestException('EndDate cannot be earlier than StartDate');
  }

  const levelData = await this.levelRepo.findOne({ where: { levelName: dto.workerLevel } });
  if (!levelData) {
    throw new NotFoundException('Worker Level not found in database');
  }

  const diffTime = endDate.getTime() - startDate.getTime();
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const totalHoursPerWorker = dto.durationHoursPerDay * totalDays;


  let requiredSupervisors = Math.ceil(dto.requiredWorkers * 0.10);

      if (!dto.requiredWorkers || dto.requiredWorkers <= 0) {
      throw new BadRequestException(
        'Invalid requiredWorkers value. It must be greater than 0 to recalculate task requirements.'
      );
    }
  
  if (dto.requiredWorkers > 0 && requiredSupervisors === 0) {
    requiredSupervisors = 1;
  }

  const config = await this.systemconfig.findOne({ where: { id: 1 } }); 
  const supervisorBonus = config?.globalSupervisorBouns || 400;
  const feePercent = config?.platformFeePercentage || 0.15;
  const totalSupervisorsCost = requiredSupervisors * supervisorBonus;

  const baseWorkersCost = dto.requiredWorkers * totalHoursPerWorker * levelData.companyHourlyRate ;

  const platformFee = baseWorkersCost * feePercent; 

  const totalCost = baseWorkersCost + totalSupervisorsCost + platformFee;

const task = this.taskRepo.create({
    eventName: dto.eventName,
    location: dto.location,
    startDate: startDate,
    endDate: endDate,
    durationHoursPerDay: dto.durationHoursPerDay,
    requiredWorkers: dto.requiredWorkers,
    hasUniform: dto.hasUniform,
    uniformDescription: dto.uniformDescription,

    company: { id: companyId } ,
    workerLevel: levelData,
    requiredSupervisors: requiredSupervisors,
    baseWorkersCost: baseWorkersCost,
    supervisingFees:totalSupervisorsCost,
    platformFee: platformFee,
    totalCost: totalCost,
    genders:dto.gender,

    approvalStatus: TaskApprovalStatusEnum.PENDING,
    status: TaskStatusEnum.UNAPPROVED,
  });
  
const savedTask = await this.taskRepo.save(task);

  if (dto.workerTypes && dto.workerTypes.length > 0) {
    const workerTypesEntities = await this.workerTypeRepo.find({
      where: { typeName: In(dto.workerTypes) },
    });

    if (workerTypesEntities.length !== dto.workerTypes.length) {
  throw new NotFoundException('One or more worker types not found');
  }

    const taskWorkerTypesEntries = workerTypesEntities.map(wt => {
      return this.taskWorkerTypeRepo.create({
        taskId: savedTask, 
        workerTypeId: wt, 
      });
    });

    await this.taskWorkerTypeRepo.save(taskWorkerTypesEntries);
  }

  return savedTask;
}

async approveTaskByCompany(taskId: number, companyId: number) {
    const task = await this.taskRepo.findOne({ 
      where: { id: taskId, company: { id: companyId } } 
    });

    if (!task) throw new NotFoundException('Task not found');

    const today = new Date();
    const startDate = new Date(task.startDate);
    
    const diffInTime = startDate.getTime() - today.getTime();
    const diffInDays = diffInTime / (1000 * 3600 * 24);

    if (diffInDays < 7) {
      throw new BadRequestException('Cannot approve task; approval must be at least 7 days before the start date');
    }

    task.approvalStatus = TaskApprovalStatusEnum.APPROVED;
    task.status = TaskStatusEnum.PENDING; 

    await this.taskRepo.save(task);

    await this.paymentService.createInitialInvoice(task, companyId);

    return {
      message: 'Task approved successfully.',
      taskId: task.id,
      estimatedTotal: task.totalCost
    };
}

async getCompanyApprovedTasks(companyId: number) {
  return await this.taskRepo.find({
    where: { 
      company: { id: companyId },
      approvalStatus: TaskApprovalStatusEnum.APPROVED 
    },
    relations: ['payment'],
    select: {
      id: true,
      eventName: true,
      startDate: true,
      totalCost: true,
      status: true, 
      payment: {
        status: true
      }
    },
    order: { createdAt: 'DESC' }, 
  });
}

async getCompanyTasksByStatus(companyId: number, status: TaskStatusEnum) {
  return await this.taskRepo.find({
    where: {
      company: { id: companyId },
      approvalStatus: TaskApprovalStatusEnum.APPROVED, 
      status: status
    },
    order: { createdAt: 'DESC' },
  });
}


async getTaskDetailsForCompany(taskId: number, companyId: number) {
  const task = await this.taskRepo.findOne({
    where: { id: taskId, company: { id: companyId },approvalStatus: TaskApprovalStatusEnum.APPROVED },
    relations: ['payment', 'workerLevel', 'workerTypes', 'workerTypes.workerTypeId'],  
  });

  if (!task) {
    throw new NotFoundException('Task not found or not yet approved');
  }

  return {
    id: task.id,
    eventName: task.eventName,
    location: task.location,
    startDate: task.startDate,
    endDate: task.endDate,
    startTime: task.startDate,
    endTime: task.endDate,
    requiredworkers:task.requiredWorkers,
    requiredsupervisor:task.requiredSupervisors,
    workerlevel:task.workerLevel,
    workertype:task.workerTypes,
    durationHoursPerDay:task.durationHoursPerDay,
    requiredWorkerStatus:task.requiredWorkerStatus,

    financials: {
      workerBaseCost:task.baseWorkersCost,
      supervisingFees:task.supervisingFees,
      estimatedTotal: task.totalCost,
      paymentstatues: task.payment.status
    },

  };
}

  
async updateTask(taskId: number, companyId: number, dto: UpdateTaskDto) {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, company: { id: companyId } },
      relations: ['workerLevel', 'workerTypes', 'workerTypes.workerTypeId'],
    });

    if (!task) throw new NotFoundException('Task not found');

    if (task.approvalStatus !== TaskApprovalStatusEnum.PENDING) {
      throw new ForbiddenException(`Cannot update task in ${task.approvalStatus} status`);
    }

    const today = new Date();
    
    if (dto.startDate) {
      const newStartDate = new Date(dto.startDate);
      const minAllowedDate = new Date();
      minAllowedDate.setDate(today.getDate() + 7); 

      if (newStartDate < minAllowedDate) {
        throw new BadRequestException('The start date must be at least 7 days from now');
      }
    } else {
        const currentStartDate = new Date(task.startDate);
        const minAllowedDate = new Date();
        minAllowedDate.setDate(today.getDate() + 7);
        if (currentStartDate < minAllowedDate) {
            throw new BadRequestException('Cannot update a task that starts in less than 7 days');
        }
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date(task.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : new Date(task.endDate);
    
    let levelData = task.workerLevel;
    if (dto.workerLevel) {
      const fetchedLevel = await this.levelRepo.findOne({ where: { levelName: dto.workerLevel } });
      if (!fetchedLevel) throw new NotFoundException('New Worker Level not found');
      levelData = fetchedLevel;
    }

    Object.assign(task, dto);
    if (dto.workerLevel) task.workerLevel = levelData;

    if (dto.workerTypes) {
      if (task.workerTypes && task.workerTypes.length > 0) {
        await this.taskWorkerTypeRepo.remove(task.workerTypes);
      }

      const newWorkerTypesEntities = await this.workerTypeRepo.find({
        where: { typeName: In(dto.workerTypes) },
      });

      if (newWorkerTypesEntities.length !== dto.workerTypes.length) {
    throw new NotFoundException('One or more worker types not found');
    }

      task.workerTypes = newWorkerTypesEntities.map(wt => {
        return this.taskWorkerTypeRepo.create({
          taskId: task,
          workerTypeId: wt,
        });
      });
    }

    if (dto.gender) {
      task.genders = dto.gender;
    }

    if (!dto.requiredWorkers || dto.requiredWorkers <= 0) {
  throw new BadRequestException(
    'Invalid requiredWorkers value. It must be greater than 0 to recalculate task requirements.'
  );
}
    if (dto.requiredWorkers || dto.durationHoursPerDay || dto.startDate || dto.endDate || dto.workerLevel) {
      const diffTime = endDate.getTime() - startDate.getTime();
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      let requiredSupervisors = Math.ceil(task.requiredWorkers * 0.10);
      if (task.requiredWorkers > 0 && requiredSupervisors === 0) {
        requiredSupervisors = 1;
      }

      const config = await this.systemconfig.findOne({ where: { id: 1 } });
      const supervisorBonus = config?.globalSupervisorBouns || 400;
      const feePercent = config?.platformFeePercentage || 0.15;

      const totalSupervisorsCost = requiredSupervisors * supervisorBonus;
      const totalHours = task.durationHoursPerDay * totalDays;
      const baseWorkersCost = task.requiredWorkers * totalHours * levelData.companyHourlyRate;
      const platformFee = baseWorkersCost * feePercent;

      task.requiredSupervisors = requiredSupervisors;
      task.supervisingFees = totalSupervisorsCost;
      task.baseWorkersCost = baseWorkersCost;
      task.platformFee = platformFee;
      task.totalCost = baseWorkersCost + totalSupervisorsCost + platformFee;
    }

    const updatedTask = await this.taskRepo.save(task);

    return {
      message: 'Task updated successfully.',
      task: updatedTask,
    };
  }


async deleteTaskByCompany(taskId: number, companyId: number) {
  const task = await this.taskRepo.findOne({
    where: { id: taskId, company: { id: companyId } }
  });

  if (!task) {
    throw new NotFoundException('Task not found');
  }

  if (task.approvalStatus !== TaskApprovalStatusEnum.PENDING) {
    throw new ForbiddenException(
      `Cannot delete task. It has already been ${task.approvalStatus.toLowerCase()}`
    );
  }
  
  await this.taskRepo.remove(task);

  return {
    message: "Task deleted successfully."
  };
}

async submitTaskFeedback(TaskID,dto: CreateFeedbackDto, companyId: number) {
  const task = await this.taskRepo.findOne({
    where: { 
      id: TaskID, 
      company: { id: companyId } 
    },
    select: ['id', 'endDate']
  });

  if (!task) {
    throw new NotFoundException('Task not found or does not belong to this company');
  }

  const now = new Date();
  if (new Date(task.endDate) > now) {
    throw new BadRequestException('Cannot provide feedback for a task that has not ended yet');
  }

  const existingFeedback = await this.feedbackRepo.findOne({
    where: { task: { id: TaskID } }
  });
  
  if (existingFeedback) {
    throw new BadRequestException('Feedback has already been submitted for this task');
  }

  const feedback = this.feedbackRepo.create({
    task: { id: TaskID },
    company: { id: companyId },
    rating: dto.Rating,
    comment: dto.Comment,
  });

  try {
    const savedFeedback = await this.feedbackRepo.save(feedback);

    return {
      message: "Feedback submitted successfully.",
      feedback: {
        FeedbackID: savedFeedback.id,
        Rating: savedFeedback.rating,
        CreatedAt: savedFeedback.createdAt
      }
    };
  } catch (error) {
    throw new InternalServerErrorException('An error occurred while saving feedback');
  }
}

async getCompanyFeedbacks(companyId: number) {
  const feedbacks = await this.feedbackRepo.find({
    where: { company: { id: companyId } },
    relations: ['task'],
    order: { createdAt: 'DESC' }
  });

  const totalRating = feedbacks.reduce((sum, f) => sum + f.rating, 0);
  const averageRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

  return {
    feedbacks: feedbacks.map(f => ({
      FeedbackID: f.id,
      TaskID: f.task?.id,
      EventName: f.task?.eventName,
      Rating: f.rating,
      Comment: f.comment,
      CreatedAt: f.createdAt,
    })),
    total: feedbacks.length,
    averageRating: Number(averageRating.toFixed(1)) 
  };
}

async getCompanyDashboardStats(companyId: number) {
  const taskStats = await this.taskRepo.createQueryBuilder('task')
    .select('task.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .addSelect('SUM(task.requiredWorkers)', 'workersCount')
    .where('task.companyId = :companyId', { companyId })
    .andWhere('task.approvalStatus = :approved', { approved: TaskApprovalStatusEnum.APPROVED })
    .groupBy('task.status')
    .getRawMany();

  const stats = {
    [TaskStatusEnum.PENDING]: 0,
    [TaskStatusEnum.IN_PROGRESS]: 0,
    [TaskStatusEnum.COMPLETED]: 0,
    totalWorkersUsed: 0
  };

  taskStats.forEach(s => {
    stats[s.status] = parseInt(s.count);
    if (s.status === TaskStatusEnum.COMPLETED) {
      stats.totalWorkersUsed = parseInt(s.workersCount) || 0;
    }
  });

  const paymentStats = await this.paymentRepo.createQueryBuilder('payment')
    .select('payment.status', 'status')
    .addSelect('SUM(payment.totalAmount)', 'total')
    .where('payment.companyId = :companyId', { companyId })
    .groupBy('payment.status')
    .getRawMany();

  const totalSpent = paymentStats.find(p => p.status === PaymentStatusEnum.PAID)?.total || 0;
  const pendingPayments = paymentStats.find(p => p.status === PaymentStatusEnum.PENDING)?.total || 0;

  const avgResult = await this.feedbackRepo.createQueryBuilder('f')
    .select('AVG(f.rating)', 'avg')
    .where('f.companyId = :companyId', { companyId })
    .getRawOne();

  const upcomingTasks = await this.taskRepo.find({
    where: { 
      company: { id: companyId }, 
      startDate: MoreThan(new Date()),
      approvalStatus: TaskApprovalStatusEnum.APPROVED 
    },
    relations: ['taskWorkers'], 
    order: { startDate: 'ASC' },
    take: 3
  });

  return {
    TotalTasks: Object.values(TaskStatusEnum).reduce((acc, status) => acc + (stats[status] || 0), 0),
    ActiveTasks: stats[TaskStatusEnum.IN_PROGRESS],
    CompletedTasks: stats[TaskStatusEnum.COMPLETED],
    PendingTasks: stats[TaskStatusEnum.PENDING], 
    TotalSpent: Number(parseFloat(totalSpent).toFixed(2)),
    PendingPayments: Number(parseFloat(pendingPayments).toFixed(2)),
    AverageRating: Number(parseFloat(avgResult?.avg || 0).toFixed(1)),
    TotalWorkersUsed: stats.totalWorkersUsed,
    UpcomingTasks: upcomingTasks.map(t => ({
      TaskID: t.id,
      EventName: t.eventName,
      StartDate: t.startDate,
      RequiredWorkers: t.requiredWorkers,
      AssignedWorkers: t.taskWorkers?.length || 0
    }))
  };
}

async getPendingCompanyTasks(companyId: number): Promise<Task[]> {
  return await this.taskRepo.find({
    where: { 
      company: { id: companyId }, 
      approvalStatus: TaskApprovalStatusEnum.PENDING 
    },
    order: { createdAt: 'DESC' },
  });
}

// task.service.ts

async saveWhatsAppLinkAndNotify(taskId: number, link: string) {
  const taskAssignment = await this.taskSupervisorRepo.findOne({
    where: { task: { id: taskId } },
    relations: ['task']
  });

  if (!taskAssignment) {
    throw new NotFoundException('You are not assigned as a supervisor for this task');
  }

  taskAssignment.whatsAppGroupLink = link;
  taskAssignment.whatsAppLinkAddedAt = new Date();
  await this.taskSupervisorRepo.save(taskAssignment);

  // 2. جلب كل العمال الـ Confirmed لإرسال اللينك لهم
  const confirmedWorkers = await this.taskWorkerRepo.find({
    where: { 
      task: { id: taskId }, 
      confirmationStatus: WorkerConfirmationStatusEnum.CONFIRMED 
    },
    relations: ['worker']
  });

  // 3. إرسال الإيميلات للعمال (اللوب)
  const emailPromises = confirmedWorkers.map(tw => {
    if (tw.worker?.email) {
      return this.mailService.sendMail({
        to: tw.worker.email,
        subject: `WhatsApp Group Ready: ${taskAssignment.task.eventName}`,
        html: `
          <div style="direction: ltr; font-family: Arial; padding: 20px; border: 1px solid #1a73e8; border-radius: 8px;">
            <h2 style="color: #1a73e8;">Hello ${tw.worker.fullName}!</h2>
            <p>The WhatsApp group for <b>${taskAssignment.task.eventName}</b> is now active.</p>
            <p>Please click the button below to join the team coordination group:</p>
            <a href="${link}" style="display: inline-block; background: #25D366; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Join WhatsApp Group
            </a>
          </div>
        `
      });
    }
  });

  await Promise.all(emailPromises);

  return { success: true, message: 'Link updated and workers notified' };
}

// task.service.ts

async getConfirmedWorkers(taskId: number, companyId: number) {
  const task = await this.taskRepo.findOne({
    where: { 
      id: taskId, 
      company: { id: companyId },
      requiredWorkerStatus: requiredWorkersStatusEnum.COMPLETED 
    },
  });

  if (!task) {
    throw new BadRequestException(
      'Task not found, does not belong to your company'
    );
  }

  const confirmedWorkers = await this.taskWorkerRepo.find({
    where: { 
      task: { id: taskId },
      confirmationStatus: WorkerConfirmationStatusEnum.CONFIRMED 
    },
    relations: ['worker'], 
  });

  return confirmedWorkers.map(tw => ({
    id: tw.worker.id,
    fullName: tw.worker.fullName,
    profilePicture: tw.worker.profileImage || 'default-avatar-url',
  }));
}

}