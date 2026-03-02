import { IsString, IsOptional, Length } from 'class-validator';

export class UpdateWorkerDto {
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
