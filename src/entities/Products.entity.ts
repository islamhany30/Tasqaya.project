import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Brand } from './Brand.entity'
import { Category } from './Category.entity';
import { Supplier } from './supplier.entity';
import { Car } from './Car.entity';
import { Review } from './Review.entity';
import { CartItem } from './CartItem.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'nvarchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'nvarchar', length: 255, nullable: false })
  partNumber: string;

  @Column({ type: 'text', nullable: false })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  price: number;

  @Column({ type: 'int', nullable: false })
  stock: number;

  // ----- Relations -----

  @ManyToOne(() => Brand, { onDelete: 'SET NULL', nullable: true  })
  brand: Brand;

  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true  })
  category: Category;

  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true  })
  supplier: Supplier;

  @ManyToMany(() => Car, (car) => car.products)
  @JoinTable({
    name: 'product_cars',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'car_id', referencedColumnName: 'id' },
  })
  cars: Car[];

  @OneToMany(() => CartItem, cartitem => cartitem.product, { onDelete: 'CASCADE' })
  cartitems: CartItem[];


  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @Column({ type: 'nvarchar', length: 500, nullable: true })
  image: string | null;

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];

  @Column({
    type: 'decimal',
    precision: 2, 
    scale: 1,     
    default: 0.0
  })
  averageRate: number;
}
