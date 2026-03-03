import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Task } from './Task';
import { CompanyFeedback } from './CompanyFeedback';
import { Admin } from './Admin';
import { Exclude } from 'class-transformer';
import { Payment } from './Payment';

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

  @ManyToOne(() => Admin, (admin) => admin.companies, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'adminId' })
  admin: Admin;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Task, (t) => t.company, { onDelete: 'CASCADE' })
  tasks: Task[];

  @OneToMany(() => CompanyFeedback, (f) => f.company, { onDelete: 'CASCADE' })
  feedback: CompanyFeedback[];

  @OneToMany(() => Payment, p => p.company)
  payments: Payment[];
}
