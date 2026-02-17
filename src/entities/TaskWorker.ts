import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Task } from './Task';
import { Worker } from './Worker';
import { AssignmentTypeEnum } from '../Enums/assignment-type.enum';

@Entity('task_workers')
export class TaskWorker {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, t => t.taskWorkers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  taskId: Task;

  @ManyToOne(() => Worker, w => w.taskWorkers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  workerId: Worker;

  @Column({ 
    type:"enum",
    enum:AssignmentTypeEnum
   })
  assignmentType: AssignmentTypeEnum; 

  @Column({ nullable: true })
  backupOrder: number;

}