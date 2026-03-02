import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { WorkerLevel } from './WorkerLevel';
import { Application } from './Application';
import { TaskWorker } from './TaskWorker';
import { Attendance } from './Attendance';
import { WorkerScoreHistory } from './WorkerScoreHistory';
import { Admin } from './Admin';
import { WorkerPayout } from './WorkerPayout';
import { ConfirmationToken } from './confirmationToken';
import { GenderEnum } from 'src/Enums/gender-enum';

@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  fullName: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 14, unique: true })
  nationalId: string;

  @Column({ length: 150, unique: true })
  email: string;

  @Column({ type: 'enum', enum: GenderEnum })
  gender: GenderEnum;

  @Exclude()
  @Column({ length: 255 })
  password: string;

  @Column('decimal', { precision: 4, scale: 2, default: 0 })
  reliabilityRate: number;

  @Column({ default: 0 })
  score: number;

  // @UpdateDateColumn()
  // updatedAt: Date;

  @Column({ length: 255, nullable: true })
  profileImage: string;

  @Column({ default: 0 })
  completedTasks: number;

  @Column({ default: false })
  hasLanguage: boolean;

  @Column({ length: 50, nullable: true })
  language: string;

  @Column({ length: 255, nullable: true })
  languageVideoUrl: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

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

  @ManyToOne(() => WorkerLevel, (wl) => wl.workers, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'levelId' })
  level: WorkerLevel;

  @OneToMany(() => Application, (a) => a.workerId, { onDelete: 'CASCADE' })
  applications: Application[];

  @OneToMany(() => TaskWorker, (tw) => tw.workerId, { onDelete: 'CASCADE' })
  taskWorkers: TaskWorker[];

  @OneToMany(() => Attendance, (a) => a.workerId, { onDelete: 'CASCADE' })
  attendance: Attendance[];

  @OneToMany(() => WorkerScoreHistory, (h) => h.workerId, {
    onDelete: 'CASCADE',
  })
  scoreHistory: WorkerScoreHistory[];

  @ManyToOne(() => Admin, (admin) => admin.workers, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'adminId' })
  adminId: Admin;

  @OneToMany(() => WorkerPayout, (wp) => wp.workerId)
  payouts: WorkerPayout[];

  @OneToMany(() => ConfirmationToken, (token) => token.Worker)
  ConfirmationTokens: ConfirmationToken[];
}
