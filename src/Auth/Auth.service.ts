import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MailService } from 'src/Mail/MailService';
import { UserRole } from 'src/Enums/User.role';
import { generateToken } from 'src/common/utils.jwt';
import { IAuthUser } from './interfaces/IAuthUser.interface';
import { identity } from 'rxjs';
import { Not } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  //Registration
  async register(
    dto: { email: string; password: string; [key: string]: any },
    emailSubject: string,
    userService: IAuthUser,
    role: UserRole,
  ) {
    const existing = await userService.findByEmail(dto.email);

    if (existing) throw new BadRequestException(`${role} email is already registered`);

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const verificationCode = this.generateCode();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    const user = await userService.createUser({
      ...dto,
      password: hashedPassword,
      verificationCode,
      verificationCodeExpiry: expiry,
      isActive: true,
      isVerified: false,
    });

    await this.mailService.sendMail({
      to: user.email,
      subject: emailSubject,
      text: `Your verification code: ${verificationCode}`,
    });

    const token = generateToken(this.jwtService, {
      sub: user.id,
      email: user.email,
      role,
    });

    return { message: 'Registered successfuly. Verification code sent via email', token };
  }

  //Email Verification
  async verifyUser(code: string, userId: number, userService: IAuthUser) {
    const user = await userService.findById(userId);

    if (!user) throw new NotFoundException('User not found');

    if (user.isVerified) throw new BadRequestException('User already verified');

    if (!user.verificationCode || !user.verificationCodeExpiry)
      throw new BadRequestException('No verification code found. Please request a new one.');

    if (code !== user.verificationCode) throw new BadRequestException('Invalid verification code');

    if (user.verificationCodeExpiry < new Date())
      throw new BadRequestException('Verification code expired. Please request a new one ');

    await userService.verifyUser(userId);

    return { message: 'Account verified successfully' };
  }

  //Resend verification
  async resendVerification(userId: number, userService: IAuthUser) {
    const user = await userService.findById(userId);

    if (!user) throw new BadRequestException('User not found');
    if (user.isVerified) throw new BadRequestException('User already verified');

    const newCode = this.generateCode();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    userService.setVerificationCode(userId, newCode, expiry);

    await this.mailService.sendMail({
      to: user.email,
      subject: 'Resend Verification Code',
      text: `Your new verification code is: ${newCode}`,
    });

    return { message: 'A new verification code has been sent to your email' };
  }

  //Login
  async login(email: string, password: string, userService: IAuthUser, role: UserRole) {
    const user = await userService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const isMatch = await userService.validatePassword(password, user);
    if (!isMatch) throw new UnauthorizedException('Invalid email or password');

    if (!user.isActive) throw new ForbiddenException('This account has been deactivated');

    const token = generateToken(this.jwtService, {
      sub: user.id,
      email: user.email,
      role,
    });

    return {
      message: 'Login successful',
      token,
    };
  }

  //Change Password
  async changePassword(userId: number, oldPassword: string, newPassword: string, userService: IAuthUser) {
    const user = await userService.findById(userId);

    if (!user) throw new BadRequestException('User not found');

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) throw new UnauthorizedException('Old password is incorrect');

    const hash = await bcrypt.hash(newPassword, 10);

    await userService.updatePassword(userId, hash);

    return { message: 'Password changed successfully' };
  }

  //Forgot Password
  async forgotPassword(email: string, userService: IAuthUser) {
    const user = await userService.findByEmail(email);

    if (!user) throw new NotFoundException('No user found with this email');

    const resetCode = this.generateCode();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    await userService.setResetCode(email, resetCode, expiry);

    await this.mailService.sendMail({
      to: email,
      subject: 'Password Reset',
      text: `Your password reset code is: ${resetCode}. Valid for 5 minutes.`,
    });

    return {
      message: 'Reset code sent successfully',
    };
  }

  //Verify Reset password code
  async verifyResetCode(email: string, code: string, userService: IAuthUser) {
    const user = await userService.findByEmail(email);

    if (!user) throw new NotFoundException('User not found');

    if (!code || user.resetCode !== code) throw new BadRequestException('Invalid reset code');

    if (user.resetCodeExpiry && user.resetCodeExpiry < new Date()) throw new BadRequestException('Reset code expired');

    return {
      message: 'Reset code verified successfully',
    };
  }

  //Reset password
  async resetPassword(email: string, newPassword: string, userService: IAuthUser) {
    const user = await userService.findByEmail(email);

    if (!user) throw new NotFoundException('User not found');

    if (!user.resetCode) throw new BadRequestException('No reset request found');

    const hash = await bcrypt.hash(newPassword, 10);

    await userService.updatePassword(user.id, hash);
    await userService.clearResetCode(user.id);

    return {
      message: 'Password reset successfully',
    };
  }

  async deactivateAccount(userId: number, plainText: string, userService: IAuthUser) {
    const user = await userService.findById(userId);

    if (!user) throw new NotFoundException('User not found');

    const isMatch = await userService.validatePassword(plainText, user);

    if (!isMatch) throw new UnauthorizedException('Invalid Password');

    await userService.deactivateUser(userId);

    return {
      message: 'Deactivated successfully',
    };
  }

  async deleteAccount(userId: number, plainText: string, userService: IAuthUser) {
    const user = await userService.findById(userId);

    if (!user) throw new NotFoundException('User not found');

    const isMatch = await userService.validatePassword(plainText, user);

    if (!isMatch) throw new UnauthorizedException('Invalid Password');

    await userService.deleteUser(userId);

    return {
      message: 'Deleted Successfully',
    };
  }

  //helper
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
