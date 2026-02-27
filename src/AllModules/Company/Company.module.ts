import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../Mail/Mail.module';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Company } from '../../entities/Company';
import { CompanyController } from './Company.controller';
import { CompanyService } from './Company.service';
import { Admin } from '../../entities/Admin';
import { Task } from '../../entities/Task';
import { CompanyFeedback } from '../../entities/CompanyFeedback';
import { AuthModule } from 'src/Auth/Auth.module';

@Module({
  imports: [
    MailModule,
    AuthModule,
    TypeOrmModule.forFeature([Company, Admin, Task, CompanyFeedback]),
    // JwtModule.registerAsync({
    //   inject: [ConfigService],
    //   global: true,
    //   useFactory: async (config: ConfigService): Promise<JwtModuleOptions> => {
    //     return {
    //       secret: config.get<string>('JWT_SECRET'),
    //       signOptions: {
    //         expiresIn: config.get<number>('JWT_EXPIRES_IN'),
    //       },
    //     };
    //   },
    // }),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
