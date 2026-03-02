import { Controller, Post, Body, Query, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentService } from '../Payment/Payment.service';
import { PaymentMethodEnum } from 'src/Enums/payment-method.enum';

@Controller('api/payments/webhook')
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('paymob')
  @HttpCode(HttpStatus.OK)
  async handlePaymobWebhook(
    @Query('hmac') hmac: string,
    @Body() body: any,
  ) {
    if (!hmac || !body.obj) {
      throw new BadRequestException('Missing HMAC signature or payload');
    }

    const isValid = this.paymentService.validatePaymobHmac(hmac, body.obj);
    if (!isValid) throw new BadRequestException('Invalid HMAC signature');

    const transactionData = body.obj;
    const isSuccess = transactionData.success === true && transactionData.pending === false;

    if (isSuccess) {
      // استخراج paymentId من merchant_order_id
      const merchantOrderId: string = transactionData.order.merchant_order_id;
      const paymentId = parseInt(merchantOrderId.split('-')[1]); // payment-123-1708696840000 => 123
      const bankTransId = transactionData.id;

      // تحديد طريقة الدفع
      const type = transactionData.source_data?.type?.toLowerCase();
      let method: PaymentMethodEnum;
      if (type === 'card') method = PaymentMethodEnum.CARD;
      else if (type === 'wallet') method = PaymentMethodEnum.WALLET;
      else method = PaymentMethodEnum.CARD;

      return await this.paymentService.processSuccessfulPayment(paymentId, String(bankTransId), method);
    }

    return { status: 'Notification received', message: 'Transaction was not successful' };
  }
}