import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  IsBoolean,
  IsArray,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateIf,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
// استيراد الـ Enums المحدثة
import { WorkerTypeEnum } from '../../../Enums/worker-type.enum'; //
import { GenderEnum } from '../../../Enums/gender.enum';         //
import { WorkerLevelEnum } from '../../../Enums/worker-level.enum'; //

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Event name is required' })
  @MinLength(5, { message: 'Event name must be at least 5 characters' })
  @MaxLength(150, { message: 'Event name must not exceed 150 characters' })
  eventName: string;

  @IsString()
  @IsNotEmpty({ message: 'Location is required' })
  @MinLength(10, { message: 'Location must be at least 10 characters' })
  @MaxLength(255, { message: 'Location must not exceed 255 characters' })
  location: string;

  @IsDateString({}, { message: 'startDate must be a valid date (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Start date is required' })
  startDate: string;

  @IsDateString({}, { message: 'endDate must be a valid date (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'End date is required' })
  endDate: string;

  @IsInt({ message: 'durationHoursPerDay must be an integer' })
  @Min(1, { message: 'Duration must be at least 1 hour per day' })
  @Max(16, { message: 'Duration must not exceed 16 hours per day' })
  @Type(() => Number)
  durationHoursPerDay: number;

  @IsInt({ message: 'requiredWorkers must be an integer' })
  @Min(1, { message: 'At least 1 worker is required' })
  @Max(500, { message: 'Required workers must not exceed 500' })
  @Type(() => Number)
  requiredWorkers: number;

  // ───────── التحديث باستخدام Enum للمستوى ─────────
  @IsEnum(WorkerLevelEnum, { message: 'Invalid worker level' }) //
  @IsNotEmpty({ message: 'Worker level is required' })
  workerLevel: WorkerLevelEnum; 

  // ───────── التحديث باستخدام Enum للنوع ─────────
  @IsArray({ message: 'workerTypes must be an array' })
  @IsNotEmpty({ message: 'At least one worker type is required' })
  @IsEnum(WorkerTypeEnum, { each: true, message: 'Invalid worker type' }) //
  workerTypes: WorkerTypeEnum[];

  // ───────── إضافة Enum للنوع الاجتماعي ─────────
  @IsEnum(GenderEnum, { message: 'Gender must be either male or female' }) //
  @IsNotEmpty({ message: 'Gender is required!' })
  gender: GenderEnum[];

  @IsBoolean({ message: 'hasUniform must be a boolean' })
  hasUniform: boolean = false;

  @ValidateIf((o) => o.hasUniform === true)
  @IsString()
  @IsNotEmpty({ message: 'uniformDescription is required when hasUniform is true' })
  @MaxLength(500, { message: 'uniformDescription must not exceed 500 characters' })
  uniformDescription: string;
}