import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, CreateDateColumn, OneToOne } from 'typeorm';
import { Task } from './Task';
import { CompanyFeedback } from './CompanyFeedback';
import { Admin } from './Admin';
import { Exclude } from 'class-transformer';
import { Payment } from './Payment';
import { Account } from './Accounts';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  name: string;

  @Column({ unique: true, length: 150 })
  email: string;

  @Exclude()
  @Column({ length: 255 })
  password: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 255 })
  address: string;

  @Column({ nullable: true, type: 'varchar' })
  profileImage: string | null;

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



  // الربط الأساسي هنا
  @OneToOne(() => Account, (account) => account.worker, { 
    onDelete: 'CASCADE', // لو مسحت الـ Account، يتمسح الـ Worker أوتوماتيك
    nullable: false      // مينفعش worker بدون account
  })
  @JoinColumn({ name: 'accountId' }) // ده العمود اللي هيتخزن فيه الـ ID بتاع الـ Account
  account: Account;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Task, (t) => t.company, { onDelete: 'CASCADE' })
  tasks: Task[];

  @OneToMany(() => CompanyFeedback, (f) => f.company, { onDelete: 'CASCADE' })
  feedback: CompanyFeedback[];

  @OneToMany(() => Payment, p => p.company)
  payments: Payment[];
}
