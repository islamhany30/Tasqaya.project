import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Supervisor } from 'src/entities/Supervisor';
import { CreateSupervisorDto } from './Dto/CreateSupervisor.dto';
import { UserRole } from 'src/Enums/User.role';
import { IAuthUser } from 'src/Auth/interfaces/IAuthUser.interface';
import { AuthService } from 'src/Auth/Auth.service';

@Injectable()
export class SupervisorService implements IAuthUser {
  constructor(
    @InjectRepository(Supervisor) private readonly supervisorRepository: Repository<Supervisor>,
    private readonly authService: AuthService,
  ) {}

  async findByEmail(email: string): Promise<any> {
    return await this.supervisorRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<any> {
    return await this.supervisorRepository.findOne({ where: { id } });
  }

  async validatePassword(plainText: string, user: any): Promise<boolean> {
    try {
      return await bcrypt.compare(plainText, user.password);
    } catch {
      return false;
    }
  }

  async createUser(data: Partial<Supervisor>): Promise<any> {
    const admin = this.supervisorRepository.create(data);
    return await this.supervisorRepository.save(admin);
  }

  async verifyUser(userId: number): Promise<void> {
    await this.supervisorRepository.update(userId, {
      isVerified: true,
      verificationCode: null,
      verificationCodeExpiry: null,
    });
  }

  async setVerificationCode(userId: number, code: string, expiry: Date): Promise<void> {
    await this.supervisorRepository.update(userId, {
      verificationCode: code,
      verificationCodeExpiry: expiry,
    });
  }

  async setResetCode(email: string, code: string, expiry: Date): Promise<void> {
    await this.supervisorRepository.update(
      { email },
      {
        resetCode: code,
        resetCodeExpiry: expiry,
      },
    );
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.supervisorRepository.update(userId, {
      password: hashedPassword,
    });
  }

  async clearResetCode(userId: number): Promise<void> {
    await this.supervisorRepository.update(userId, {
      resetCode: null,
      resetCodeExpiry: null,
    });
  }

  async deactivateUser(userId: number): Promise<any> {
    await this.supervisorRepository.update(userId, {
      isActive: false,
    });
  }

  async deleteUser(userId: number): Promise<any> {
    await this.supervisorRepository.delete(userId);
  }

  //~~~~~~~~~~~~~~~~DELEGATIONS TO AUTH BY PASSING this KEYWORD~~~~~~~~~~~~~~~~~~~~~
  async register(dto: CreateSupervisorDto): Promise<any> {
    const { confirmPassword, ...rest } = dto;
    return this.authService.register(rest, 'Verify you supervisor account.', this, UserRole.SUPERVISOR);
  }

  async verifySupervisor(code: string, supervisorId: number): Promise<any> {
    return this.authService.verifyUser(code, supervisorId, this);
  }

  async resendVerification(supervisorId: number): Promise<any> {
    return this.authService.resendVerification(supervisorId, this);
  }

  async login(dto: { email: string; password: string }) {
    return this.authService.login(dto.email, dto.password, this, UserRole.SUPERVISOR);
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

  async changePassword(supervisorId: number, dto: { oldPassword: string; newPassword: string }): Promise<any> {
    return this.authService.changePassword(supervisorId, dto.oldPassword, dto.newPassword, this);
  }

  async deactivateAccount(supervisorId: number, dto: { password: string }): Promise<any> {
    return this.authService.deactivateAccount(supervisorId, dto.password, this);
  }

  async deleteAccount(supervisorId: number, dto: { password: string }): Promise<any> {
    return this.authService.deleteAccount(supervisorId, dto.password, this);
  }

  //~~~~~~~~~~~~~~~~~~~SUPERVISOR DOMAIN SPECIFIC LOGIC~~~~~~~~~~~~~~~~~~~~~~~
  async changeStatus(supervisorId: number, isActive: boolean): Promise<any> {
    const supervisor = await this.findById(supervisorId);

    if (!supervisor) throw new NotFoundException('Supervisor not found');

    await this.supervisorRepository.update(supervisorId, { isActive });

    return {
      message: `Supervisor account has been ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }

  async getAllSupervisors(): Promise<any> {
    const supervisors = await this.supervisorRepository.find();

    if (!supervisors) throw new NotFoundException('Supervisors are not found');

    return {
      message: 'Supervisors fetched successfully',
      data: {
        supervisors,
      },
    };
  }

  async getSupervisorById(id: number): Promise<any> {
    const supervisor = await this.findById(id);

    if (!supervisor) throw new NotFoundException('Supervisor not found');

    return {
      message: 'supervisor fetched successfully',
      data: {
        supervisor,
      },
    };
  }
}
