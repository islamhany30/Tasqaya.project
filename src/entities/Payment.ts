import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, OneToOne, OneToMany } from 'typeorm';
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

  // ── Cost breakdown ──────────────────────────────────────────
  @Column('decimal', { precision: 10, scale: 2 })
  workersCost: number;

  @Column('decimal', { precision: 8, scale: 2 })
  supervisingFees: number;

  @Column('decimal', { precision: 8, scale: 2 })
  platformFee: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  // ── 50/50 Split ─────────────────────────────────────────────
  @Column('decimal', { precision: 10, scale: 2 })
  depositAmount: number;          // 50% — paid before task starts (unlocks job post)

  @Column('decimal', { precision: 10, scale: 2 })
  remainingAmount: number;        // 50% — paid after task completes

  // ── Deposit (first payment) ──────────────────────────────────
  @Column({
    type: 'enum',
    enum: PaymentStatusEnum,
    default: PaymentStatusEnum.PENDING,
  })
  depositStatus: PaymentStatusEnum;

  @Column({ length: 100 })
  transactionId: string;          // internal order ID for deposit

  @Column({ nullable: true })
  depositBankTransactionId: string;

  @Column({ length: 50, default: 'PENDING' })
  depositMethod: string;

  @Column({ type: 'datetime', nullable: true })
  depositPaidAt: Date;

  // ── Remaining (second payment) ───────────────────────────────
  @Column({
    type: 'enum',
    enum: PaymentStatusEnum,
    default: PaymentStatusEnum.PENDING,
  })
  remainingStatus: PaymentStatusEnum;

  @Column({ nullable: true })
  remainingTransactionId: string;  // internal order ID for remaining

  @Column({ nullable: true })
  remainingBankTransactionId: string;

  @Column({ length: 50, nullable: true })
  remainingMethod: string;

  @Column({ type: 'datetime', nullable: true })
  remainingPaidAt: Date;

  // ── Overall status (for quick queries) ──────────────────────
  @Column({
    type: 'enum',
    enum: PaymentStatusEnum,
    default: PaymentStatusEnum.PENDING,
  })
  status: PaymentStatusEnum;       // PENDING → Pending | PAID → both paid

  // ── Legacy (keep for backwards compat if needed) ─────────────
  @Column({ nullable: true })
  bankTransactionId: string;

  @Column({ length: 50, default: 'PENDING' })
  paymentMethod: string;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}