import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfirmationResponseService } from './ConfirmationResponse.service';
import { ConfirmationSchedulerService } from './Confirmationscheduler.service';
import { ConfirmationTokenService } from './Confirmation-token.service';
import { ConfirmationController } from './Confirmation-token.controller';
import { ConfirmationToken } from '../../entities/confirmationToken';
import { TaskWorker } from '../../entities/TaskWorker';
import { Task } from '../../entities/Task';
import { JobPost } from '../../entities/JobPost';
import { MailService } from '../../Mail/MailService';
import { ConfirmationProcessor } from './confirmation.processor';
import { TaskModule } from '../Task/Task.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfirmationToken, TaskWorker, Task, JobPost]),
    BullModule.registerQueue({
      name: 'confirmation',
    }),
    TaskModule,
  ],
  controllers: [ConfirmationController],
  providers: [
    ConfirmationResponseService,
    ConfirmationSchedulerService,
    ConfirmationTokenService,
    MailService,
    ConfirmationProcessor,
  ],
  exports: [ConfirmationResponseService, ConfirmationTokenService, ConfirmationSchedulerService],
})
export class ConfirmationModule {}
