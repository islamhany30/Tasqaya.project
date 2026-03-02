import { Cron, CronExpression } from '@nestjs/schedule';
import { Task } from '../../entities/Task';
import { TaskApprovalStatusEnum } from '../../Enums/task-approval.enum';
import { TaskStatusEnum } from '../../Enums/task-status.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';

@Injectable()
export class TaskSchedulerService {
  constructor(
    @InjectRepository(Task) private taskRepo: Repository<Task>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTaskStatusUpdates() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // تحديث كل الـ PENDING اللي تاريخها جه لـ IN_PROGRESS
    await this.taskRepo.createQueryBuilder()
      .update(Task)
      .set({ status: TaskStatusEnum.IN_PROGRESS })
      .where("startDate <= :today", { today })
      .andWhere("status = :pending", { pending: TaskStatusEnum.PENDING })
      .andWhere("approvalStatus = :approved", { approved: TaskApprovalStatusEnum.APPROVED })
      .execute();

    // بالمرة: تحديث كل الـ IN_PROGRESS اللي تاريخها خلص لـ COMPLETED
    await this.taskRepo.createQueryBuilder()
      .update(Task)
      .set({ status: TaskStatusEnum.COMPLETED })
      .where("endDate < :today", { today })
      .andWhere("status = :inProgress", { inProgress: TaskStatusEnum.IN_PROGRESS })
      .execute();
  }
}