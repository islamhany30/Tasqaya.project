import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Task } from './Task';
import { Worker } from './Worker';

@Entity('task_prechecks')
export class TaskPreCheck {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, t => t.preChecks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  taskId: Task;

  @ManyToOne(() => Worker, w => w.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  workerId: Worker;

  @Column({ default: false })
  confirmed: boolean;

  @Column({ type: 'datetime', nullable: true })
  responseTime: Date;

  @Column({ default: false })
  supervisorAlert: boolean;
}