import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Task } from './Task';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, t => t.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  taskId: Task;

  @Column('decimal', { precision: 10, scale: 2 })
  workersCost: number;

  @Column('decimal', { precision: 8, scale: 2 })
  supervisorsBonus: number;

  @Column('decimal', { precision: 8, scale: 2 })
  platformFee: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ length: 100 })
  transactionId: string;

  @Column({ length: 50 })
  paymentMethod: string;

  @Column({ length: 20 })
  status: string;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date;
}