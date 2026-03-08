import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Supervisor } from './Supervisor';
import { Task } from './Task';
import { PayoutStatusEnum } from '../Enums/payout-status.enum';

@Entity('supervisor_payouts')
export class SupervisorPayout {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Supervisor, s => s.payouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supervisorId' })
  supervisor: Supervisor;

  @ManyToOne(() => Task, t => t.supervisorPayouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

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

  @Column({
    type: 'enum',
    enum: PayoutStatusEnum,
    default: PayoutStatusEnum.PENDING,
  })
  status: PayoutStatusEnum;

  @Column({ type: 'nvarchar', length: 100, nullable: true })
  transactionReference: string | null;

  @Column({ type: 'datetime', nullable: true })
  payoutDate: Date | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}