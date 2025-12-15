import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Product } from './Products.entity';

@Entity('cars')
export class Car {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'nvarchar', length: 255, nullable: false })
  make: string; 

  @Column({ type: 'nvarchar', length: 255, nullable: false })
  model: string; 

  @Column({ type: 'int', nullable: false })
  year: number;

  @ManyToMany(() => Product, (product) => product.cars)
  products: Product[];
}
