import { IsString, IsEmail, IsNotEmpty } from 'class-validator';

export class LoginSupervisorDto {
  @IsString()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
