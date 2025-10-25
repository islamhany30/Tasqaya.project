import { IsEmail, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { Match } from 'src/Decorators/Match.decorator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;

  @IsNotEmpty({ message: 'Confirm password is required' })
  @Match("newPassword",{message:"confirm password should be mathing with password!"})
  confirmPassword: string;
}
