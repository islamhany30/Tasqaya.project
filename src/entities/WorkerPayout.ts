import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Worker } from './Worker';
import { Task } from './Task';
import { PayoutStatusEnum } from '../Enums/payout-status.enum';

@Entity('worker_payouts')
export class WorkerPayout {
  @PrimaryGeneratedColumn()
  workerPayoutID: number;

  @ManyToOne(() => Worker, w => w.payouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  workerId: Worker;

  @ManyToOne(() => Task, t => t.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  taskId: Task;

  @Column({ type: 'datetime' })
  payoutDate: Date;

  @Column({
    type: 'enum',
    enum: PayoutStatusEnum,
    default: PayoutStatusEnum.PENDING,
  })
  status: PayoutStatusEnum;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column({ type: 'nvarchar', length: 100, nullable: true })
  transactionReference: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
