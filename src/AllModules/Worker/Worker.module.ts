import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../Mail/Mail.module';
import { Company } from '../../entities/Company';
import { Admin } from '../../entities/Admin';
import { Task } from '../../entities/Task';
import { AuthModule } from 'src/Auth/Auth.module';
import { Worker } from 'src/entities/Worker';
import { JobPost } from 'src/entities/JobPost';
import { Application } from 'src/entities/Application';
import { WorkerController } from './Worker.controller';
import { WorkerService } from './Worker.service';

@Module({
  imports: [MailModule, AuthModule, TypeOrmModule.forFeature([Worker, Admin, Task, Company, JobPost, Application])],
  controllers: [WorkerController],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
