import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../../entities/Admin'; 
import * as bcrypt from 'bcryptjs';
import { MailService } from '../../Mail/MailService';
import { MailDTO } from '../../Mail/dto/Mail.dto';
import { JwtService } from '@nestjs/jwt';
import { generateToken } from '../../common/utils.jwt';
import { Payload } from '../../Types/Payload';
import { UserRole } from '../../Enums/User.role';
import * as path from 'path';
import * as fs from 'fs';

import { CreateAdminDto } from './Dto/CreateAdminDto';
import { LoginAdminDto } from './Dto/LoginAdminDto'; 
import { UpdateAdminDto } from './Dto/UpdateAdminDto';
import { ChangeAdminPasswordDto } from './Dto/ChangeAdminPasswordDto';
import { ResetAdminPasswordDto } from './Dto/ResetAdminPasswordDto';
import { ForgotAdminPasswordDto } from './Dto/ForgotAdminPasswordDto';
import { VerifyAdminResetDto } from './Dto/VerifyAdminResetDto';
import { Company } from 'src/entities/Company';
import { ChangeCompanyStatusDto } from '../Company/Dto/change-company-status.dto';
import { CompanyService } from '../Company/Company.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly companyService: CompanyService
  ) {}

  async register(dto: CreateAdminDto): Promise<any> {
    const exist = await this.adminRepository.findOne({ where: { email: dto.email } });
    if (exist) throw new BadRequestException('Admin email already registered');

    const hashedPassword = await bcrypt.hash(dto.passwordHash, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // استبعاد confirmPassword قبل الحفظ في قاعدة البيانات
    const { confirmPassword, ...adminData } = dto;
    
    const admin = this.adminRepository.create({
      ...adminData,
      passwordHash: hashedPassword,
      isVerified: false,
      isActive: true,
      verificationCode,
      verificationCodeExpiry: new Date(Date.now() + 5 * 60 * 1000),
    });

    await this.adminRepository.save(admin);

    await this.mailService.sendMail({
      to: admin.email,
      subject: 'Verify your Admin account',
      text: `Your verification code is: ${verificationCode}`
    });

    const payload: Payload = {
      sub: admin.id,
      email: admin.email,
      role: UserRole.ADMIN,
    };
    const token = generateToken(this.jwtService, payload);

    return { message: 'Admin registered successfully. Verification code sent to email.', token };
  }

  async verifyAdmin(dto: MailDTO, adminId: number): Promise<any> {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.isVerified) throw new BadRequestException('Admin already verified');

    // حل مشكلة الـ Null Check لضمان توافق TypeScript
    if (!admin.verificationCode || !admin.verificationCodeExpiry) {
      throw new BadRequestException('No verification code found. Please request a new one.');
    }

    if (admin.verificationCode !== dto.VERFICATIONCODE) {
      throw new BadRequestException('Invalid verification code');
    }

    if (admin.verificationCodeExpiry < new Date()) {
      throw new BadRequestException('Verification code expired. Please request a new one.');
    }

    admin.isVerified = true;
    admin.verificationCode = null;
    admin.verificationCodeExpiry = null;

    await this.adminRepository.save(admin);

    return { message: 'Admin verified successfully' };
  }

  async login(loginDto: LoginAdminDto) {
    const { email, passwordHash } = loginDto;

    const admin = await this.adminRepository.findOne({ where: { email } });
    if (!admin) throw new UnauthorizedException('Invalid email or password');

    if (!admin.isVerified) throw new BadRequestException('Please verify your account first!');

    const isMatch = await bcrypt.compare(passwordHash, admin.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Invalid email or password');

    if (!admin.isActive) throw new ForbiddenException('This account has been deactivated.');

    const payload: Payload = {
      sub: admin.id,
      email: admin.email,
      role: UserRole.ADMIN,
    };
    const token = generateToken(this.jwtService, payload);

    return { message: 'Login successful', access_token: token };
  }

  async editProfile(id: number, dto: UpdateAdminDto) {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');

    Object.assign(admin, dto);
    await this.adminRepository.save(admin);

    return { message: 'Admin profile updated successfully', admin };
  }

  async changePassword(adminId: number, dto: ChangeAdminPasswordDto) {
    const { oldPassword, newPassword } = dto;

    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    const isMatch = await bcrypt.compare(oldPassword, admin.passwordHash);
    if (!isMatch) throw new BadRequestException('Old password is incorrect');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.passwordHash = hashedPassword;
    await this.adminRepository.save(admin);

    return { message: 'Password changed successfully' };
  }

  async updateProfileImage(adminId: number, newImagePath: string) {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    if (admin.profileImage) {
      const oldImagePath = path.resolve(admin.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    admin.profileImage = newImagePath;
    await this.adminRepository.save(admin);

    return admin;
  }

  async resendVerification(adminId: number) {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new BadRequestException('No admin found with this id');
    if (admin.isVerified) throw new BadRequestException('This account is already verified');

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    admin.verificationCode = newCode;
    admin.verificationCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await this.adminRepository.save(admin);

    await this.mailService.sendMail({
      to: admin.email,
      subject: 'Verify your admin account',
      text: `Your new verification code is: ${newCode}`
    });

    return { message: 'A new verification code has been sent to your email' };
  }

  async getAdminById(id: number) {
    const admin = await this.adminRepository.findOne({ 
      where: { id }, 
      relations: ['companies', 'workers', 'supervisors', 'jopposts'] 
    });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async deleteAccount(id: number) {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    await this.adminRepository.remove(admin);
    return { message: 'Admin account deleted successfully' };
  }

  async forgotPassword(body: ForgotAdminPasswordDto) {
    const admin = await this.adminRepository.findOne({ where: { email: body.email } });
    if (!admin) throw new NotFoundException('No admin found with this email.');

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    admin.resetCode = resetCode;
    admin.resetCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await this.adminRepository.save(admin);

    await this.mailService.sendMail({
      to: admin.email,
      subject: 'Admin Password Reset',
      text: `Your password reset code is: ${resetCode}. Valid for 5 minutes.`,
    });

    return { message: 'Reset code has been sent to your email.' };
  }

  async verifyResetCode(dto:VerifyAdminResetDto) {
    const admin = await this.adminRepository.findOne({ where: { email:dto.email } });
    if (!admin) throw new NotFoundException('No admin found with this email');

    if (admin.resetCode !== dto.code) {
      throw new BadRequestException('Invalid reset code.');
    }
    
    // تأكد من عدم انتهاء الصلاحية أيضاً
    if (admin.resetCodeExpiry && admin.resetCodeExpiry < new Date()) {
        throw new BadRequestException('Reset code has expired.');
    }

    return { message: 'Code verified successfully.' };
  }

  async resetPassword(dto: ResetAdminPasswordDto): Promise<any> {
    const { email, newPassword } = dto;

    const admin = await this.adminRepository.findOne({ where: { email } });
    if (!admin) throw new NotFoundException('Admin does not exist');

    if (!admin.resetCode) {
      throw new BadRequestException('No reset request found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    admin.passwordHash = hashedPassword;
    admin.resetCode = null;
    admin.resetCodeExpiry = null;

    await this.adminRepository.save(admin);

    return { message: 'Password reset successfully' };
  }


  async changeCompanyStatus(id: number, statusDto: ChangeCompanyStatusDto) {
    return this.companyService.changeAccountStatus(id, statusDto.isActive);
  }

  async getCompanyDataForAdmin(companyId: number) {
    return this.companyService.getCompanyById(companyId);
  }

    async getAllCompaniesForAdmin() {
    return this.companyService.getAllCompanies();
  }
}