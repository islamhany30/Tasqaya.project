import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MailModule } from '../Mail/Mail.module';
import { AuthService } from './Auth.service';
import { AuthController } from './Auth.controller';

// Entities
import { Account } from '../entities/Accounts';
import { Worker } from '../entities/Worker';
import { Company } from '../entities/Company';
import { Admin } from '../entities/Admin';
import { Supervisor } from '../entities/Supervisor';

@Module({
  imports: [
    MailModule,
    TypeOrmModule.forFeature([Account, Worker, Company, Admin, Supervisor]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      global: true, // ← keeps JWT available everywhere
      useFactory: async (config: ConfigService): Promise<JwtModuleOptions> => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<number>('JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}