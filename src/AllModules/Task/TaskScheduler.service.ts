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
import { Repository, In } from 'typeorm';

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

    const justCompletedTasks = await this.taskRepo.find({
      where: {
        endDate: yesterday as any,
        status: TaskStatusEnum.COMPLETED,
        approvalStatus: TaskApprovalStatusEnum.APPROVED,
      },
    });

    if (!justCompletedTasks.length) return;

    const taskIds = justCompletedTasks.map(t => t.id);

    const allLevels = await this.workerLevelRepo.find({
      order: { minScore: 'ASC' },
    });

    // ───────── Workers in these tasks
    const taskWorkers = await this.taskWorkerRepo.find({
      where: {
        task: { id: In(taskIds) },
        confirmationStatus: WorkerConfirmationStatusEnum.CONFIRMED,
      },
      relations: ['worker', 'worker.level', 'task'],
    });

    const workerIds = [...new Set(taskWorkers.map(tw => tw.worker.id))];

    // ───────── Attendance grouped
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

    // ───────── completed tasks count per worker
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

      const presentDays =
        attendanceMap.get(`${worker.id}-${task.id}`) || 0;

      const currentTaskRate =
        totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

      const completedTasksCount =
        completedMap.get(worker.id) || 1;

      const previousTasks = completedTasksCount - 1;

      const oldAvg = worker.reliabilityRate || 0;

      const newAvg =
        previousTasks > 0
          ? (oldAvg * previousTasks + currentTaskRate) /
            (previousTasks + 1)
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