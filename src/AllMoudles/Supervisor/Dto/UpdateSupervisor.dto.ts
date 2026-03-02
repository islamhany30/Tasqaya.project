import { IsString, Length, IsOptional } from 'class-validator';

export class updateSupervisorDto {
  @IsOptional()
  @IsString()
  @Length(3, 150)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Length(10, 20)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(5, 255)
  address?: string;
}
