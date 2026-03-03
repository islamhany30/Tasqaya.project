import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Worker } from './Worker';
import { Task } from './Task';

@Entity('ConfirmationTokens')
export class ConfirmationToken {
  @PrimaryGeneratedColumn({ name: 'TokenID' })
  TokenID: number;

  @Column({ name: 'Token', type: 'nvarchar', length: 100, unique: true })
  Token: string;

  @Column({ name: 'ExpiresAt', type: 'datetime' })
  ExpiresAt: Date;

  @Column({ name: 'IsUsed', type: 'bit', default: false })
  IsUsed: boolean;

  @CreateDateColumn({ name: 'CreatedAt' })
  CreatedAt: Date;

  // ── Relations ──────────────────────────────────────────────────
  @ManyToOne(() => Worker, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'WorkerID' })
  Worker: Worker;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'TaskID' })
  Task: Task;
}