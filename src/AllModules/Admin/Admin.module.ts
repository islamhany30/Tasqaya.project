import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { MailModule } from '../../Mail/Mail.module';
import { Admin } from '../../entities/Admin';
import { Company } from '../../entities/Company';
import { Task } from '../../entities/Task';
import { TaskWorker } from '../../entities/TaskWorker';
import { ConfirmationToken } from '../../entities/confirmationToken';
// 1. استيراد الكيانات الجديدة
import { Attendance } from '../../entities/Attendance';
import { Worker } from '../../entities/Worker';
import { WorkerLevel } from '../../entities/WorkerLevel';

import { AdminController } from './Admin.controller';
import { AdminService } from './Admin.service';
import { CompanyModule } from '../Company/Company.module';
import { AuthModule } from 'src/Auth/Auth.module';
import { SupervisorModule } from '../Supervisor/Supervisor.module';
import { WorkerModule } from '../Worker/Worker.module';
import { TaskModule } from '../Task/Task.module';
import { CloudinaryModule } from 'src/Cloudinary/cloudinary.module';

import { ConfirmationTokenService } from '../Confirmation/Confirmation-token.service';

@Module({
  imports: [
    AuthModule,
    MailModule,
    CompanyModule,
    WorkerModule,
    SupervisorModule,
    CloudinaryModule,
    TaskModule,

    BullModule.registerQueue({
      name: 'confirmation',
    }),

    TypeOrmModule.forFeature([
      Admin,
      Company,
      Task,
      TaskWorker,
      ConfirmationToken,
      // 2. تسجيل الكيانات الجديدة هنا
      Attendance,
      Worker,
      WorkerLevel,
    ]),
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    ConfirmationTokenService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
