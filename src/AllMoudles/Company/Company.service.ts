// company.service.ts
import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../entities/Company';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../../Mail/MailService';
import { MailDTO } from '../../Mail/dto/Mail.dto';
import { JwtService } from '@nestjs/jwt';
import { generateToken } from '../../common/utils.jwt';
import { LoginCompanyDto } from './Dto/login-company.dto';
import { CreateCompanyDto } from './Dto/create-company.dto';
import { ChangeCompanyPasswordDto } from './Dto/change-company-password.dto';
import { ChangeCompanyStatusDto } from './Dto/change-company-status.dto';
import { UpdateCompanyDto } from './Dto/update-company.dto';
import { ResetCompanyPasswordDto } from './Dto/reset-company-password.dto'; 
import { ForgotCompanyPasswordDto } from './Dto/forgot-company-password.dto'; 
import { Payload } from '../../Types/Payload';
import { UserRole } from '../../Enums/User.role';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: CreateCompanyDto): Promise<any> {
    const exist = await this.companyRepository.findOne({ where: { email: dto.email } });
    if (exist) throw new BadRequestException('Email already registered');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const company = this.companyRepository.create(dto);
    company.password = hashedPassword;
    company.isVerified = false;
    company.isActive = true;
    company.verificationCode = verificationCode;  
    company.verificationCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await this.companyRepository.save(company);

    await this.mailService.sendMail({
      to: company.email,
      subject: 'Verify your company account',
      text: `Your verification code is: ${verificationCode}`
    });

    const payload: Payload = {
      sub: company.id,
      email: company.email,
      role: UserRole.COMPANY,
    };
    const token = generateToken(this.jwtService, payload);

    return { message: 'Company registered successfully. Verification code sent to email.', token };
  }

  async verifyCompany(dto: MailDTO, companyId: number): Promise<any> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new BadRequestException('Company not found');

    if (company.isVerified) throw new BadRequestException('Company already verified');

    if (!company.verificationCode || !company.verificationCodeExpiry) {
      throw new BadRequestException('No verification code found. Please request a new one.');
    }

    if (company.verificationCodeExpiry < new Date()) {
      throw new BadRequestException('Verification code expired. Please request a new one.');
    }

    if (company.verificationCode !== dto.VERFICATIONCODE) {
      throw new BadRequestException('Invalid verification code');
    }

    company.isVerified = true;
    company.verificationCode = null;
    company.verificationCodeExpiry = null;

    await this.companyRepository.save(company);

    return { message: 'Company verified successfully' };
  }

  async login(loginDto: LoginCompanyDto) {
    const { email, password } = loginDto;

    const company = await this.companyRepository.findOne({ where: { email } });
    if (!company) throw new UnauthorizedException('Invalid email or password');

    if (!company.isVerified) throw new BadRequestException('Please verify your account first!');

    const isMatch = await bcrypt.compare(password, company.password);
    if (!isMatch) throw new UnauthorizedException('Invalid email or password');

    if (!company.isActive) throw new ForbiddenException('This account has been deactivated by the admin.');

    const payload: Payload = {
      sub: company.id,
      email: company.email,
      role: UserRole.COMPANY,
    };
    const token = generateToken(this.jwtService, payload);

    return { message: 'Login successful', access_token: token };
  }

  async forgotPassword(body: ForgotCompanyPasswordDto) {
    const company = await this.companyRepository.findOne({ where: { email: body.email } });
    if (!company) throw new NotFoundException('No company found with this email.');

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    company.resetCode = resetCode;
    company.resetCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await this.companyRepository.save(company);

    await this.mailService.sendMail({
      to: company.email,
      subject: 'Reset Your Password',
      text: `Your password reset code is: ${resetCode}. It will expire in 5 minutes.`,
    });

    return { message: 'Reset code has been sent to your email.' };
  }

  async verifyResetCode(email: string, code: string) {
    const company = await this.companyRepository.findOne({ where: { email } });
    if (!company) throw new NotFoundException('No company found with this email');

    if (company.resetCode !== code) {
      throw new BadRequestException('Invalid reset code.');
    }
    return { message: 'Code verified successfully.' };
  }

  async resetPassword(dto: ResetCompanyPasswordDto): Promise<any> {
    const { email, newPassword } = dto;

    const company = await this.companyRepository.findOne({ where: { email } });
    if (!company) throw new NotFoundException('Company with this email does not exist');

    if (!company.resetCode || !company.resetCodeExpiry) {
      throw new BadRequestException('No reset request found for this company');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    company.password = hashedPassword;
    company.resetCode = null;
    company.resetCodeExpiry = null;

    await this.companyRepository.save(company);

    return { message: 'Password reset successfully' };
  }

  async updateProfileImage(companyId: number, newImagePath: string) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    if (company.profileImage) {
      const oldImagePath = path.resolve(company.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    company.profileImage = newImagePath;
    await this.companyRepository.save(company);

    return company;
  }

  async changeAccountStatus(id: number, statusDto: ChangeCompanyStatusDto) {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    company.isActive = statusDto.isActive;
    await this.companyRepository.save(company);

    return { message: `Company account has been ${statusDto.isActive ? 'activated' : 'deactivated'} successfully.` };
  }

  async changePassword(companyId: number, dto: ChangeCompanyPasswordDto) {
    const { oldPassword, newPassword } = dto;

    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const isMatch = await bcrypt.compare(oldPassword, company.password);
    if (!isMatch) throw new BadRequestException('Old password is incorrect');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    company.password = hashedPassword;
    await this.companyRepository.save(company);

    return { message: 'Password changed successfully' };
  }

  async editProfile(id: number, dto: UpdateCompanyDto) {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    Object.assign(company, dto);
    await this.companyRepository.save(company);

    return { message: 'Company profile updated successfully' };
  }

  async resendVerification(companyId: number) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new BadRequestException('No company found with this id');
    if (company.isVerified) throw new BadRequestException('This account is already verified');

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    company.verificationCode = newCode;
    company.verificationCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await this.companyRepository.save(company);

    await this.mailService.sendMail({
      to: company.email,
      subject: 'Verify your company account',
      text: `Your verification code is: ${newCode}`
    });

    return { message: 'A new verification code has been sent to your email' };
  }

  async deleteAccount(companyId: number) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    await this.companyRepository.remove(company);
    return { message: 'Company account deleted successfully' };
  }

  async getCompanyById(id: number) {
    const company = await this.companyRepository.findOne({ where: { id }, relations: ['tasks', 'feedback'] });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }
}