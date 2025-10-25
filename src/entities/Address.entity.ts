import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('Addresses')
export class Address {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  street: string;

  @Column()
  city: string;

  @Column({ nullable: true })
  lat?: string;

  @Column({ nullable: true })
  long?: string;

  @OneToOne(() => User, (user) => user.address, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;
}
