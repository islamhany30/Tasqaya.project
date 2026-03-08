import { AuthModule } from 'src/Auth/Auth.module';
import { TaskModule } from '../Task/Task.module';
import { PaymentModule } from '../Payment/Payment.module';
import { MailModule } from 'src/Mail/Mail.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from 'src/entities/Company';
import { Task } from 'src/entities/Task';
import { CompanyFeedback } from '../../entities/CompanyFeedback';
import { CompanyController } from './Company.controller';
import { CompanyService } from './Company.service';
import { Module } from '@nestjs/common';
import { Admin } from '../../entities/Admin';

@Module({
  imports: [
    MailModule,
    AuthModule,
    TaskModule,
    PaymentModule,
    TypeOrmModule.forFeature([
      Company,
      Admin,
      Task,
      CompanyFeedback
    ]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}