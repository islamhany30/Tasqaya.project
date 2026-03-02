import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../Mail/Mail.module';
import { SupervisorController } from './Supervisor.controller';
import { SupervisorService } from './Supervisor.service';
import { Task } from '../../entities/Task';
import { TaskWorker } from 'src/entities/TaskWorker';
import { Supervisor } from '../../entities/Supervisor';
import { TaskSupervisor } from '../../entities/TaskSupervisor'; // صححت المسار هنا

import { AuthModule } from 'src/Auth/Auth.module';
import { TaskService } from 'src/AllMoudles/Task/Task.service';
import { MailService } from 'src/Mail/MailService';
import { WorkerLevel } from 'src/entities/WorkerLevel';

// --- ضيف باقي الـ Entities هنا بناءً على خطأ الـ Logger ---
import { Payment } from '../../entities/Payment'; 
import { SystemConfig } from 'src/entities/SystemConfig';
import { CompanyFeedback } from 'src/entities/CompanyFeedback';
import { TaskModule } from '../Task/Task.module';
// استورد باقي الـ Entities (SystemConfig, CompanyFeedback, etc.) من أماكنها الحقيقية
// ---------------------------------------------------------

@Module({
  imports: [
    MailModule, 
    AuthModule, 
    TaskModule,
    TypeOrmModule.forFeature([
        Supervisor, 
        Task, 
        TaskWorker, 
        TaskSupervisor, 
        WorkerLevel,
        Payment, 
    ])
  ],
 controllers: [SupervisorController],
 providers: [SupervisorService, MailService],
 exports: [SupervisorService],
})
export class SupervisorModule {}