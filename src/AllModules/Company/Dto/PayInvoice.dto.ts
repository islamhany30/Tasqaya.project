import { IsEnum, IsNotEmpty } from 'class-validator';
import { PaymentMethodEnum } from 'src/Enums/payment-method.enum';

export class PayInvoiceDto {
  @IsEnum(PaymentMethodEnum, { message: 'Invalid payment method' })
  @IsNotEmpty({ message: 'Payment method is required' })
  method: PaymentMethodEnum;
}