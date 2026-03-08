import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Task } from '../../entities/Task';
import { TaskWorker } from '../../entities/TaskWorker';
import { JobPost } from '../../entities/JobPost';
import { ConfirmationTokenService } from './Confirmation-token.service';
import { AssignmentTypeEnum } from '../../Enums/assignment-type.enum';
import { WorkerConfirmationStatusEnum } from '../../Enums/worker-confirmation.enum';
import { JobPostStatusEnum } from '../../Enums/job-post-status.enum';

@Injectable()
export class ConfirmationSchedulerService {
  private readonly logger = new Logger(ConfirmationSchedulerService.name);

  private readonly HOURS_BEFORE_EVENT = 48;
  private readonly SCAN_WINDOW_MINUTES = 60;

  constructor(
    @InjectRepository(TaskWorker)
    private readonly taskWorkerRepo: Repository<TaskWorker>,

    @InjectRepository(JobPost)
    private readonly jobPostRepo: Repository<JobPost>,

    private readonly confirmationTokenService: ConfirmationTokenService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // كل ساعة — يدور على التاسكات القادمة بعد 48 ساعة والـ JobPost بتاعها CLOSED
  // ─────────────────────────────────────────────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async scanAndSendConfirmations(): Promise<void> {
    this.logger.log('🔍 Scanning for tasks starting in 48 hours…');

    const now = new Date();
    const windowStart = new Date(now.getTime() + this.HOURS_BEFORE_EVENT * 60 * 60 * 1000);
    const windowEnd = new Date(windowStart.getTime() + this.SCAN_WINDOW_MINUTES * 60 * 1000);

    const jobPosts = await this.jobPostRepo.find({
      where: {
        status: JobPostStatusEnum.CLOSED,
        task: { startDate: Between(windowStart, windowEnd) },
      },
      relations: ['task'],
    });

    if (!jobPosts.length) {
      this.logger.log('No tasks found in the 48-hour window.');
      return;
    }

    this.logger.log(`Found ${jobPosts.length} task(s) — initiating confirmation flow…`);

    for (const jobPost of jobPosts) {
      await this.processTaskWorkers(jobPost.task);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // لكل تاسك: جيب الـ PRIMARY workers وابدأ معاهم الـ Flow
  // ─────────────────────────────────────────────────────────────
  private async processTaskWorkers(task: Task): Promise<void> {
    const primaryWorkers = await this.taskWorkerRepo.find({
      where: {
        task: { id: task.id },
        assignmentType: AssignmentTypeEnum.PRIMARY,
        confirmationStatus: WorkerConfirmationStatusEnum.PENDING,
      },
      relations: ['worker', 'task'],
    });

    if (!primaryWorkers.length) {
      this.logger.log(`Task #${task.id}: No primary workers in pending status.`);
      return;
    }

    for (const worker of primaryWorkers) {
      try {
        await this.confirmationTokenService.issueTokenAndNotify(worker);
      } catch (err) {
        this.logger.error(`Failed to notify worker for task #${task.id}: ${err.message}`);
      }
    }

    this.logger.log(`Task #${task.id}: Processed ${primaryWorkers.length} primary worker(s).`);
  }
}
