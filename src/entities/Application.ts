import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { JobPost } from './JobPost';
import { Worker } from './Worker';
import { ApplicationStatusEnum } from '../Enums/application-status.enum';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => JobPost, jp => jp.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobPostId' })
  jobPost: JobPost;

  @ManyToOne(() => Worker, w => w.applications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  worker: Worker;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  appliedAt: Date;

  @Column({ 
    type: 'enum',
    enum: ApplicationStatusEnum,
  })
  status: ApplicationStatusEnum; 
}