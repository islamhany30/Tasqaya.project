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
import { Worker } from '../entities/Worker';
import { Supervisor } from '../entities/Supervisor';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  // خريطة لربط الأدوار بالـ Entities المناسبة
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
      // 1. فك تشفير التوكن والتحقق من صحته
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      const { sub, role } = payload;

      // 2. تحديد الـ Entity بناءً على الـ Role
      const targetEntity = this.entityMap[role];
      if (!targetEntity) {
        throw new UnauthorizedException('Invalid role identified in token');
      }

      // 3. البحث في قاعدة البيانات بشكل ديناميكي عن طريق DataSource
      const account = await this.dataSource
        .getRepository(targetEntity)
        .findOne({ where: { id: sub } });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      // 4. الحفاظ على اللوجيك الخاص بك (التحقق من النشاط والتفعيل)
      
      // التعامل مع اختلاف مسمى حقل النشاط (active vs isActive)
      const isActive = role === UserRole.COMPANY ? (account as any).isActive : (account as any).active;
      if (isActive === false) {
        throw new ForbiddenException('Your account is deactivated!');
      }

      // التحقق من أن الحساب مفعل (isVerified)
      // ملاحظة: افترضنا أن الحقل اسمه isVerified في كلا الـ Entities كما هو في الكود السابق
      if ((account as any).isVerified === false) {
        throw new ForbiddenException('Your account is not verified!');
      }

      // إرفاق البيانات بالطلب
      request['user'] = payload;

      return true;
    } catch (error) {
      // إعادة تمرير أخطاء الـ Forbidden والـ NotFound كما هي
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}