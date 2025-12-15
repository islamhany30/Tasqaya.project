import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from '../../entities/Cart.entity';
import { CartItem } from '../../entities/CartItem.entity';
import { CartService } from './Cart.service';
import { CartController } from './Cart.controller';
import { Product } from '../../entities/Products.entity';
import { User } from 'src/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem, Product,User]),
  ],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
