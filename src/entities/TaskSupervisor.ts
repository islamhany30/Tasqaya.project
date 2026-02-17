import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from 'typeorm';
import { Task } from './Task';
import { Supervisor } from './Supervisor';

@Entity('task_supervisors')
export class TaskSupervisor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
  type: 'decimal',
  precision: 10,
  scale: 2,
  transformer: {
    to: (value: number) => value,
    from: (value: string) => parseFloat(value),
  },
  })
  supervisorBonus: number;


  @ManyToOne(() => Task, t => t.supervisors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  taskId: Task;

  @ManyToOne(() => Supervisor, s => s.taskAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supervisorId' })
  supervisorId: Supervisor;

  
}