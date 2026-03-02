import { Controller, Body, Req, Post, Patch, Delete, Get, UseGuards } from '@nestjs/common';
import { WorkerService } from './Worker.service';
import { CreateWorkerDto } from './Dto/CreateWorker.dto';
import { JwtRegisterAuthGuard } from 'src/Auth/auth.guards.register';
import { VerifyEmailDto } from 'src/Auth/Dto/VerifyEmail.dto';
import { JwtAuthGuard } from 'src/Auth/auth.guards';
import { LoginDto } from 'src/Auth/Dto/Login.dto';
import { ForgotPasswordDto } from 'src/Auth/Dto/ForgotPassword.dto';
import { VerifyResetCodeDto } from 'src/Auth/Dto/VerifyReset.dto';
import { ResetPasswordDto } from 'src/Auth/Dto/ResetPassword.dto';
import { DeactivateAccountDto } from 'src/Auth/Dto/DeactivateAccount.dto';
import { ChangePasswordDto } from 'src/Auth/Dto/ChangePassword.dto';
import { UpdateWorkerDto } from './Dto/UpdateWorker.dto';

@Controller('api/worker')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post('register')
  async registerWorker(@Body() dto: CreateWorkerDto) {
    return this.workerService.register(dto);
  }

  @Post('verify')
  @UseGuards(JwtRegisterAuthGuard)
  async verify(@Body() dto: VerifyEmailDto, @Req() req: any) {
    return this.workerService.verifyWorker(dto.VERIFICATIONCODE, req.user.sub);
  }

  @Post('resend-verification')
  @UseGuards(JwtRegisterAuthGuard)
  async resendVerification(@Req() req: any) {
    return this.workerService.resendVerification(req.user.sub);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.workerService.login(dto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.workerService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.workerService.verifyResetCode(dto);
  }

  @Patch('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.workerService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  async changePasswors(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.workerService.changePassword(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('deactivate-account')
  async deactivateAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.workerService.deactivateAccount(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.workerService.deleteAccount(Number(req.user.sub), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.workerService.getWorkerById(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('edit-profile')
  async editProfile(@Req() req: any, @Body() dto: UpdateWorkerDto) {
    return this.workerService.editProfile(req.user.sub, dto);
  }
}
