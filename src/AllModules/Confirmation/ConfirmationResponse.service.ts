import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfirmationToken } from '../../entities/confirmationToken';
import { TaskWorker } from '../../entities/TaskWorker';
import { WorkerConfirmationStatusEnum } from '../../Enums/worker-confirmation.enum';
import { AssignmentTypeEnum } from '../../Enums/assignment-type.enum';
import { ConfirmationTokenService } from './Confirmation-token.service';
import { Task } from 'src/entities/Task';
import { MailService } from 'src/Mail/MailService';
import { requiredWorkersStatusEnum } from 'src/Enums/required-workers.enum';

@Injectable()
export class ConfirmationResponseService {
  private readonly logger = new Logger(ConfirmationResponseService.name);

  constructor(
    @InjectRepository(ConfirmationToken)
    private readonly tokenRepo: Repository<ConfirmationToken>,

    @InjectRepository(TaskWorker)
    private readonly taskWorkerRepo: Repository<TaskWorker>,

    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,

    private readonly confirmationTokenService: ConfirmationTokenService,
    private readonly mailService: MailService,
  ) {}

  /**
   * معالجة رد العامل اليدوي عبر الرابط (YES/NO)
   */
  async respond(tokenValue: string, isYes: boolean): Promise<boolean> {
    const token = await this.tokenRepo.findOne({
      where: { Token: tokenValue },
      relations: ['Worker', 'Task'],
    });

    if (!token) throw new NotFoundException(`Token "${tokenValue}" not found`);
    if (token.IsUsed) throw new BadRequestException(`Token "${tokenValue}" has already been used`);
    if (token.ExpiresAt < new Date()) throw new BadRequestException(`Token "${tokenValue}" has expired`);

    await this.confirmationTokenService.markTokenUsed(token.TokenID);

    if (!isYes) {
      await this.handleDeclineLogic(token.Worker.id, token.Task.id);
    } else {
      const taskWorker = await this.getTaskWorker(token.Worker.id, token.Task.id);
      taskWorker.confirmationStatus = WorkerConfirmationStatusEnum.CONFIRMED;
      await this.taskWorkerRepo.save(taskWorker);
      await this.checkCompletionAndNotifySupervisors(token.Task.id);
    }

    this.logger.log(`Worker #${token.Worker.id} responded ${isYes ? 'YES ✅' : 'NO ❌'} for task #${token.Task.id}`);

    return true;
  }

  /**
   * ميثود مخصصة للرفض التلقائي (يستدعيها الـ Processor)
   */
  async respondAutoDecline(workerId: number, taskId: number): Promise<void> {
    this.logger.warn(`System: Auto-declining worker #${workerId} for task #${taskId} due to timeout.`);
    await this.handleDeclineLogic(workerId, taskId);
  }

  /**
   * المنطق الموحد لعملية الرفض (تغيير الحالة + ترقية البديل)
   */
  private async handleDeclineLogic(workerId: number, taskId: number): Promise<void> {
    const taskWorker = await this.getTaskWorker(workerId, taskId);

    // 1. تحديث الحالة إلى DECLINED
    taskWorker.confirmationStatus = WorkerConfirmationStatusEnum.DECLINED;
    await this.taskWorkerRepo.save(taskWorker);

    // 2. البحث عن البديل وترقيته
    await this.promoteBackupWorker(taskId);
  }

  /**
   * جلب سجل الربط بين العامل والمهمة
   */
  private async getTaskWorker(workerId: number, taskId: number): Promise<TaskWorker> {
    const taskWorker = await this.taskWorkerRepo.findOne({
      where: {
        worker: { id: workerId },
        task: { id: taskId },
      },
    });

    if (!taskWorker) {
      throw new NotFoundException(`TaskWorker for Worker #${workerId} and Task #${taskId} not found`);
    }
    return taskWorker;
  }

  private async promoteBackupWorker(taskId: number) {
    const backupWorker = await this.taskWorkerRepo.findOne({
      where: {
        task: { id: taskId },
        assignmentType: AssignmentTypeEnum.BACKUP,
        confirmationStatus: WorkerConfirmationStatusEnum.PENDING,
      },
      order: { backupOrder: 'ASC' },
      relations: ['worker', 'task'],
    });

    if (!backupWorker) {
      this.logger.warn(`No backup workers available for task #${taskId}`);
      return;
    }

    await this.confirmationTokenService.issueTokenAndNotify(backupWorker);
    this.logger.log(`Promoting backup worker #${backupWorker.worker.id} for task #${taskId}`);
  }

  private async checkCompletionAndNotifySupervisors(taskId: number) {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['supervisors', 'supervisors.supervisor'],
    });

    if (!task) {
      this.logger.error(`Task with ID ${taskId} not found during completion check`);
      return;
    }

    const confirmedWorkersCount = await this.taskWorkerRepo.count({
      where: { task: { id: taskId }, confirmationStatus: WorkerConfirmationStatusEnum.CONFIRMED },
    });

    if (confirmedWorkersCount === task.requiredWorkers) {
      task.requiredWorkerStatus = requiredWorkersStatusEnum.COMPLETED;
      for (const ts of task.supervisors) {
        await this.mailService.sendMail({
          to: ts.supervisor.email,
          subject: `Action Required: Group Creation for ${task.eventName}`,
          html: `
  <div style="direction: ltr; font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
    <h2 style="color: #2c3e50;">Action Required: Team Fully Confirmed! 🚀</h2>
    <p style="font-size: 16px;">All required workers for the task <b>${task.eventName}</b> have confirmed their attendance.</p>
    <p>As the assigned supervisor, please create a WhatsApp group for the team and add the invite link via the button below:</p>
    
    <div style="text-align: center; margin-top: 30px;">
        <a href="http://localhost:3000/supervisor/tasks/${taskId}/update-link"
         style="background-color: #25D366; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
         Add WhatsApp Group Link
      </a>
    </div>
    
    <p style="margin-top: 30px; font-size: 14px; color: #2c3e50;">
      <b>Task Details:</b><br>
      Location: ${task.location}<br>
      Start Date: ${new Date(task.startDate).toDateString()}
    </p>
    
    <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">Thank you for your cooperation.</p>
  </div>
`,
        });
      }
    }
  }
}
