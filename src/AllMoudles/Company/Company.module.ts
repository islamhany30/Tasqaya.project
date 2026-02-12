import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from 'src/Mail/Mail.module';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import {  ConfigService } from '@nestjs/config';
import { Company } from 'src/entities/Company';
import { CompanyController } from './Company.controller';
import { CompanyService } from './Company.service';
import { Admin } from 'src/entities/Admin';
import { Task } from 'src/entities/Task';
import { CompanyFeedback } from 'src/entities/CompanyFeedback';

@Module({
  imports: [MailModule,TypeOrmModule.forFeature([Company,Admin,Task,CompanyFeedback]),
  JwtModule.registerAsync({
    inject: [ConfigService],
    global:true,
    useFactory:async (config: ConfigService):Promise<JwtModuleOptions> => {
    return {
      secret: config.get<string>('JWT_SECRET'),
      signOptions: {
        expiresIn: config.get<number>('JWT_EXPIRES_IN'),
      },
    };
  }
})
],
  controllers: [CompanyController],
  providers: [CompanyService],
})
export class CompanyModule {}
