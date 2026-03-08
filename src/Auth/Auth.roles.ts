import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Account } from 'src/entities/Accounts';
import { DataSource } from 'typeorm';
import { Request } from 'express';
import { Admin } from '../entities/Admin';

@Injectable()
export class AdminAuthGuard implements CanActivate {
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
      // فك التوكن
      const payload = await this.jwtService.verifyAsync(token);
      const { sub, role } = payload;

      // التأكد من أن الدور Admin
      if (role !== 'ADMIN') {
        throw new ForbiddenException('Access denied: Admins only');
      }

      // جلب بيانات الحساب والعلاقة مع Admin
      const account = await this.dataSource.getRepository(Account).findOne({
        where: { id: sub },
        relations: ['admin'], // اسم العلاقة مع جدول Admin
      });

      if (!account) {
        throw new NotFoundException('Admin account not found');
      }

      if (!account.isActive) {
        throw new ForbiddenException('This admin account is deactivated!');
      }

      const profile = account.admin;

      // إرفاق الداتا بالـ request بنفس طريقة JwtAccountAuthGuard
      request['user'] = {
        sub: profile.id,
        role: account.role,
        email: account.email,
        id: account.id,
      };

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
