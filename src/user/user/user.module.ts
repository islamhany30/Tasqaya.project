import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from 'src/entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from 'src/Mail/Mail.module';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import {  ConfigService } from '@nestjs/config';
import { Address } from 'src/entities/Address.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User,Address]),
    MailModule,
    JwtModule.registerAsync({
    inject: [ConfigService],
    useFactory:async (config: ConfigService):Promise<JwtModuleOptions> => {
    return {
      secret: config.get<string>('JWT_SECRET'),
      signOptions: {
        expiresIn: config.get<number>('JWT_EXPIRES_IN'),
      },
    };
  },
  global:true
})
],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}