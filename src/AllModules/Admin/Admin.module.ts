import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../Mail/Mail.module';
import { Admin } from '../../entities/Admin';
import { Company } from '../../entities/Company'; // هنحتاجها للـ Injection في الـ Service
import { AdminController } from './Admin.controller';
import { AdminService } from './Admin.service';
import { CompanyModule } from '../Company/Company.module'; // عشان نقدر نستخدم الـ CompanyService
import { AuthModule } from 'src/Auth/Auth.module';
import { SupervisorModule } from '../Supervisor/Supervisor.module';
import { WorkerModule } from '../Worker/Worker.module';

@Module({
  imports: [
    AuthModule,
    MailModule,
    CompanyModule,
    WorkerModule,
    SupervisorModule,
    TypeOrmModule.forFeature([Admin, Company]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
