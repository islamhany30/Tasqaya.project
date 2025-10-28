import { IsOptional, IsString } from 'class-validator';

export class AddAddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  lat?: string;

  @IsOptional()
  @IsString()
  long?: string;
}
