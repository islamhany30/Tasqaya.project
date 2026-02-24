import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { Company } from './Company';
import { Worker } from './Worker';
import { Supervisor } from './Supervisor';
import { JobPost } from './JobPost';

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
  passwordHash: string;

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

  @OneToMany(() => Company, (company) => company.adminId)
  companies: Company[];

  @OneToMany(() => Worker, (worker) => worker.adminId)
  workers: Worker[];

  @OneToMany(() => Supervisor, (supervisor) => supervisor.adminId)
  supervisors: Supervisor[];

  @OneToMany(() => JobPost, (joppost) => joppost.adminId)
  jopposts: JobPost[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
