import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginCompanyDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
