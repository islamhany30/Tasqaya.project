import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Worker } from './Worker';

@Entity('worker_score_history')
export class WorkerScoreHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Worker, w => w.scoreHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  workerId: Worker;

  @Column()
  oldScore: number;

  @Column()
  newScore: number;

  @Column({ length: 255 })
  reason: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  changedAt: Date;
}