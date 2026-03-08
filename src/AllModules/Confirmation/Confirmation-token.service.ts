import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { ConfirmationToken } from '../../entities/confirmationToken';
import { TaskWorker } from '../../entities/TaskWorker';
import { MailService } from '../../Mail/MailService';
import { WorkerConfirmationStatusEnum } from '../../Enums/worker-confirmation.enum';
import { Task } from 'src/entities/Task';
import { Worker } from 'src/entities/Worker';

@Injectable()
export class ConfirmationTokenService {
  private readonly logger = new Logger(ConfirmationTokenService.name);
  private readonly TOKEN_EXPIRY_HOURS = 12;
  private readonly baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

  constructor(
    @InjectRepository(ConfirmationToken)
    private readonly tokenRepo: Repository<ConfirmationToken>,
    @InjectRepository(TaskWorker)
    private readonly taskWorkerRepo: Repository<TaskWorker>,
    private readonly mailService: MailService,
    @InjectQueue('confirmation')
    private readonly confirmationQueue: Queue,
  ) {}

async issueTokenAndNotify(taskWorker: TaskWorker): Promise<void> {

  const worker = taskWorker.worker as any;
  const task = taskWorker.task as any;

  if (!worker) throw new NotFoundException('Worker not found');
  if (!task) throw new NotFoundException('Task not found');
  if (!worker?.email) throw new BadRequestException('Worker email not found');

  // ✅ prevent duplicate active tokens
  const existingToken = await this.tokenRepo.findOne({
    where: {
      Worker: { id: worker.id },
      Task: { id: task.id },
      IsUsed: false,
    },
  });

  if (existingToken && existingToken.ExpiresAt > new Date()) {

    this.logger.warn(
      `Active token exists → worker=${worker.id}, task=${task.id}`,
    );

    return;
  }

  // invalidate expired tokens only
  await this.invalidateOldTokens(worker.id, task.id);

  const token = await this.createToken(worker.id, task.id);

  await this.setPendingStatus(taskWorker.id);

try {

  await this.sendConfirmationEmail(worker, task, token.Token);

} catch (error) {

  this.logger.error(
    `Email failed → worker=${worker.id}, task=${task.id}`,
    error.stack,
  );

  await this.tokenRepo.update(token.TokenID, { IsUsed: true });

  throw new InternalServerErrorException('Failed to send confirmation email');

}
  await this.scheduleAutoDecline(worker.id, task.id);

  this.logger.log(`Confirmation sent → worker=${worker.id}, task=${task.id}`);
}

  private async createToken(workerId: number, taskId: number) {
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    const token = this.tokenRepo.create({
      Worker: { id: workerId },
      Task: { id: taskId },
      Token: uuidv4(),
      ExpiresAt: expiresAt,
      IsUsed: false,
    });

    return this.tokenRepo.save(token);
  }

  private async invalidateOldTokens(workerId: number, taskId: number) {
    const updateResult = await this.tokenRepo.update(
      { Worker: { id: workerId }, Task: { id: taskId }, IsUsed: false },
      { IsUsed: true },
    );

    if (updateResult.affected === 0) {
      this.logger.log(`No old tokens to invalidate for worker=${workerId}, task=${taskId}`);
    }
  }

  private async setPendingStatus(taskWorkerId: number) {
    const updateResult = await this.taskWorkerRepo.update(taskWorkerId, {
      confirmationStatus: WorkerConfirmationStatusEnum.PENDING,
    });

    if (updateResult.affected === 0) {
      throw new NotFoundException(`TaskWorker with id=${taskWorkerId} not found`);
    }
  }

  private async sendConfirmationEmail(worker: Worker, task: Task, token: string) {
    if (!worker.email) throw new BadRequestException(`Worker #${worker.id} has no email`);

    const yesUrl = `${this.baseUrl}/api/confirm/YES/${token}`;
    const noUrl = `${this.baseUrl}/api/confirm/NO/${token}`;

    await this.mailService.sendMail({
      to: worker.email,
      subject: `Task Confirmation Required – ${task.eventName}`,
      html: `
        <div style="font-family: Arial; padding:20px">
          <h2>Task Confirmation Required</h2>
          <p>Hello ${worker.fullName},</p>
          <p>You have been assigned to:</p>
          <ul>
            <li><b>Task:</b> ${task.eventName}</li>
            <li><b>Location:</b> ${task.location}</li>
            <li><b>Start:</b> ${new Date(task.startDate).toLocaleString()}</li>
          </ul>
          <p>Please confirm:</p>
          <a href="${yesUrl}" style="background:green;color:white;padding:12px;text-decoration:none;margin-right:10px;">YES, I ACCEPT</a>
          <a href="${noUrl}" style="background:red;color:white;padding:12px;text-decoration:none;">NO, I DECLINE</a>
          <p style="color:red;margin-top:20px;">You must respond within 12 hours.</p>
        </div>
      `,
    });
  }

  private async scheduleAutoDecline(workerId: number, taskId: number) {
    await this.confirmationQueue.add(
      'auto-decline',
      { workerId, taskId },
      { delay: this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000, removeOnComplete: true },
    );
  }


  async markTokenUsed(tokenId: number): Promise<void> {
    const updateResult = await this.tokenRepo.update(tokenId, { IsUsed: true });
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Token with id=${tokenId} not found`);
    }
  }
}