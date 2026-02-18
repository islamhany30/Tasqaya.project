import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  UseGuards,
  Req,
  Put,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';

import { MailDTO } from '../../Mail/dto/Mail.dto';
import { JwtAuthGuard } from '../../Auth/auth.guards';
import { JwtRegisterAuthGuard } from '../../Auth/auth.guards.register';

import { SupervisorService } from './supervisor.service';
import { CreateSupervisorDto } from './Dto/create-supervisor.dto';
import { LoginSupervisorDto } from './Dto/login-supervisor.dto';

@Controller('api/supervisor')
export class SupervisorController {
  constructor(private readonly supervisorService: SupervisorService) {}

  @Post('register')
  async registerSupervisor(@Body() dto: CreateSupervisorDto) {
    return this.supervisorService.register(dto);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('verify')
  async verifySupervisor(@Body() dto: MailDTO, @Req() req) {
    return this.supervisorService.verifySupervisor(dto, req.sub.id);
  }

  @Post('login')
  async login(@Body() dto: LoginSupervisorDto) {
    return this.supervisorService.login(dto);
  }
}
