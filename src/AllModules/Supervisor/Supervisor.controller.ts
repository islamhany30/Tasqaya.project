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
import { SupervisorService } from './Supervisor.service';
import { CreateSupervisorDto } from './Dto/CreateSupervisor.dto';
import { VerifyEmailDto } from 'src/Auth/Dto/VerifyEmail.dto';
import { LoginDto } from 'src/Auth/Dto/Login.dto';
import { ForgotPasswordDto } from 'src/Auth/Dto/ForgotPassword.dto';
import { ResetPasswordDto } from 'src/Auth/Dto/ResetPassword.dto';
import { ChangePasswordDto } from 'src/Auth/Dto/ChangePassword.dto';
import { VerifyResetCodeDto } from 'src/Auth/Dto/VerifyReset.dto';
import { DeactivateAccountDto } from 'src/Auth/Dto/DeactivateAccount.dto';
@Controller('api/supervisor')
export class SupervisorController {
  constructor(private readonly supervisorService: SupervisorService) {}

  @Post('register')
  async registerSupervisor(@Body() dto: CreateSupervisorDto) {
    return this.supervisorService.register(dto);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('verify')
  async verifySupervisor(@Body() dto: VerifyEmailDto, @Req() req: any) {
    return this.supervisorService.verifySupervisor(dto.VERIFICATIONCODE, req.user.sub);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('resend-verification')
  async resendVerification(@Req() req: any) {
    return this.supervisorService.resendVerification(req.user.sub);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.supervisorService.login(dto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.supervisorService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.supervisorService.verifyResetCode(dto);
  }

  @Patch('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.supervisorService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  async changePasswors(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.supervisorService.changePassword(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('deactivate-account')
  async deactivateAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.supervisorService.deactivateAccount(req.user.sub, dto);
  }
}
