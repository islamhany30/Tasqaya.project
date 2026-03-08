import { Controller, Body, Req, Post, Patch, Delete, Get, UseGuards } from '@nestjs/common';
import { WorkerService } from './Worker.service';
import { CreateWorkerDto } from './Dto/CreateWorker.dto';
import { JwtAccountAuthGuard } from '../../Auth/auth.guards.account';
import { VerifyEmailDto } from 'src/Auth/Dto/VerifyEmail.dto';
import { DeactivateAccountDto } from 'src/Auth/Dto/DeactivateAccount.dto';
import { ChangePasswordDto } from 'src/Auth/Dto/ChangePassword.dto';
import { AdminAuthGuard } from 'src/Auth/Auth.roles';

@Controller('api/worker')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  // ================= Register / Verification routes =================
  @Post('register')
  async registerWorker(@Body() dto: CreateWorkerDto) {
    return this.workerService.register(dto);
  }

  @Post('verify')
  @UseGuards(JwtAccountAuthGuard)
  async verify(@Body() dto: VerifyEmailDto, @Req() req: any) {
    return this.workerService.verifyWorker(dto.VERIFICATIONCODE, req.user.sub);
  }

  @Post('resend-verification')
  @UseGuards(JwtAccountAuthGuard)
  async resendVerification(@Req() req: any) {
    return this.workerService.resendVerification(req.user.sub);
  }

  // ================= Authenticated routes with JwtAccountAuthGuard =================
  @UseGuards(JwtAccountAuthGuard)
  @Patch('change-password')
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.workerService.changePassword(req.user.sub, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('deactivate-account')
  async deactivateAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.workerService.deactivateAccount(req.user.sub, dto);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.workerService.deleteAccount(Number(req.user.sub), dto);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.workerService.getWorkerById(req.user.sub);
  }
}