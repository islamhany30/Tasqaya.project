import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PaymentService } from './Payment.service';
import { PayInvoiceDto } from './Dto/PayInvoiceDto';
import { JwtAccountAuthGuard } from 'src/Auth/auth.guards.account';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('success')
  async handlePaymentResponse(
    @Query() query: any, 
    @Res() res: Response // إضافة الـ Response للتحكم في الـ Redirect
  ) {
    // 1. التأكد من نجاح العملية من الـ Query اللي راجعة من Paymob
    const isSuccess = query.success === 'true';
    const transactionId = query.id;

    // 2. الـ Redirect للموقع بتاعك
    if (isSuccess) {
      // بيرجع المستخدم لصفحة النجاح في الفرونت إيند
      return res.redirect(`https://tasqaya-connect.netlify.app/company/payments`);
    } else {
      // بيرجع المستخدم لصفحة الفشل
      const errorMessage = query['data.message'] || 'Payment failed';
      return res.redirect(`https://tasqaya-connect.netlify.app/company/payments`);
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
