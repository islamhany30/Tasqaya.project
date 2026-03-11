import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../../entities/Task'; 
import { WorkerType } from '../../entities/WorkerType';

import { TaskService } from './Task.service';
import { CompanyController } from './Task.controller';
import { WorkerLevel } from '../../entities/WorkerLevel';
import { PaymentModule } from '../Payment/Payment.module';
import { SystemConfig } from '../../entities/SystemConfig';
import { TaskSchedulerService } from './TaskScheduler.service';
import { Payment } from '../../entities/Payment';
import { CompanyFeedback } from '../../entities/CompanyFeedback';
import { TaskWorker } from 'src/entities/TaskWorker';
import { ConfirmationToken } from 'src/entities/confirmationToken';
import { MailModule } from 'src/Mail/Mail.module';
import { TaskSupervisor } from 'src/entities/TaskSupervisor';
import { TaskWorkerType } from 'src/entities/TaskWorkerType';
import { JobPost } from 'src/entities/JobPost';
import { Attendance } from 'src/entities/Attendance';
import { Worker } from 'src/entities/Worker';
import { Supervisor } from 'src/entities/Supervisor';
import { Admin } from 'src/entities/Admin';
import { Application } from 'src/entities/Application';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task, 
      WorkerType, 
      TaskWorker,
      WorkerLevel,
      SystemConfig,
      Payment,
      Admin,
      CompanyFeedback,
      ConfirmationToken,
      TaskSupervisor,
      JobPost,
      TaskWorkerType,
      Attendance,
      Worker,
      Application,
      Supervisor
    ]),
    PaymentModule,
    MailModule
  ],
  controllers: [
    CompanyController
  ],
  providers: [
    TaskService,TaskSchedulerService
  ],
  exports: [
    TaskService
  ],
})
export class TaskModule {}