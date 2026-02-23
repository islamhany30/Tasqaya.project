// src/Auth/Auth.module.ts

import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailModule } from '../Mail/Mail.module';
import { AuthService } from './Auth.service';

@Module({
  imports: [
    MailModule,
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
  providers: [AuthService],
  exports: [AuthService], // ← export so every module can inject it
})
export class AuthModule {}
