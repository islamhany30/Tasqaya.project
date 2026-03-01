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
import * as fs from 'fs';
import { Worker } from 'src/entities/Worker';
import { CreateWorkerDto } from './../Worker/Dto/CreateWorker.dto';
import { UserRole } from 'src/Enums/User.role';
import { IAuthUser } from 'src/Auth/interfaces/IAuthUser.interface';
import { AuthService } from 'src/Auth/Auth.service';

@Injectable()
export class WorkerService implements IAuthUser {
  constructor(
    @InjectRepository(Worker) private readonly workerRepository: Repository<Worker>,
    private readonly authService: AuthService,
  ) {}

  async findByEmail(email: string): Promise<any> {
    return await this.workerRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<any> {
    return await this.workerRepository.findOne({ where: { id } });
  }

  async validatePassword(plainText: string, user: any): Promise<boolean> {
    try {
      return await bcrypt.compare(plainText, user.password);
    } catch {
      return false;
    }
  }

  async createUser(data: Partial<Worker>): Promise<any> {
    const admin = this.workerRepository.create(data);
    return await this.workerRepository.save(admin);
  }

  async verifyUser(userId: number): Promise<void> {
    await this.workerRepository.update(userId, {
      isVerified: true,
      verificationCode: null,
      verificationCodeExpiry: null,
    });
  }

  async setVerificationCode(userId: number, code: string, expiry: Date): Promise<void> {
    await this.workerRepository.update(userId, {
      verificationCode: code,
      verificationCodeExpiry: expiry,
    });
  }

  async setResetCode(email: string, code: string, expiry: Date): Promise<void> {
    await this.workerRepository.update(
      { email },
      {
        resetCode: code,
        resetCodeExpiry: expiry,
      },
    );
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.workerRepository.update(userId, {
      password: hashedPassword,
    });
  }

  async clearResetCode(userId: number): Promise<void> {
    await this.workerRepository.update(userId, {
      resetCode: null,
      resetCodeExpiry: null,
    });
  }

  async deactivateUser(userId: number): Promise<any> {
    await this.workerRepository.update(userId, {
      isActive: false,
    });
  }

  async deleteUser(userId: number): Promise<any> {
    await this.workerRepository.delete(userId);
  }

  //~~~~~~~~~~~~~~~~DELEGATIONS TO AUTH SERVICE BY PASSING this KEYWORD~~~~~~~~~~~~~~~~~~~~~

  async register(dto: CreateWorkerDto): Promise<any> {
    const { confirmPassword, ...rest } = dto;
    return this.authService.register(rest, 'A verification code sent to you by email', this, UserRole.WORKER);
  }

  async verifyWorker(code: string, workerId: number): Promise<any> {
    return this.authService.verifyUser(code, workerId, this);
  }

  async resendVerification(workerId: number): Promise<any> {
    return this.authService.resendVerification(workerId, this);
  }

  async login(dto: { email: string; password: string }): Promise<any> {
    return this.authService.login(dto.email, dto.password, this, UserRole.WORKER);
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

  //~~~~~~~~~~~~~~~~~~~~~WORKER DOMAIN SPECIFIC LOGIC~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  async changeStatus(workerId: number, isActive: boolean): Promise<any> {
    const worker = await this.findById(workerId);

    if (!worker) throw new NotFoundException('User not found');

    await this.workerRepository.update(workerId, { isActive });

    return {
      message: `Worker account has been ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }
}
