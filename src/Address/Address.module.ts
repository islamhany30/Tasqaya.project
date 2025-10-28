import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/Address.entity';
import { User } from '../entities/user.entity';
import { AddressService } from './Address.Service';
import { AddressController } from './Address.Controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Address, User]), 
  ],
  controllers: [AddressController],
  providers: [AddressService],
})
export class AddressModule {}
