import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Product } from './Products.entity';

@Entity('Suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'nvarchar', length: 255,nullable:false })
  name: string;

  @OneToMany(() => Product, (product) => product.supplier)
  products: Product[];
}
