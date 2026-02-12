import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { TaskSupervisor } from './TaskSupervisor';
import { Evaluation } from './Evaluation';
import { Admin } from './Admin';

@Entity('supervisors')
export class Supervisor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  fullName: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 150, unique: true })
  email: string;

  @Column({ length: 255 })
  password: string;

  @Column({ length: 255, nullable: true })
  profileImage: string;

  @Column({ type: 'date' })
  joinDate: Date;

  @Column({ type: 'date', nullable: true })
  exitDate: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'varchar', nullable: true })
  verificationCode?: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  verificationCodeExpiry?: Date | null;

  @Column({type: 'varchar', nullable: true })
  resetCode: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  resetCodeExpiry: Date |null; 
  
  @ManyToOne(() => Admin, admin => admin.workers, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'adminId' })
  adminId: Admin;

  @OneToMany(() => TaskSupervisor, ts => ts.supervisorId, { onDelete: 'CASCADE' })
  taskAssignments: TaskSupervisor[];

  @OneToMany(() => Evaluation, e => e.supervisorId, { onDelete: 'SET NULL' })
  evaluations: Evaluation[];
}