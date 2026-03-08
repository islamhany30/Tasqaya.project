import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, OneToOne } from 'typeorm';
import { Task } from './Task';
import { Company } from './Company';
import { PaymentStatusEnum } from '../Enums/payment-status.enum';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Task, t => t.payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @ManyToOne(() => Company, c => c.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column('decimal', { precision: 10, scale: 2 })
  workersCost: number;

  @Column('decimal', { precision: 8, scale: 2 })
  supervisingFees: number;

  @Column({ nullable: true })
  bankTransactionId: string;

  @Column('decimal', { precision: 8, scale: 2 })
  platformFee: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ length: 100 })
  transactionId: string;

  @Column({ length: 50 })
  paymentMethod: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({
  type: 'enum',
  enum: PaymentStatusEnum,
  default: PaymentStatusEnum.PENDING,
  })
  status: PaymentStatusEnum;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date;
}