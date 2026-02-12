import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Task } from './Task';
import { Worker } from './Worker';
import { Supervisor } from './Supervisor';

@Entity('evaluations')
export class Evaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, t => t.evaluations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  taskId: Task;

  @ManyToOne(() => Worker, w => w.evaluations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  workerId: Worker;

  @ManyToOne(() => Supervisor, s => s.evaluations, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supervisorId' })
  supervisorId: Supervisor;

  @Column()
  rating: number;

  @Column({ length: 500, nullable: true })
  comment: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}