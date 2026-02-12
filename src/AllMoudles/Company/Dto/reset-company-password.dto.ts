import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { Match } from '../../../Decorators/Match.decorator';

export class ResetCompanyPasswordDto {

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Length(8, 255)
  newPassword: string;

  @IsNotEmpty()
  @IsString()
  @Match('newPassword', {
    message: 'confirmPassword must match newPassword'
  })
  confirmPassword: string;
}
