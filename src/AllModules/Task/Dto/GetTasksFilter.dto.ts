import { IsOptional, IsEnum, IsInt, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { TaskStatusEnum } from '../../../Enums/task-status.enum';
import { TaskApprovalStatusEnum } from '../../../Enums/task-approval.enum';

export class GetTasksFilterDto {
  @IsOptional()
  @IsEnum(TaskStatusEnum, { message: 'Invalid task status' })
  status?: TaskStatusEnum;

  @IsOptional()
  @IsEnum(TaskApprovalStatusEnum, { message: 'Invalid approval status' })
  approvalStatus?: TaskApprovalStatusEnum;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  companyId?: number;

  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @IsOptional()
  @IsDateString()
  startDateTo?: string;
}
