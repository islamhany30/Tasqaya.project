import { Controller, Post, Body, UseGuards, Req, Patch } from '@nestjs/common';
import { AuthService } from './Auth.service';
import { ForgotPasswordDto } from './Dto/ForgotPassword.dto';
import { VerifyResetCodeDto } from './Dto/VerifyReset.dto';
import { ResetPasswordDto } from './Dto/ResetPassword.dto';
import { LoginDto } from './Dto/Login.dto';
import { JwtAccountAuthGuard } from './auth.guards.account';


@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email,dto.password);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Post('verify-reset-code')
  async verifyResetCode(@Body() dto: VerifyResetCodeDto,@Req() req) {
    return this.authService.verifyResetCode(req.user.id, dto.code);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Post('resend-reset-code')
  async resendResetCode(@Req() req) {
    return this.authService.forgotPasswordResend(req.user.id);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Patch('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto,@Req() req) {
    return this.authService.resetPassword(req.user.id, dto.newPassword);
  }
}