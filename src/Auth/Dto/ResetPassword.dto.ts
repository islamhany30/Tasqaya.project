// src/Auth/dto/ResetPasswordDto.ts

import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { Match } from '../../Decorators/Match.decorator';

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Length(8, 255)
  newPassword: string;

  @IsNotEmpty()
  @IsString()
  @Match('newPassword', { message: 'confirmNewPassword must match newPassword' })
  confirmNewPassword: string;
}
