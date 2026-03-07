import { Controller, Post, Patch, Get, Body, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { TaskService } from './Task.service';

@Controller('api/company/tasks')
export class CompanyController {
  constructor(private readonly taskService: TaskService) {}
}
