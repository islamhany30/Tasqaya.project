import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Task } from './Task';
import { Admin } from './Admin';

@Entity('job_posts')
export class JobPost {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, t => t.jobPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  taskId: Task;
  
  @ManyToOne(() => Admin, a => a.jopposts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'adminId' })
  adminId: Admin;

  @Column({ type: 'datetime' })
  publishedAt: Date;

  @Column({ type: 'datetime' })
  deadline: Date;

  @Column({ default: false })
  isUrgent: boolean;

  @Column()
  maxAllowedWorkers: number;

  @Column({ length: 20 })
  status: string;
}