import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { WorkerLevel } from './WorkerLevel';
import { Application } from './Application';
import { TaskWorker } from './TaskWorker';
import { Attendance } from './Attendance';
import { Evaluation } from './Evaluation';
import { WorkerScoreHistory } from './WorketScoreHistory';
import { Admin } from './Admin';



@Entity('workers')
export class Worker {
@PrimaryGeneratedColumn()
id: number;


@Column({ length: 150 })
fullName: string;


@Column({ length: 20 })
phone: string;


@Column({ length: 20, unique: true })
nationalId: string;


@Column({ length: 150, unique: true })
email: string;


@Column({ length: 255 })
password: string;


@Column('decimal', { precision: 4, scale: 2, default: 0 })
reliabilityRate: number;


@Column({ default: 0 })
score: number;


@Column({ length: 255, nullable: true })
profileImage: string;

@Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
createdAt: Date;

@Column({ default: false })
isVerified: boolean;

@Column({ default: true })
isActive: boolean;

@Column({type: 'varchar', nullable: true })
verificationCode?: string | null;

@Column({ nullable: true, type: 'timestamp' })
verificationCodeExpiry?: Date | null;

@Column({type: 'varchar', nullable: true })
resetCode: string | null;

@Column({ nullable: true, type: 'timestamp' })
resetCodeExpiry: Date |null; 



@ManyToOne(() => WorkerLevel, wl => wl.workers, { onDelete: 'RESTRICT' })
@JoinColumn({ name: 'levelId' })
level: WorkerLevel;


@OneToMany(() => Application, a => a.workerId, { onDelete: 'CASCADE' })
applications: Application[];


@OneToMany(() => TaskWorker, tw => tw.workerId, { onDelete: 'CASCADE' })
taskWorkers: TaskWorker[];


@OneToMany(() => Attendance, a => a.workerId, { onDelete: 'CASCADE' })
attendance: Attendance[];


@OneToMany(() => Evaluation, e => e.workerId, { onDelete: 'CASCADE' })
evaluations: Evaluation[];


@OneToMany(() => WorkerScoreHistory, h => h.workerId, { onDelete: 'CASCADE' })
scoreHistory: WorkerScoreHistory[];

@ManyToOne(() => Admin, admin => admin.workers, { nullable: true, onDelete: 'SET NULL' })
@JoinColumn({ name: 'adminId' })
adminId: Admin;



}