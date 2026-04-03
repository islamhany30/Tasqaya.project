import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './Payment.service';
import { PaymentWebhookController } from '../Webhook/Webhook.controller';
import { Payment } from '../../entities/Payment';
import { Task } from 'src/entities/Task';
import { SystemConfig } from 'src/entities/SystemConfig';
import { HttpModule } from '@nestjs/axios';
import { PaymentController } from './Payment.controller';
import { TaskModule } from '../Task/Task.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([Payment,Task,SystemConfig]),
    HttpModule,
    forwardRef(() => TaskModule),
    ],
  controllers: [PaymentWebhookController,PaymentController],
  providers: [PaymentService],
  exports: [PaymentService], 
})
export class PaymentModule {}