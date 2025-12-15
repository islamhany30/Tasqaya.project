import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Car } from 'src/entities/Car.entity';
import { CarService } from './Car.service';
import { CarController } from './Car.controller';
import { BrandService } from 'src/AllMoudles/Brand/Brand.service';

@Module({
  imports: [TypeOrmModule.forFeature([Car])],
  controllers: [CarController],
  providers: [CarService],
})
export class CarModule {}
