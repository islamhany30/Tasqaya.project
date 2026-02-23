// src/Auth/dto/VerifyResetCodeDto.ts

import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyResetCodeDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'Reset code must be exactly 6 digits' })
  code: string;
}
