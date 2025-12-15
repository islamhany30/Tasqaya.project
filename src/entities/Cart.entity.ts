import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from "./user.entity";
import { CartItem } from './CartItem.entity';

@Entity()
export class Cart {
  @PrimaryGeneratedColumn()
  id: number;    

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPrice: number;

  @ManyToOne(() => User, user => user.carts, { onDelete: 'CASCADE' })
  user: User; 

  @OneToMany(() => CartItem, cartitem => cartitem.cart, { onDelete: 'CASCADE' })
  cartitems: CartItem[];

  @CreateDateColumn()
  createdAt: Date; 

  @UpdateDateColumn()
  updatedAt: Date; 
}
