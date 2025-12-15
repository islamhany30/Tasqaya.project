import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Product } from './Products.entity';
import { ReviewRating } from '../Types/Rating';
import { ReviewTitle } from 'src/Types/Title.rating';

@Entity()
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ReviewTitle,
  })
  title: ReviewTitle;

  @Column({ type: 'nvarchar' })
  comment: string;

  @Column({
    type: 'enum',
    enum: ReviewRating,
  })
  rating: ReviewRating;  

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.reviews, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Product, (product) => product.reviews, { onDelete: 'CASCADE' })
  product: Product;
}
