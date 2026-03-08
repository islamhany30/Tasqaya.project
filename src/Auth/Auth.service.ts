import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../Mail/MailService';
import { UserRole } from '../Enums/User.role';
import { generateToken } from '../common/utils.jwt';
import { IAuthUser } from './interfaces/IAuthUser.interface';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Account } from '../entities/Accounts';
import { Admin } from '../entities/Admin';
import { Supervisor } from '../entities/Supervisor';
import { Company } from '../entities/Company';
import { Payload } from '../Types/Payload';
import { Worker } from '../entities/Worker';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly dataSource: DataSource,
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(Supervisor)
    private readonly supervisorRepo: Repository<Supervisor>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  private getRepositoryByRole(role: string, manager?: EntityManager) {
    const repos = {
      admin: Admin,
      worker: Worker,
      supervisor: Supervisor,
      company: Company,
    };
    const entity = repos[role.toLowerCase()];
    if (!entity) throw new Error('Invalid role');
    return manager ? manager.getRepository(entity) : this.dataSource.getRepository(entity);
  }

  //Registration with transaction
// =======================================================================
// Auth.service.ts  — register method (replace the existing one)
// =======================================================================
//
// الفكرة: account + profile بيتعملوا جوا transaction واحدة
// لو أي حاجة فشلت (createUser / accountRepo.save) كل حاجة بترجع
// الإيميل بيتبعت بعد الـ transaction عشان لو فشل ما يأثرش على الـ DB

async register(
  dto: { email: string; password: string; [key: string]: any },
  emailSubject: string,
  userService: IAuthUser,
  role: UserRole,
) {
  // ── 1. check email قبل الـ transaction عشان نوفر resources ──────────
  const existingAccount = await this.accountRepo.findOne({
    where: { email: dto.email },
  });

  if (existingAccount) {
    throw new BadRequestException(`${role} email is already registered`);
  }

  const hashedPassword = await bcrypt.hash(dto.password, 10);
  const verificationCode = this.generateCode();
  const expiry = new Date(Date.now() + 5 * 60 * 1000);

  // ── 2. Transaction: account + profile مع بعض ─────────────────────────
  const { savedAccount } = await this.dataSource.transaction(async (manager) => {
    const accountRepoTx = manager.getRepository(Account);

    const account = accountRepoTx.create({
      email: dto.email,
      password: hashedPassword,
      role,
    });

    const savedAccount = await accountRepoTx.save(account);

    await userService.createUser({
      ...dto,
      verificationCode,
      verificationCodeExpiry: expiry,
      isActive: true,
      isVerified: false,
      account: savedAccount,
    },manager);

    return { savedAccount };
  });

  await this.mailService.sendMail({
    to: savedAccount.email,
    subject: emailSubject,
    text: `Your verification code: ${verificationCode}`,
  });

  const token = generateToken(this.jwtService, {
    sub: savedAccount.id,
    email: savedAccount.email,
    role:savedAccount.role,
  });

  return {
    message: 'Registered successfully. Verification code sent via email',
    token,
  };
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

  async login(email: string, password: string) {
    const account = await this.accountRepo.findOne({ where: { email } });
    if (!account) throw new UnauthorizedException('Invalid email or password');

    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) throw new UnauthorizedException('Invalid email or password');
    if (!account.isActive) throw new ForbiddenException('This account has been deactivated');

    const token = generateToken(this.jwtService, {
      sub: account.id,
      email: account.email,
      role: account.role,
    });

    return { message: 'Login successful', token };
  }

  //Change Password
  async changePassword(userId: number, oldPassword: string, newPassword: string, userService: IAuthUser) {
    const user = await userService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const isMatch = await userService.validatePassword(oldPassword, user);
    if (!isMatch) throw new UnauthorizedException('Old password is incorrect');

    const hash = await bcrypt.hash(newPassword, 10);
    await userService.updatePassword(userId, hash);

    return { message: 'Password changed successfully' };
  }

  //Forgot Password with transaction-ready logic
  async forgotPassword(email: string) {
    const account = await this.accountRepo.findOne({ where: { email } });
    if (!account) throw new NotFoundException('No user found with this email');

    const relation = account.role.toLowerCase();
    const accountWithRelation = await this.accountRepo.findOne({
      where: { id: account.id },
      relations: [relation],
    });
    const user = accountWithRelation?.[relation];
    if (!user) throw new NotFoundException(`${relation} not found`);

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    user.resetCode = resetCode;
    user.resetCodeExpiry = expiry;

    const payload: Payload = {
      sub: account.id,
      email: account.email,
      role: account.role,
    };
    const token = generateToken(this.jwtService, payload);

    const repo = this.getRepositoryByRole(account.role);
    await repo.save(user);

    await this.mailService.sendMail({
      to: email,
      subject: 'Password Reset Code',
      text: `Your reset code is: ${resetCode}`,
    });

    return { message: 'Reset code sent successfully', token };
  }

  //Verify Reset password code
  async verifyResetCode(userid: number, code: string) {
    const account = await this.accountRepo.findOne({ where: { id: userid } });
    if (!account) throw new NotFoundException('User not found');

    const relation = account.role.toLowerCase();
    const accountWithRelation = await this.accountRepo.findOne({
      where: { id: account.id },
      relations: [relation],
    });
    const user = accountWithRelation?.[relation];
    if (!user) throw new NotFoundException(`${relation} not found`);

    if (!code || user.resetCode !== code) throw new BadRequestException('Invalid reset code');
    if (user.resetCodeExpiry && user.resetCodeExpiry < new Date())
      throw new BadRequestException('Reset code expired');

    return { message: 'Reset code verified successfully' };
  }

  async forgotPasswordResend(accountId: number) {
  const account = await this.accountRepo.findOne({ where: { id: accountId } });
  if (!account) throw new NotFoundException('Account not found');

  const relation = account.role.toLowerCase();
  const accountWithRelation = await this.accountRepo.findOne({
    where: { id: accountId },
    relations: [relation],
  });
  const user = accountWithRelation?.[relation];
  if (!user) throw new NotFoundException(`${relation} not found`);

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 5 * 60 * 1000);

  user.resetCode = resetCode;
  user.resetCodeExpiry = expiry;

  const repo = this.getRepositoryByRole(account.role);
  await repo.save(user);

  await this.mailService.sendMail({
    to: account.email,
    subject: 'Resend Reset Code',
    text: `Your new reset code is: ${resetCode}`,
  });

  return { message: 'Reset code resent successfully' };
}

  //Reset password with transaction
  async resetPassword(userId: number, newPassword: string) {
    const account = await this.accountRepo.findOne({ where: { id: userId } });
    if (!account) throw new NotFoundException('Account not found');

    const relation = account.role.toLowerCase();
    const accountWithRelation = await this.accountRepo.findOne({
      where: { id: userId },
      relations: [relation],
    });
    const profile = accountWithRelation?.[relation];
    if (!profile) throw new NotFoundException(`${relation} profile not found`);
    if (!profile.resetCode) throw new BadRequestException('No reset request found');

    const hash = await bcrypt.hash(newPassword, 10);

    return await this.dataSource.transaction(async (manager) => {
      const accountRepoTx = manager.getRepository(Account);
      const profileRepoTx = this.getRepositoryByRole(account.role, manager);

      account.password = hash;
      await accountRepoTx.save(account);

      profile.password = hash;
      profile.resetCode = null;
      profile.resetCodeExpiry = null;
      await profileRepoTx.save(profile);

      return { message: 'Password reset successfully in both tables' };
    });
  }

  async deactivateAccount(userId: number, plainText: string, userService: IAuthUser) {
    const user = await userService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await userService.validatePassword(plainText, user);
    if (!isMatch) throw new UnauthorizedException('Invalid Password');

    await userService.deactivateUser(userId);

    return { message: 'Deactivated successfully' };
  }

  async deleteAccount(userId: number, plainText: string, userService: IAuthUser) {
    const user = await userService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await userService.validatePassword(plainText, user);
    if (!isMatch) throw new UnauthorizedException('Invalid Password');

    await userService.deleteUser(userId);

    return { message: 'Deleted Successfully' };
  }

  //helper
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}