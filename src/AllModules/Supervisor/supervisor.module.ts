import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../Mail/Mail.module';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SupervisorController } from './supervisor.controller';
import { SupervisorService } from './supervisor.service';
import { Task } from '../../entities/Task';
import { TaskWorker } from 'src/entities/TaskWorker';
import { Supervisor } from '../../entities/Supervisor';
import { TaskSupervisor } from 'src/entities/TaskSupervisor';

@Module({
  imports: [
    MailModule,
    TypeOrmModule.forFeature([Supervisor, Task, TaskWorker, TaskSupervisor]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      global: true,
      useFactory: async (config: ConfigService): Promise<JwtModuleOptions> => {
        return {
          secret: config.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: config.get<number>('JWT_EXPIRES_IN'),
          },
        };
      },
    }),
  ],
  controllers: [SupervisorController],
  providers: [SupervisorService],
  exports: [SupervisorService],
})
export class SupervisorModule {}
