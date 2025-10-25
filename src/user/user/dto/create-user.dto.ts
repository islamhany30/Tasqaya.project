import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Matches,
  MinLength,
} from 'class-validator';
import { Match } from 'src/Decorators/Match.decorator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsNumber()
  @IsNotEmpty()
  age: number;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsString()
  @MinLength(8)
  @Match("password",{message:"password should be matching with repassword"})
  rePassword: string;

  @IsOptional()
  @Matches(/^(\+20|0)?1[0-2,5]\d{8}$/, {
    message: 'Phone number must be a valid Egyptian number',
  })
  phone: string;

  @IsEnum(['male', 'female'])
  gender: 'male' | 'female';
}
