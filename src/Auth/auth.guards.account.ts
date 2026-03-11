import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Account } from '../entities/Accounts';
import { DataSource } from 'typeorm';
import { Request } from 'express';

@Injectable()
export class JwtAccountAuthGuard implements CanActivate {
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
      const payload = await this.jwtService.verifyAsync(token);
      const { sub, role } = payload;

      const roleKey = role.toLowerCase();
      const account = await this.dataSource.getRepository(Account).findOne({
        where: { id: sub },
        relations: [roleKey],
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      if (account.isActive === false) {
        throw new ForbiddenException('Your account is deactivated!');
      }

      const profile = account[roleKey];

      request['user'] = {
        sub: profile.id,
        role: account.role,
        email: account.email,
        id: account.id,
      };

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
