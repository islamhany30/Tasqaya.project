import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Cart } from './Cart.entity';
import { Product } from './Products.entity';

@Entity()
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number; 

  @ManyToOne(() => Cart, cart => cart.cartitems, { onDelete: 'CASCADE' })
  cart: Cart;

  @ManyToOne(() => Product, product => product.cartitems, { onDelete: 'CASCADE' })
  product: Product;

  @Column()
  quantity: number; 

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number; 

  @CreateDateColumn()
  addedAt: Date; 

  @UpdateDateColumn()
  updatedAt: Date; 
}
