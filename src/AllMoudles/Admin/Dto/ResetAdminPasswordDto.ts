import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { Match } from '../../../Decorators/Match.decorator';

export class ResetAdminPasswordDto {
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