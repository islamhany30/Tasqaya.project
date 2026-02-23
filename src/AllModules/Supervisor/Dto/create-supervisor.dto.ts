import { IsString, IsEmail, IsNotEmpty, Length } from 'class-validator';
import { Match } from 'src/Decorators/Match.decorator';

export class CreateSupervisorDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 255)
  password: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 255)
  @Match('password', { message: 'Confirm password must match password' })
  confirmPassword: string;

  @IsString()
  @IsNotEmpty()
  @Length(11, 11)
  phone: string;
}
