import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../Mail/Mail.module';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { Admin } from '../../entities/Admin';
import { Company } from '../../entities/Company'; // هنحتاجها للـ Injection في الـ Service
import { AdminController } from './Admin.controller';
import { AdminService } from './Admin.service';
import { CompanyModule } from '../Company/Company.module'; // عشان نقدر نستخدم الـ CompanyService

@Module({
  imports: [
    MailModule,
    CompanyModule, 
    TypeOrmModule.forFeature([Admin, Company]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      global: true, 
      useFactory: async (config: ConfigService): Promise<JwtModuleOptions> => {
        return {
          secret: config.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: config.get<number>('JWT_EXPIRES_IN'), 
          },
        };
      },
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}