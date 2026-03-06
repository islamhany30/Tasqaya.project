import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { Task } from './Task';
import { Admin } from './Admin';
import { JobPostStatusEnum } from '../Enums/job-post-status.enum';

@Entity('job_posts')
export class JobPost {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Task, t => t.jobPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;
  
  @ManyToOne(() => Admin, a => a.jopposts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'adminId' })
  admin: Admin;

  @Column({ type: 'datetime' })
  publishedAt: Date;

  @Column({ type: 'datetime' })
  deadline: Date;

  @Column()
  maxAllowedWorkers: number;

  @Column({ 
    type: 'enum', 
    enum: JobPostStatusEnum, 
    default: JobPostStatusEnum.OPEN 
  })
  status: JobPostStatusEnum;
}