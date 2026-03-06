import { Module, ClassSerializerInterceptor } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';

import { MailModule } from './Mail/Mail.module';

// Modules
import { AdminModule } from './AllModules/Admin/Admin.module';
import { CompanyModule } from './AllModules/Company/Company.module';
import { SupervisorModule } from './AllModules/Supervisor/Supervisor.module';
import { WorkerModule } from './AllModules/Worker/Worker.module';
import { ConfirmationModule } from './AllModules/Confirmation/Confirmation.module';

// Entities
import { Admin } from './entities/Admin';
import { Application } from './entities/Application';
import { Attendance } from './entities/Attendance';
import { Company } from './entities/Company';
import { CompanyFeedback } from './entities/CompanyFeedback';
import { ConfirmationToken } from './entities/confirmationToken';
import { JobPost } from './entities/JobPost';
import { Payment } from './entities/Payment';
import { Supervisor } from './entities/Supervisor';
import { SystemConfig } from './entities/SystemConfig';
import { Task } from './entities/Task';
import { TaskSupervisor } from './entities/TaskSupervisor';
import { TaskWorker } from './entities/TaskWorker';
import { TaskWorkerType } from './entities/TaskWorkerType';
import { Worker } from './entities/Worker';
import { WorkerLevel } from './entities/WorkerLevel';
import { WorkerPayout } from './entities/WorkerPayout';
import { WorkerScoreHistory } from './entities/WorkerScoreHistory';
import { WorkerType } from './entities/WorkerType';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.development',
    }),

    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [
          Admin,
          Application,
          Attendance,
          Company,
          CompanyFeedback,
          ConfirmationToken,
          JobPost,
          Payment,
          Supervisor,
          SystemConfig,
          Task,
          Worker,
          WorkerLevel,
          TaskSupervisor,
          TaskWorker,
          TaskWorkerType,
          WorkerPayout,
          WorkerScoreHistory,
          WorkerType,
        ],
        synchronize: false,
        logging: true,
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: Number(config.get<number>('REDIS_PORT')) || 6379,
        },
      }),
    }),

    AdminModule,
    CompanyModule,
    SupervisorModule,
    WorkerModule,
    MailModule,
    ConfirmationModule,
  ],

  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
  ],
})
export class AppModule {}