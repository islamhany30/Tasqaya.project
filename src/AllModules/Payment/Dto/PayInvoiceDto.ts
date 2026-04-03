import { IsEnum, IsOptional } from "class-validator";
import { PaymentMethodEnum } from "src/Enums/payment-method.enum";

export class PayInvoiceDto {
  @IsEnum(PaymentMethodEnum)
  method: PaymentMethodEnum;

  @IsEnum(['deposit', 'remaining'])
  @IsOptional()
  step?: 'deposit' | 'remaining' = 'deposit';  // default = deposit
}