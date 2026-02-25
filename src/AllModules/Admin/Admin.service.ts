import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../../entities/Admin';
import { AuthService } from '../../Auth/Auth.service';
import { IAuthUser } from '../../Auth/interfaces/IAuthUser.interface';
import { UserRole } from '../../Enums/User.role';
import { CompanyService } from '../Company/Company.service';
import { MailService } from '../../Mail/MailService';
import { ChangeCompanyStatusDto } from '../Company/Dto/ChangeCompanyStatus.dto';
import { CreateAdminDto } from './Dto/CreateAdmin.dto';
import { UpdateAdminDto } from './Dto/UpdateAdmin.dto';
import * as path from 'path';
import * as fs from 'fs';
import { privateDecrypt } from 'crypto';
import { PassThrough } from 'stream';

@Injectable()
export class AdminService implements IAuthUser {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly authService: AuthService,
    private readonly companyService: CompanyService,
  ) {}

  //IAuthUser Implementation (called by AuthService)
  async findByEmail(email: string): Promise<any> {
    return this.adminRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<any> {
    return this.adminRepository.findOne({ where: { id } });
  }

  async validatePassword(plainText: string, user: Admin): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(plainText, user.password);
  }

  async createUser(data: Partial<Admin>): Promise<any> {
    const admin = this.adminRepository.create(data);
    return await this.adminRepository.save(admin);
  }

  async verifyUser(userId: number): Promise<void> {
    await this.adminRepository.update(userId, {
      isVerified: true,
      verificationCode: null,
      verificationCodeExpiry: null,
    });
  }

  async setVerificationCode(userId: number, code: string, expiry: Date): Promise<void> {
    await this.adminRepository.update(userId, {
      verificationCode: code,
      verificationCodeExpiry: expiry,
    });
  }

  async setResetCode(email: string, code: string, expiry: Date): Promise<void> {
    await this.adminRepository.update(
      { email },
      {
        resetCode: code,
        resetCodeExpiry: expiry,
      },
    );
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.adminRepository.update(userId, {
      password: hashedPassword,
    });
  }

  async clearResetCode(userId: number): Promise<void> {
    await this.adminRepository.update(userId, {
      resetCode: null,
      resetCodeExpiry: null,
    });
  }

  async deactivateUser(userId: number): Promise<any> {
    await this.adminRepository.update(userId, {
      isActive: false,
    });
  }

  async deleteUser(userId: number): Promise<any> {
    await this.adminRepository.delete(userId);
  }

  //Delegations -> These will be called by the admin controller
  //Pass (this) as the userService
  async register(dto: CreateAdminDto) {
    const { confirmPassword, ...rest } = dto;
    return this.authService.register(rest, 'Verify your admin account', this, UserRole.ADMIN);
  }

  async verifyAdmin(code: string, adminId: number) {
    return this.authService.verifyUser(code, adminId, this);
  }

  async resendVerification(adminId: number) {
    return this.authService.resendVerification(adminId, this);
  }

  async login(dto: { email: string; password: string }) {
    return this.authService.login(dto.email, dto.password, this, UserRole.ADMIN);
  }

  async changePassword(adminId: number, dto: { oldPassword: string; newPassword: string }) {
    return this.authService.changePassword(adminId, dto.oldPassword, dto.newPassword, this);
  }

  async forgotPassword(dto: { email: string }) {
    return this.authService.forgotPassword(dto.email, this);
  }

  async verifyResetCode(dto: { email: string; code: string }) {
    return this.authService.verifyResetCode(dto.email, dto.code, this);
  }

  async resetPassword(dto: { email: string; newPassword: string }) {
    return this.authService.resetPassword(dto.email, dto.newPassword, this);
  }

  //Hard delete
  async deleteAccount(admnId: number, dto: { password: string }) {
    return this.authService.deleteAccount(admnId, dto.password, this);
  }

  // ─── Admin-Specific Domain Logic ──────────────────────────────────

  async getAdmins() {
    const admins = this.adminRepository.find();

    if (!admins) throw new NotFoundException('No Admins is found');

    return {
      message: 'Admins Fetched successfully',
      data: {
        admins,
      },
    };
  }

  async getAdminById(id: number) {
    const admin = await this.adminRepository.findOne({ where: { id } });

    if (!admin) throw new NotFoundException('Admin not found');

    return admin;
  }

  async editProfile(id: number, dto: UpdateAdminDto) {
    const admin = await this.adminRepository.findOne({ where: { id } });

    if (!admin) throw new NotFoundException('Admin not found');

    //Only update fields that are provided in the DTO (allow partial updates)
    //Because i want the other optional fields in the dto if not updated to be in the response as well
    //Because i am using classSerializer, the undefined fields will be excluded from the response, so i want to keep the existing values for those fields in the response
    Object.keys(dto).forEach((key) => {
      if (dto[key] !== undefined) {
        admin[key] = dto[key];
      }
    });

    await this.adminRepository.save(admin);

    return {
      message: 'Admin profile is updated successfully',
      data: {
        admin,
      },
    };
  }

  async updateProfileImage(adminId: number, newImagePath: string) {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    if (admin.profileImage) {
      const oldImagePath = path.resolve(admin.profileImage);
      if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
    }

    admin.profileImage = newImagePath;
    await this.adminRepository.save(admin);

    return { message: 'Admin profile image updated successfully', profileImage: newImagePath };
  }

  async changeCompanyStatus(id: number, dto: { isActive: boolean }) {
    return this.companyService.changeStatus(id, dto.isActive);
  }

  async getAllCompaniesForAdmin() {
    return this.companyService.getAllCompanies();
  }

  async getCompanyById(id: number) {
    return this.companyService.getCompanyById(id);
  }
}
