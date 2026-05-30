import { IsEnum, IsNotEmpty } from 'class-validator';
import { PaymentMethodEnum } from '../../../Enums/payment-method.enum';
import { PaymentStepEnum } from '../../../Enums/payment-step.enum';

export class PayInvoiceDto {
  @IsEnum(PaymentMethodEnum)
  @IsNotEmpty()
  method: PaymentMethodEnum;

  @IsEnum(PaymentStepEnum)
  @IsNotEmpty()
  step: PaymentStepEnum;
}
