import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfirmationResponseService } from './ConfirmationResponse.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskWorker } from '../../entities/TaskWorker';
import { WorkerConfirmationStatusEnum } from '../../Enums/worker-confirmation.enum';

@Processor('confirmation')
export class ConfirmationProcessor extends WorkerHost {
  constructor(
    private readonly confirmationResponseService: ConfirmationResponseService,
    @InjectRepository(TaskWorker)
    private readonly taskWorkerRepo: Repository<TaskWorker>,
  ) {
    super();
  }

  async process(job: Job<{ workerId: number; taskId: number }>): Promise<void> {
    if (job.name === 'auto-decline') {
      const { workerId, taskId } = job.data;

      // التأكد من أن العامل لا يزال في حالة PENDING ولم يرد خلال الـ 12 ساعة
      const taskWorker = await this.taskWorkerRepo.findOne({
        where: {
          worker: { id: workerId },
          task: { id: taskId },
          confirmationStatus: WorkerConfirmationStatusEnum.PENDING,
        },
      });

      if (taskWorker) {
        // استدعاء ميثود الرد بـ "لا" تلقائياً (تغيير الحالة وترقية البديل)
        // ملاحظة: يفضل جعل respond تقبل taskWorkerId مباشرة أو تعديل الـ Service
        await this.confirmationResponseService.respondAutoDecline(workerId, taskId);
      }
    }
  }
}