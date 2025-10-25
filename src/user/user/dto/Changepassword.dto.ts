import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';
import { Match } from 'src/Decorators/Match.decorator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  password: string; 

  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @Match("newPassword",{message:"confirm password should be mathing with password!"})
  confirmPassword: string;
}
