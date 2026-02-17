import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Task } from './Task';
import { CompanyFeedback } from './CompanyFeedback';
import { Admin } from './Admin';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  name: string;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ length: 255 })
  password: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 255 })
  address: string;

  @Column({ nullable: true,type:"varchar" })
  profileImage: string | null;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'varchar', nullable: true })
  verificationCode?: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  verificationCodeExpiry?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  resetCode: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  resetCodeExpiry: Date | null;

  @ManyToOne(() => Admin, (admin) => admin.companies, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'adminId' })
  adminId: Admin;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Task, (t) => t.company, { onDelete: 'CASCADE' })
  tasks: Task[];

  @OneToMany(() => CompanyFeedback, (f) => f.companyId, { onDelete: 'CASCADE' })
  feedback: CompanyFeedback[];
}
