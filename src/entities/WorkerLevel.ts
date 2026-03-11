import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Worker } from './Worker';
import { Task } from './Task';
import { WorkerLevelEnum } from '../Enums/worker-level.enum';

@Entity('worker_levels')
export class WorkerLevel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: WorkerLevelEnum,
  })
  levelName: WorkerLevelEnum;

  @Column('decimal', { precision: 6, scale: 2 })
  workerHourlyRate: number;

  @Column('decimal', { precision: 6, scale: 2 })
  companyHourlyRate: number;

  @Column({ nullable: true })
  minScore: number;

  @Column({ nullable: true })
  maxScore: number;

  @OneToMany(() => Worker, (w) => w.level, { onDelete: 'RESTRICT' })
  workers: Worker[];

  @OneToMany(() => Task, (t) => t.workerLevel, { onDelete: 'RESTRICT' })
  tasks: Task[];
}
