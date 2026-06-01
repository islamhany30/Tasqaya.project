import { Cron, CronExpression } from '@nestjs/schedule';
import { Task } from '../../entities/Task';
import { Worker } from '../../entities/Worker';
import { Attendance } from '../../entities/Attendance';
import { TaskWorker } from '../../entities/TaskWorker';
import { WorkerLevel } from '../../entities/WorkerLevel';
import { TaskApprovalStatusEnum } from '../../Enums/task-approval.enum';
import { TaskStatusEnum } from '../../Enums/task-status.enum';
import { AttendanceStatusEnum } from '../../Enums/attendance-status.enum';
import { WorkerConfirmationStatusEnum } from '../../Enums/worker-confirmation.enum';
import { PaymentStatusEnum } from '../../Enums/payment-status.enum'; 
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { MailService } from '../../Mail/MailService'; 

@Injectable()
export class TaskSchedulerService {
  private readonly logger = new Logger(TaskSchedulerService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,

    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,

    @InjectRepository(TaskWorker)
    private readonly taskWorkerRepo: Repository<TaskWorker>,

    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,

    @InjectRepository(WorkerLevel)
    private readonly workerLevelRepo: Repository<WorkerLevel>,

    private readonly mailService: MailService, 
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTaskStatusUpdates() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. PENDING → IN_PROGRESS
    await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ status: TaskStatusEnum.IN_PROGRESS })
      .where('startDate <= :today', { today })
      .andWhere('status = :pending', { pending: TaskStatusEnum.PENDING })
      .andWhere('approvalStatus = :approved', {
        approved: TaskApprovalStatusEnum.APPROVED,
      })
      .execute();

    // 2. IN_PROGRESS → COMPLETED
    await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ status: TaskStatusEnum.COMPLETED })
      .where('endDate < :today', { today })
      .andWhere('status = :inProgress', {
        inProgress: TaskStatusEnum.IN_PROGRESS,
      })
      .execute();

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const justCompletedTasks = await this.taskRepo.find({
      where: {
        endDate: yesterday as any,
        status: TaskStatusEnum.COMPLETED,
        approvalStatus: TaskApprovalStatusEnum.APPROVED,
      },
      relations: ['company', 'payment'], 
    });

    if (!justCompletedTasks.length) return;

    // 3. SEND PAYMENT REMINDERS
    for (const task of justCompletedTasks) {
      const p = task.payment;
      if (p && p.status === PaymentStatusEnum.PARTIALLY_PAID && task.company?.email) {
        try {
          await this.mailService.sendMail({
            to: task.company.email,
            subject: `🎉 Task Accomplished: ${task.eventName} - Taskaya`,
            html: `...`, // (تم اختصار الـ HTML للحفاظ على نظافة الكود)
          });
          this.logger.log(`Payment reminder sent to ${task.company.email}`);
        } catch (error) {
          this.logger.error(`Failed to send email to ${task.company.email}: ${error.message}`);
        }
      }
    }

    // 4. WORKER UPDATES
    const taskIds = justCompletedTasks.map(t => t.id);
    const allLevels = await this.workerLevelRepo.find({ order: { minScore: 'ASC' } });

    const taskWorkers = await this.taskWorkerRepo.find({
      where: {
        task: { id: In(taskIds) },
        confirmationStatus: WorkerConfirmationStatusEnum.CONFIRMED,
      },
      relations: ['worker', 'worker.level', 'task'],
    });

    const workerIds = [...new Set(taskWorkers.map(tw => tw.worker.id))];

    // التعديل هنا: استخدام العلاقات بدلاً من الأعمدة المباشرة
    const attendanceCounts = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoin('attendance.worker', 'worker')
      .leftJoin('attendance.task', 'task')
      .select('worker.id', 'workerId')
      .addSelect('task.id', 'taskId')
      .addSelect('COUNT(*)', 'count')
      .where('task.id IN (:...taskIds)', { taskIds })
      .andWhere('attendance.status = :status', {
        status: AttendanceStatusEnum.PRESENT,
      })
      .groupBy('worker.id')
      .addGroupBy('task.id')
      .getRawMany();

    const attendanceMap = new Map<string, number>();
    attendanceCounts.forEach(row => {
      attendanceMap.set(`${row.workerId}-${row.taskId}`, Number(row.count));
    });

    const completedCounts = await this.taskWorkerRepo
      .createQueryBuilder('tw')
      .leftJoin('tw.task', 'task')
      .select('tw.workerId', 'workerId')
      .addSelect('COUNT(*)', 'count')
      .where('tw.workerId IN (:...workerIds)', { workerIds })
      .andWhere('tw.confirmationStatus = :status', {
        status: WorkerConfirmationStatusEnum.CONFIRMED,
      })
      .andWhere('task.status = :completed', {
        completed: TaskStatusEnum.COMPLETED,
      })
      .groupBy('tw.workerId')
      .getRawMany();

    const completedMap = new Map<number, number>();
    completedCounts.forEach(r => {
      completedMap.set(Number(r.workerId), Number(r.count));
    });

    for (const tw of taskWorkers) {
      const worker = tw.worker;
      const task = tw.task;

      const taskStart = new Date(task.startDate);
      const taskEnd = new Date(task.endDate);

      const totalDays = Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const presentDays = attendanceMap.get(`${worker.id}-${task.id}`) || 0;
      
      const currentTaskRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
      const completedTasksCount = completedMap.get(worker.id) || 1;
      const previousTasks = completedTasksCount - 1;
      const oldAvg = worker.reliabilityRate || 0;

      const newAvg = previousTasks > 0 ? (oldAvg * previousTasks + currentTaskRate) / (previousTasks + 1) : currentTaskRate;
      const allAbsent = presentDays === 0 && totalDays > 0;
      const scoreChange = allAbsent ? -5 : 5;
      const newScore = Math.max(0, (worker.score || 0) + scoreChange);

      const newLevel = allLevels.filter(l => l.minScore !== null && newScore >= l.minScore)
                                .sort((a, b) => b.minScore - a.minScore)[0] || worker.level;

      await this.workerRepo.update(worker.id, {
        reliabilityRate: Math.min(parseFloat(newAvg.toFixed(2)), 99.99),
        completedTasks: completedTasksCount,
        score: newScore,
        level: newLevel,
      });
    }
  }
}
