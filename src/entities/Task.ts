import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Company } from './Company';
import { WorkerLevel } from './WorkerLevel';
import { JobPost } from './JobPost';
import { TaskWorker } from './TaskWorker';
import { Attendance } from './Attendance';
import { TaskSupervisor } from './TaskSupervisor';
import { Payment } from './Payment';
import { CompanyFeedback } from './CompanyFeedback';
import { TaskWorkerType } from './TaskWorkerType';
import { TaskApprovalStatusEnum } from '../Enums/task-approval.enum';
import { TaskStatusEnum } from 'src/Enums/task-status.enum';
import { WorkerPayout } from './WorkerPayout';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Company, c => c.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ length: 150 })
  eventName: string;

  @Column({ length: 255 })
  location: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column()
  durationHoursPerDay: number;

  @Column()
  requiredWorkers: number;

  @ManyToOne(() => WorkerLevel, wl => wl.tasks, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workerLevelId' })
  workerLevel: WorkerLevel;


  @Column('decimal', { precision: 10, scale: 2 })
  baseWorkersCost: number;

  @Column('decimal', { precision: 8, scale: 2 })
  platformFee: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalCost: number;

  @Column({ 
    type:"enum",
    enum:TaskApprovalStatusEnum
   })
  approvalStatus: TaskApprovalStatusEnum; 

  @Column({ default: false })
  hasUniform: boolean;

  @Column({ type: 'varchar', length: 500})
  uniformDescription: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
  type: 'enum',
  enum: TaskStatusEnum,
  default: TaskStatusEnum.PENDING,
  })
  status: TaskStatusEnum;


  @OneToMany(() => TaskWorkerType, twt => twt.taskId, { cascade: true })
  workerTypes: TaskWorkerType[];

  @OneToMany(() => JobPost, jp => jp.taskId, { cascade: true })
  jobPost: JobPost[];

  @OneToMany(() => TaskWorker, tw => tw.taskId, { cascade: true })
  taskWorkers: TaskWorker[];

  @OneToMany(() => Attendance, a => a.task, { cascade: true })
  attendance: Attendance[];

  @OneToMany(() => TaskSupervisor, ts => ts.taskId, { cascade: true })
  supervisors: TaskSupervisor[];

  @OneToMany(() => Payment, p => p.taskId, { cascade: true })
  payments: Payment[];

  @OneToMany(() => CompanyFeedback, f => f.taskId, { cascade: true })
  feedback: CompanyFeedback[];

  @OneToMany(() => WorkerPayout, wp => wp.taskId)
  workerPayouts: WorkerPayout[];

}