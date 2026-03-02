import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './Create.task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}