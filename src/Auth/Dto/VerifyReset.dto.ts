// src/Auth/dto/VerifyResetCodeDto.ts

import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyResetCodeDto {
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'Reset code must be exactly 6 digits' })
  code: string;
}
