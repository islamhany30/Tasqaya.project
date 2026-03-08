import { UserRole } from '../Enums/User.role';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne } from 'typeorm';
import { Supervisor } from './Supervisor';
import { Company } from './Company';
import { Admin } from './Admin';
import { Worker } from './Worker';

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; 

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @OneToOne(() => Admin, (admin) => admin.account)
  admin: Admin;

  @OneToOne(() => Worker, (worker) => worker.account)
  worker: Worker;

  @OneToOne(() => Supervisor, (supervisor) => supervisor.account)
  supervisor: Supervisor;

  @OneToOne(() => Company, (company) => company.account)
  company: Company;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}