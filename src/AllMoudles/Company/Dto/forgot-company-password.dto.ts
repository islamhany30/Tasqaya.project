import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotCompanyPasswordDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
