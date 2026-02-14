import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotAdminPasswordDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}