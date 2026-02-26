import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class ChangeAccountStatusDto {
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive: boolean;
}
