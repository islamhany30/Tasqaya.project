import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../Mail/Mail.module';
import { Admin } from '../../entities/Admin';
import { Company } from '../../entities/Company';
import { Task } from '../../entities/Task';
import { TaskWorker } from '../../entities/TaskWorker';
import { ConfirmationToken } from '../../entities/confirmationToken';   // ← أضف ده

import { AdminController } from './Admin.controller';
import { AdminService } from './Admin.service';
import { CompanyModule } from '../Company/Company.module';
import { AuthModule } from 'src/Auth/Auth.module';
import { SupervisorModule } from '../Supervisor/Supervisor.module';
import { WorkerModule } from '../Worker/Worker.module';
import { TaskModule } from '../Task/Task.module';
import { CloudinaryModule } from 'src/Cloudinary/cloudinary.module';

// Confirmation Service
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

    TypeOrmModule.forFeature([
      Admin,
      Company,
      Task,
      TaskWorker,
      ConfirmationToken,        // ← مهم جداً
    ]),
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    ConfirmationTokenService,   // ← موجود
  ],
  exports: [AdminService],
})
export class AdminModule {}
