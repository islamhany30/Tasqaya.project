import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PaymentService } from './Payment.service';
import { PayInvoiceDto } from './Dto/PayInvoiceDto';
import { JwtAccountAuthGuard } from 'src/Auth/auth.guards.account';

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

  @Post('payments/:paymentId/pay')
  @UseGuards(JwtAccountAuthGuard)
  async payInvoice(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() dto: PayInvoiceDto,
    @Req() req: any,
  ) {
    return this.paymentService.initiatePayment(paymentId, req.user.sub, dto.method, dto.step);
  }
}
