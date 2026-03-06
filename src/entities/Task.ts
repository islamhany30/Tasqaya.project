import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, OneToOne } from 'typeorm';
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
import { TaskStatusEnum } from '../Enums/task-status.enum';
import { WorkerPayout } from './WorkerPayout';
import { ConfirmationToken } from './confirmationToken';
import { GenderEnum } from '../Enums/gender.enum';
import { requiredWorkersStatusEnum } from '../Enums/required-workers.enum';

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

  @Column()
  requiredSupervisors: number;

  @ManyToOne(() => WorkerLevel, wl => wl.tasks, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workerLevelId' })
  workerLevel: WorkerLevel;

  @Column({
  type: 'enum',
  enum: requiredWorkersStatusEnum,
  default: requiredWorkersStatusEnum.PENDING
})
  requiredWorkerStatus: requiredWorkersStatusEnum;


  @Column('decimal', { precision: 10, scale: 2 })
  baseWorkersCost: number;

  @Column('decimal', { precision: 10, scale: 2 })
  supervisingFees: number;


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

  @OneToOne(() => JobPost, jp => jp.task, { cascade: true })
  jobPost: JobPost;

  @Column({
    type: 'simple-array',
    nullable: true,
  })
  genders: GenderEnum[];

  @OneToMany(() => TaskWorker, tw => tw.task, { cascade: true })
  taskWorkers: TaskWorker[];

  @OneToMany(() => Attendance, a => a.task, { cascade: true })
  attendance: Attendance[];

  @OneToMany(() => TaskSupervisor, ts => ts.task, { cascade: true })
  supervisors: TaskSupervisor[];

  @OneToOne(() => Payment, (payment) => payment.task)
  payment: Payment; 

  @OneToOne(() => CompanyFeedback, f => f.task, { cascade: true })
  feedback: CompanyFeedback[];

  @OneToMany(() => WorkerPayout, wp => wp.task)
  workerPayouts: WorkerPayout[];

  @OneToMany(() => ConfirmationToken, (token) => token.Task)
  ConfirmationTokens: ConfirmationToken[];

}