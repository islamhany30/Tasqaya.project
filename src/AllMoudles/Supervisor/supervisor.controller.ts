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
import { ForgotSupervisorPasswordDto } from './Dto/forgot-password.dto';
import { ResetSupervisorPasswordDto } from './Dto/reset-supervisor-password.dto';

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
    return this.supervisorService.verifySupervisor(dto, req.user.sub);
  }

  @Post('login')
  async login(@Body() dto: LoginSupervisorDto) {
    return this.supervisorService.login(dto);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('resend-verification')
  async resendVerification(@Req() req) {
    return this.supervisorService.resendVerification(req.user.sub);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotSupervisorPasswordDto) {
    return this.supervisorService.forgotPassword(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetSupervisorPasswordDto) {
    return this.supervisorService.resetPassword(dto);
  }
}
