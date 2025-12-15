import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from 'src/entities/Brand.entity';
import { BrandService } from './Brand.service';
import { BrandController } from './Brand.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Brand])],
  controllers: [BrandController],
  providers: [BrandService],
  exports:[BrandService]
})
export class BrandModule {}
