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

    // ───────── 1. PENDING → IN_PROGRESS
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

    // ───────── 2. IN_PROGRESS → COMPLETED
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

    // جلب المهام التي اكتملت بالأمس (لاحظ تغيير التسمية لـ payment مفرد)
    const justCompletedTasks = await this.taskRepo.find({
      where: {
        endDate: yesterday as any,
        status: TaskStatusEnum.COMPLETED,
        approvalStatus: TaskApprovalStatusEnum.APPROVED,
      },
      relations: ['company', 'payment'], 
    });

    if (!justCompletedTasks.length) return;

    // ───────── 3. SEND PAYMENT REMINDERS
    for (const task of justCompletedTasks) {
      const p = task.payment;

      // التأكد من أن حالة الدفع هي PartiallyPaid (تم دفع العربون فقط)
      if (p && p.status === PaymentStatusEnum.PARTIALLY_PAID && task.company?.email) {
        try {
          await this.mailService.sendMail({
            to: task.company.email,
            subject: `🎉 Task Accomplished: ${task.eventName} - Taskaya`,
            html: `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: ltr; text-align: left; padding: 30px; border: 1px solid #f0f0f0; border-radius: 10px; max-width: 600px; margin: auto;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #27ae60;">Task Successfully Completed!</h2>
                </div>
                <p>Dear Partners at <strong>${task.company.name}</strong>,</p>
                <p>We are pleased to inform you that the task <strong>"${task.eventName}"</strong> has been successfully completed. Our team has finalized all requirements and attendance records.</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #3498db; margin: 25px 0; border-radius: 4px;">
                  <h3 style="margin-top: 0; color: #2c3e50;">Payment Summary:</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #7f8c8d;">Total Contract Amount:</td>
                      <td style="padding: 8px 0; text-align: right;"><strong>${p.totalAmount} EGP</strong></td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #7f8c8d;">Deposit Paid:</td>
                      <td style="padding: 8px 0; text-align: right;"><strong>${p.depositAmount} EGP</strong></td>
                    </tr>
                    <tr style="border-top: 1px solid #ddd;">
                      <td style="padding: 15px 0; color: #2c3e50; font-weight: bold;">Remaining Balance:</td>
                      <td style="padding: 15px 0; text-align: right; color: #e74c3c; font-size: 1.2em;"><strong>${p.remainingAmount} EGP</strong></td>
                    </tr>
                  </table>
                </div>
                <p>To ensure timely payouts for workers and supervisors, please settle the remaining balance by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://taskaya.app/dashboard/payments/${p.id}" 
                     style="display: inline-block; padding: 15px 35px; background-color: #3498db; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                     Settle Remaining Balance
                  </a>
                </div>
                <p style="font-size: 0.9em; color: #95a5a6; line-height: 1.6;">
                    Need help? Reply to this email or visit our support center.<br>
                    Thank you for choosing <strong>Taskaya</strong>.
                </p>
                <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;">
                <p style="text-align: center; font-size: 0.8em; color: #bdc3c7;">
                    &copy; 2026 Taskaya Platform. All rights reserved.
                </p>
              </div>
            `,
          });
          this.logger.log(`Payment reminder sent to ${task.company.email}`);
        } catch (error) {
          this.logger.error(`Failed to send email to ${task.company.email}: ${error.message}`);
        }
      }
    }

    // ───────── 4. WORKER UPDATES (Reliability, Scores, Levels)
    const taskIds = justCompletedTasks.map(t => t.id);

    const allLevels = await this.workerLevelRepo.find({
      order: { minScore: 'ASC' },
    });

    const taskWorkers = await this.taskWorkerRepo.find({
      where: {
        task: { id: In(taskIds) },
        confirmationStatus: WorkerConfirmationStatusEnum.CONFIRMED,
      },
      relations: ['worker', 'worker.level', 'task'],
    });

    const workerIds = [...new Set(taskWorkers.map(tw => tw.worker.id))];

    const attendanceCounts = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .select('attendance.workerId', 'workerId')
      .addSelect('attendance.taskId', 'taskId')
      .addSelect('COUNT(*)', 'count')
      .where('attendance.taskId IN (:...taskIds)', { taskIds })
      .andWhere('attendance.status = :status', {
        status: AttendanceStatusEnum.PRESENT,
      })
      .groupBy('attendance.workerId')
      .addGroupBy('attendance.taskId')
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

      const totalDays =
        Math.ceil(
          (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;

      const presentDays = attendanceMap.get(`${worker.id}-${task.id}`) || 0;
      const currentTaskRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
      const completedTasksCount = completedMap.get(worker.id) || 1;
      const previousTasks = completedTasksCount - 1;
      const oldAvg = worker.reliabilityRate || 0;

      const newAvg =
        previousTasks > 0
          ? (oldAvg * previousTasks + currentTaskRate) / (previousTasks + 1)
          : currentTaskRate;

      const allAbsent = presentDays === 0 && totalDays > 0;
      const scoreChange = allAbsent ? -5 : 5;
      const newScore = Math.max(0, (worker.score || 0) + scoreChange);

      const newLevel =
        allLevels
          .filter(l => l.minScore !== null && newScore >= l.minScore)
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