import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from './Mail/Mail.module';
import { CompanyModule } from './AllMoudles/Company/Company.module';
import { Company } from './entities/Company';
import { Admin } from './entities/Admin';
import { Worker } from './entities/Worker';
import { Task } from './entities/Task';
import { CompanyFeedback } from './entities/CompanyFeedback';
import { Supervisor } from './entities/Supervisor';
import { TaskWorker } from './entities/TaskWorker';
import { TaskWorkerType } from './entities/TaskWorkerType';
import { WorkerScoreHistory } from './entities/WorkerScoreHistory';
import { WorkerType } from './entities/WorkerType';
import { JobPost } from './entities/JobPost';
import { Payment } from './entities/Payment';
import { Attendance } from './entities/Attendance';
import { Application } from './entities/Application';
import { TaskSupervisor } from './entities/TaskSupervisor';
import { WorkerLevel } from './entities/WorkerLevel';
import { WorkerPayout } from './entities/WorkerPayout';
import { AdminModule } from './AllMoudles/Admin/Admin.module';
import { ConfirmationToken } from './entities/confirmationToken';
import { SupervisorModule } from './AllMoudles/Supervisor/supervisor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.development',
    }),

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
          Company,
          Worker,
          WorkerLevel,
          WorkerType,
          WorkerScoreHistory,
          Task,
          TaskWorker,
          TaskWorkerType,
          TaskSupervisor,
          Supervisor,
          CompanyFeedback,
          JobPost,
          Payment,
          Attendance,
          Application,
          WorkerPayout,
          ConfirmationToken,
        ],
        synchronize: true, // خليها false عشان تستخدم migrations
        logging: true,
      }),
    }),

    AdminModule,
    CompanyModule,
    SupervisorModule,
    MailModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
  ],
})
export class AppModule {}
