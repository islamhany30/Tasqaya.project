import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Task } from './Task';
import { Supervisor } from './Supervisor';

@Entity('task_supervisors')
export class TaskSupervisor {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, t => t.supervisors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  taskId: Task;

  @ManyToOne(() => Supervisor, s => s.taskAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supervisorId' })
  supervisorId: Supervisor;
}