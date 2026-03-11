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
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';

@Injectable()
export class TaskSchedulerService {
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
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTaskStatusUpdates() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── 1. تحديث PENDING → IN_PROGRESS ──────────────────────────────────────
    await this.taskRepo.createQueryBuilder()
      .update(Task)
      .set({ status: TaskStatusEnum.IN_PROGRESS })
      .where('startDate <= :today', { today })
      .andWhere('status = :pending', { pending: TaskStatusEnum.PENDING })
      .andWhere('approvalStatus = :approved', { approved: TaskApprovalStatusEnum.APPROVED })
      .execute();

    // ── 2. تحديث IN_PROGRESS → COMPLETED ────────────────────────────────────
    await this.taskRepo.createQueryBuilder()
      .update(Task)
      .set({ status: TaskStatusEnum.COMPLETED })
      .where('endDate < :today', { today })
      .andWhere('status = :inProgress', { inProgress: TaskStatusEnum.IN_PROGRESS })
      .execute();

    // ── 3. حساب reliabilityRate + score + level للعمال في التاسكات اللي خلصت امبارح
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const justCompletedTasks = await this.taskRepo.find({
      where: {
        endDate: yesterday as any,
        status: TaskStatusEnum.COMPLETED,
        approvalStatus: TaskApprovalStatusEnum.APPROVED,
      },
    });

    // جيب كل الـ levels مرة واحدة بره الـ loop عشان منعملش query متكررة
    const allLevels = await this.workerLevelRepo.find({
      order: { minScore: 'ASC' },
    });

    for (const task of justCompletedTasks) {
      const taskStart = new Date(task.startDate);
      const taskEnd   = new Date(task.endDate);
      const totalDays = Math.ceil(
        (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      const taskWorkers = await this.taskWorkerRepo.find({
        where: {
          task: { id: task.id },
          confirmationStatus: WorkerConfirmationStatusEnum.CONFIRMED,
        },
        relations: ['worker', 'worker.level'],
      });

      for (const tw of taskWorkers) {
        const worker = tw.worker;

        // ── حساب الـ reliabilityRate ─────────────────────────────────────────
        const presentDays = await this.attendanceRepo.count({
          where: {
            task:   { id: task.id },
            worker: { id: worker.id },
            status: AttendanceStatusEnum.PRESENT,
          },
        });

        const currentTaskRate = totalDays > 0
          ? (presentDays / totalDays) * 100
          : 0;

        const completedTasksCount = await this.taskWorkerRepo.count({
          where: {
            worker:             { id: worker.id },
            confirmationStatus: WorkerConfirmationStatusEnum.CONFIRMED,
            task:               { status: TaskStatusEnum.COMPLETED },
          },
        });

        const oldAvg = worker.reliabilityRate || 0;
        const n      = completedTasksCount;
        const newAvg = n > 1
          ? ((oldAvg * (n - 1)) + currentTaskRate) / n
          : currentTaskRate;

        // ── حساب الـ score ───────────────────────────────────────────────────
        // غاب كل الأيام → -5 | حضر ولو يوم → +5
        const allAbsent   = presentDays === 0 && totalDays > 0;
        const scoreChange = allAbsent ? -5 : 5;
        const newScore    = Math.max(0, (worker.score || 0) + scoreChange);

        // ── شيك على الترقية للـ level المناسب ───────────────────────────────
        const newLevel = allLevels
          .filter(l => l.minScore !== null && newScore >= l.minScore)
          .sort((a, b) => b.minScore - a.minScore)[0] || worker.level;

        // ── تحديث الـ worker ─────────────────────────────────────────────────
        await this.workerRepo.update(worker.id, {
          reliabilityRate: Math.min(parseFloat(newAvg.toFixed(2)), 99.99),
          completedTasks:  n,
          score:           newScore,
          level:           newLevel,
        });
      }
    }
  }
}