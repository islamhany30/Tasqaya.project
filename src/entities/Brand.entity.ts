import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Product } from './Products.entity';

@Entity('Brands')
export class Brand {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'nvarchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'nvarchar', length: 255, nullable: false })
  country: string;

  @OneToMany(() => Product, (product) => product.brand)
  products: Product[];
}
