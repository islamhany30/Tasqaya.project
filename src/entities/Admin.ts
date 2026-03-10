import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Company } from './Company';
import { Worker } from './Worker';
import { Supervisor } from './Supervisor';
import { JobPost } from './JobPost';
import { Account } from './Accounts';

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 120 })
  email: string;

  @Exclude()
  @Column()
  password: string;

  @Column({ length: 255, nullable: true })
  profileImage: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 255, nullable: true })
  address: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  verificationCode?: string | null;

  @Exclude()
  @Column({ nullable: true, type: 'timestamp' })
  verificationCodeExpiry?: Date | null;

  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  resetCode: string | null;

  @Exclude()
  @Column({ nullable: true, type: 'timestamp' })
  resetCodeExpiry: Date | null;

  @OneToOne(() => Account, (account) => account.admin, {
    onDelete: 'CASCADE', // لو مسحت الـ Account، يتمسح الـ Worker أوتوماتيك
    nullable: false, // مينفعش worker بدون account
  })
  @JoinColumn({ name: 'accountId' }) // ده العمود اللي هيتخزن فيه الـ ID بتاع الـ Account
  account: Account;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
