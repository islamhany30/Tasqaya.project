// src/Auth/dto/VerifyEmailDto.ts

import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  VERIFICATIONCODE: string;
}
