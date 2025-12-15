import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from 'src/entities/Products.entity';
import { ProductService } from './Product.Service';
import { ProductController } from './Product.Controller';
import { Brand } from 'src/entities/Brand.entity';
import { Category } from 'src/entities/Category.entity';
import { Supplier } from 'src/entities/supplier.entity';
import { Car } from 'src/entities/Car.entity';
import { Review } from 'src/entities/Review.entity';
import { User } from 'src/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Brand, Category, Supplier, Car,Review,User])],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
