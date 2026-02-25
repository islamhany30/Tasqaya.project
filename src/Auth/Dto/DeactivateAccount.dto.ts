import { IsString, IsNotEmpty } from 'class-validator';

export class DeactivateAccountDto {
  @IsNotEmpty()
  @IsString()
  password: string;
}
