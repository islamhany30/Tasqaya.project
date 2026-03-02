import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../Mail/Mail.module';
import { SupervisorController } from './Supervisor.controller';
import { SupervisorService } from './Supervisor.service';
import { Task } from '../../entities/Task';
import { TaskWorker } from 'src/entities/TaskWorker';
import { Supervisor } from '../../entities/Supervisor';
import { TaskSupervisor } from 'src/entities/TaskSupervisor';

import { AuthModule } from 'src/Auth/Auth.module';

@Module({
  imports: [MailModule, AuthModule, TypeOrmModule.forFeature([Supervisor, Task, TaskWorker, TaskSupervisor])],
  controllers: [SupervisorController],
  providers: [SupervisorService],
  exports: [SupervisorService],
})
export class SupervisorModule {}
