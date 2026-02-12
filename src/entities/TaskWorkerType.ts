import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Task } from './Task';
import { WorkerType } from './WorkerType';

@Entity('task_worker_types')
export class TaskWorkerType {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, t => t.workerTypes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  taskId: Task;

  @ManyToOne(() => WorkerType, wt => wt.taskWorkerTypes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workettypeId' })
  workerTypeId: WorkerType;
}