import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class VerifyCompanyResetDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  code: string;
}
