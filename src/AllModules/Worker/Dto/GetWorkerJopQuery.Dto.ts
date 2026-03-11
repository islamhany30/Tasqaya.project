import { IsOptional, IsInt, IsEnum, IsArray, IsDateString, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { GenderEnum } from 'src/Enums/gender-enum';
import { PaginationDto } from './Pagination.Dto';

export class GetWorkerJobsQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'workerLevelId must be an integer' })
  workerLevelId?: number;

  @IsOptional()
  @IsArray({ message: 'genders must be an array' })
  @IsEnum(GenderEnum, { each: true, message: 'Invalid gender value' })
  genders?: GenderEnum[];

  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO 8601 date string' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid ISO 8601 date string' })
  endDate?: string;

  @IsOptional()
  @IsString({ message: 'keyword must be a string' })
  keyword?: string;

  @IsOptional()
  @IsEnum(['publishedAt', 'deadline', 'startDate'], {
    message: "sortBy must be one of: 'publishedAt', 'deadline', 'startDate'",
  })
  sortBy: 'publishedAt' | 'deadline' | 'startDate' = 'publishedAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], { message: "sortDirection must be either 'ASC' or 'DESC'" })
  sortDirection: 'ASC' | 'DESC' = 'DESC';
}