import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Request } from 'express';
import { UserRole } from '../Enums/User.role';
import { Company } from '../entities/Company';
import { Admin } from '../entities/Admin';
import { Supervisor } from '../entities/Supervisor';
import { Worker } from '../entities/Worker';

@Injectable()
export class JwtRegisterAuthGuard implements CanActivate {
  private readonly entityMap = {
    [UserRole.ADMIN]: Admin,
    [UserRole.WORKER]: Worker,
    [UserRole.SUPERVISOR]: Supervisor,
    [UserRole.COMPANY]: Company,
  };

  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      const { sub, role } = payload;

      const targetEntity = this.entityMap[role];

      if (!targetEntity) {
        throw new UnauthorizedException('Invalid role identified in token');
      }

      const account = await this.dataSource.getRepository(targetEntity).findOne({ where: { id: sub } });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      if ((account as any).isActive === false) {
        throw new ForbiddenException('Your account is deactivated!');
      }

      // إرفاق الـ payload بالطلب لاستخدامه في الـ Controller
      request['user'] = payload;

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
