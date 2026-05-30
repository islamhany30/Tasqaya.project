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
    @Res() res: Response
  ) {
    const isSuccess = query.success === 'true';
    const transactionId = query.id;
    
    // التقاط رسالة الخطأ من Paymob إذا فشلت العملية
    const errorMessage = query['data.message'] || 'حدث خطأ غير معروف أثناء الدفع';

    // الرابط الأساسي لصفحة الدفع في الفرونت إيند
    const baseUrl = 'https://tasqaya-connect.netlify.app/company/payments';
    
    if (isSuccess) {
      // تمرير حالة النجاح ورقم العملية للفرونت إيند
      return res.redirect(`${baseUrl}?status=success&id=${transactionId}`);
    } else {
      // تمرير حالة الفشل ورسالة الخطأ (مع تشفيرها لتكون آمنة في الرابط)
      return res.redirect(`${baseUrl}?status=failed&message=${encodeURIComponent(errorMessage)}`);
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
