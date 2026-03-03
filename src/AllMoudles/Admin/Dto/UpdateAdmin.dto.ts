import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(10, 20)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(5, 255)
  address?: string;
}