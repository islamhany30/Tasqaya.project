import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Match } from '../../../Decorators/Match.decorator';

export class ChangeCompanyPasswordDto {

  @IsNotEmpty()
  @IsString()
  oldPassword: string;

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
