import { IsString, IsNotEmpty, Length, IsEmail, IsNumber } from 'class-validator';
import { Match } from 'src/Decorators/Match.decorator';

export class CreateWorkerDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  @Length(14, 14, { message: 'National ID must be exactly 14 digits' })
  nationalId: Number;

  @IsString()
  @IsNotEmpty()
  gender: string;

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
