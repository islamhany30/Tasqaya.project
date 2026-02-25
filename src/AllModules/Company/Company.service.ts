import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../entities/Company';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../../Mail/MailService';
import { MailDTO } from '../../Mail/dto/Mail.dto';
import { JwtService } from '@nestjs/jwt';
import { generateToken } from '../../common/utils.jwt';
import { CreateCompanyDto } from './Dto/CreateCompany.dto';
import { UpdateCompanyDto } from './Dto/UpdateCompany.dto';
import { Payload } from '../../Types/Payload';
import { UserRole } from '../../Enums/User.role';
import * as path from 'path';
import * as fs from 'fs';
import { IAuthUser } from 'src/Auth/interfaces/IAuthUser.interface';
import { AuthService } from 'src/Auth/Auth.service';

@Injectable()
export class CompanyService implements IAuthUser {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  //IAuth CONTRACT
  async findByEmail(email: string): Promise<any> {
    return await this.companyRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<any> {
    return await this.companyRepository.findOne({ where: { id } });
  }

  async validatePassword(plainText: string, user: any): Promise<boolean> {
    return await bcrypt.compare(plainText, user.password);
  }

  async createUser(data: Partial<Company>): Promise<any> {
    const company = this.companyRepository.create(data);
    return await this.companyRepository.save(company);
  }

  async setVerificationCode(userId: number, code: string, expiry: Date): Promise<any> {
    await this.companyRepository.update(userId, {
      verificationCode: code,
      verificationCodeExpiry: expiry,
    });
  }

  async verifyUser(userId: number): Promise<any> {
    await this.companyRepository.update(userId, {
      isVerified: true,
      verificationCode: null,
      verificationCodeExpiry: null,
    });
  }

  async setResetCode(email: string, code: string, expiry: Date): Promise<void> {
    await this.companyRepository.update({ email }, { resetCode: code, resetCodeExpiry: expiry });
  }

  async clearResetCode(userId: number): Promise<void> {
    await this.companyRepository.update(userId, {
      resetCode: null,
      resetCodeExpiry: null,
    });
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.companyRepository.update(userId, {
      password: hashedPassword,
    });
  }

  async deactivateUser(userId: number): Promise<any> {
    await this.companyRepository.update(userId, {
      isActive: false,
    });
  }

  async deleteUser(userId: number): Promise<any> {
    await this.companyRepository.delete(userId);
  }

  //~~~~~~~~~~~~~~~~~DELEGATION OF AUTH BY PASSING THE this KEYWORD~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  async register(dto: CreateCompanyDto): Promise<any> {
    const { confirmPassword, ...rest } = dto;
    return this.authService.register(rest, 'Verify your company account', this, UserRole.COMPANY);
  }

  async verifyCompany(code: string, companyId: number): Promise<any> {
    return this.authService.verifyUser(code, companyId, this);
  }

  async resendVerification(companyId: number): Promise<any> {
    return this.authService.resendVerification(companyId, this);
  }

  async login(dto: { email: string; password: string }): Promise<any> {
    return this.authService.login(dto.email, dto.password, this, UserRole.COMPANY);
  }

  async forgotPassword(dto: { email: string }): Promise<any> {
    return this.authService.forgotPassword(dto.email, this);
  }

  async verifyResetCode(dto: { email: string; code: string }): Promise<any> {
    return this.authService.verifyResetCode(dto.email, dto.code, this);
  }

  async resetPassword(dto: { email: string; newPassword: string }): Promise<any> {
    return this.authService.resetPassword(dto.email, dto.newPassword, this);
  }

  async changePassword(companyId: number, dto: { oldPassword: string; newPassword: string }): Promise<any> {
    return this.authService.changePassword(companyId, dto.oldPassword, dto.newPassword, this);
  }

  async deactivateAccount(companyId: number, dto: { password: string }): Promise<any> {
    return await this.authService.deactivateAccount(companyId, dto.password, this);
  }

  async deleteAccount(companyId: number, dto: { password: string }): Promise<any> {
    return await this.authService.deleteAccount(companyId, dto.password, this);
  }

  //~~~~~~~~~~~~~~~~~~~ COMPANY DOMAIN SPECIFIC LOGIC ~~~~~~~~~~~~~~~~
  async updateProfileImage(companyId: number, newImagePath: string) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('company not found');

    if (company.profileImage) {
      const oldImagePath = path.resolve(company.profileImage);
      if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
    }

    company.profileImage = newImagePath;
    await this.companyRepository.save(company);

    return { message: 'Company profile image updated successfully', profileImage: newImagePath };
  }

  async editProfile(companyId: number, dto: UpdateCompanyDto): Promise<any> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });

    if (!company) throw new NotFoundException('Company not found');

    Object.keys(dto).forEach((key) => {
      if (dto[key] !== undefined) {
        company[key] = dto[key];
      }
    });

    await this.companyRepository.save(company);

    return {
      message: 'Company profile updated successfully!',
      data: {
        company,
      },
    };
  }
  async changeStatus(companyId: number, isActive: boolean): Promise<any> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });

    if (!company) throw new NotFoundException('Company not found');

    await this.companyRepository.update(companyId, { isActive });

    return {
      message: `Company account has been ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }

  async getAllCompanies(): Promise<any> {
    const companies = await this.companyRepository.find();

    if (!companies) throw new NotFoundException('No Companies to be found');

    return {
      message: 'Successfully fetched',
      data: {
        companies,
      },
    };
  }

  async getCompanyById(id: number): Promise<any> {
    const company = await this.companyRepository.find({ where: { id } });

    if (!company) throw new NotFoundException('Company not found');

    return {
      message: 'Company fetched successfully',
      data: {
        company,
      },
    };
  }
}
