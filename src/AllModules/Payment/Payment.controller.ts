import { Controller, Get, Query } from '@nestjs/common';
import { PaymentService } from './Payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('success')
  handlePaymentResponse(@Query() query: any) {
    // 1. تأكد من نجاح العملية من خلال الـ query
    const isSuccess = query.success === 'true';

    // 2. هنا اعرض النتيجة للمستخدم فقط
    if (isSuccess) {
      return {
        message: 'Payment response received',
        status: 'success',
        transactionId: query.id,
      };
    } else {
      return {
        message: 'Payment failed',
        status: 'failed',
        reason: query['data.message'],
      };
    }
  }
}
