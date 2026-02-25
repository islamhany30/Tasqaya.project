import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserRole } from '../Enums/User.role';

import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { Admin } from '../entities/Admin';
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource, //
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

      // ← check role first before hitting the DB
      if (payload.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Access denied: Admins only');
      }

      // ← then verify the account is active and verified
      const account = await this.dataSource.getRepository(Admin).findOne({ where: { id: payload.sub } });

      if (!account) throw new NotFoundException('Account not found');
      if (!account.isActive) throw new ForbiddenException('Your account is deactivated!');
      if (!account.isVerified) throw new ForbiddenException('Your account is not verified!');

      request['user'] = payload;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
