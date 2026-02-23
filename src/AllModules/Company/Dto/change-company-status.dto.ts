import { IsBoolean } from 'class-validator';

export class ChangeCompanyStatusDto {
  @IsBoolean()
  isActive: boolean;
}
