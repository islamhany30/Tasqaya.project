import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Match } from 'src/Decorators/Match.decorator';

export class ResetSupervisorPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  resetCode: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 255)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 255)
  @Match('newPassword')
  newPasswordConfirm: string;
}
