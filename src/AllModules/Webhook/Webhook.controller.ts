import { Controller, Post, Body, Query, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentService } from '../Payment/Payment.service';
import { PaymentMethodEnum } from 'src/Enums/payment-method.enum';

@Controller('api/payments/webhook')
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('paymob')
  @HttpCode(HttpStatus.OK)
  async handlePaymobWebhook(@Query('hmac') hmac: string, @Body() body: any) {
    if (!hmac || !body.obj) {
      throw new BadRequestException('Missing HMAC signature or payload');
    }

    // التحقق من التوقيع الرقمي للأمان
    const isValid = this.paymentService.validatePaymobHmac(hmac, body.obj);
    if (!isValid) throw new BadRequestException('Invalid HMAC signature');

    const transactionData = body.obj;

    // Paymob يرسل نجاح العملية في حقل success
    const isSuccess = String(transactionData.success) === 'true';

    if (isSuccess) {
      const merchantOrderId: string = transactionData.order.merchant_order_id;

      // تصحيح استخراج الـ ID بناءً على Format السيرفيس (DEPOSIT_123_456)
      const parts = merchantOrderId.split('_');
      const paymentId = parseInt(parts[1]);

      if (isNaN(paymentId)) {
        throw new BadRequestException('Invalid Merchant Order ID format');
      }

      const bankTransId = transactionData.id;

      // تحديد طريقة الدفع
      const type = transactionData.source_data?.type?.toLowerCase();
      let method = PaymentMethodEnum.CARD;
      if (type === 'wallet') method = PaymentMethodEnum.WALLET;

      // استدعاء المعالجة
      return await this.paymentService.processSuccessfulPayment(paymentId, String(bankTransId), method);
    }

    return { status: 'Notification received', message: 'Transaction failed or pending' };
  }
}
