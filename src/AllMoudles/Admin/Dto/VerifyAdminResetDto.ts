import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class VerifyAdminResetDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}