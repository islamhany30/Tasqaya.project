import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, OneToOne } from 'typeorm';
import { Exclude } from 'class-transformer';
import { WorkerLevel } from './WorkerLevel';
import { Application } from './Application';
import { TaskWorker } from './TaskWorker';
import { Attendance } from './Attendance';
import { WorkerScoreHistory } from './WorkerScoreHistory';
import { Admin } from './Admin';
import { WorkerPayout } from './WorkerPayout';
import { ConfirmationToken } from './confirmationToken';
import { GenderEnum } from '../Enums/gender-enum';
import { Account } from './Accounts';

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

  // الربط الأساسي هنا
  @OneToOne(() => Account, (account) => account.worker, { 
    onDelete: 'CASCADE', // لو مسحت الـ Account، يتمسح الـ Worker أوتوماتيك
    nullable: false      // مينفعش worker بدون account
  })
  @JoinColumn({ name: 'accountId' }) // ده العمود اللي هيتخزن فيه الـ ID بتاع الـ Account
  account: Account;

  @OneToMany(() => Application, (a) => a.worker, { onDelete: 'CASCADE' })
  applications: Application[];

  @OneToMany(() => TaskWorker, (tw) => tw.worker, { onDelete: 'CASCADE' })
  taskWorkers: TaskWorker[];

  @OneToMany(() => Attendance, (a) => a.worker, { onDelete: 'CASCADE' })
  attendance: Attendance[];

  @OneToMany(() => WorkerScoreHistory, (h) => h.worker, {
    onDelete: 'CASCADE',
  })
  scoreHistory: WorkerScoreHistory[];


  @Column({
    type: 'enum',
    enum: GenderEnum,
    default: GenderEnum.MALE,
  })
  gender: GenderEnum;

  @OneToMany(() => WorkerPayout, (wp) => wp.worker)
  payouts: WorkerPayout[];

  @OneToMany(() => ConfirmationToken, (token) => token.Worker)
  ConfirmationTokens: ConfirmationToken[];
}
