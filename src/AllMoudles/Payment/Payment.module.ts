import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './Payment.service';
import { PaymentWebhookController } from '../Webhook/Webhook.controller';
import { Payment } from '../../entities/Payment';
import { Task } from 'src/entities/Task';
import { SystemConfig } from 'src/entities/SystemConfig';
import { HttpModule } from '@nestjs/axios';
import { PaymentController } from './Payment.controller';


@Module({
  imports: [
    TypeOrmModule.forFeature([Payment,Task,SystemConfig]),
    HttpModule
    ],
  controllers: [PaymentWebhookController,PaymentController],
  providers: [PaymentService],
  exports: [PaymentService], 
})
export class PaymentModule {}