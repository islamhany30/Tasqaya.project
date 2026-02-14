import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { Match } from '../../../Decorators/Match.decorator';

export class CreateAdminDto {
  @IsNotEmpty()
  @IsString()
  @Length(3, 100)
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Length(8, 255)
  passwordHash: string; 

  @IsNotEmpty()
  @IsString()
  @Match('passwordHash', {
    message: 'confirmPassword must match passwordHash'
  })
  confirmPassword: string;

  @IsNotEmpty()
  @IsString()
  @Length(10, 20)
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(5, 255)
  address: string;
}