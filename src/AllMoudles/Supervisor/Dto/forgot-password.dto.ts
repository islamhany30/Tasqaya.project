import { IsNotEmpty, IsString, IsEmail } from 'class-validator';

export class ForgotSupervisorPasswordDto {
  @IsString()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
