import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Task } from './Task';
import { Company } from './Company';

@Entity('company_feedback')
export class CompanyFeedback {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, t => t.feedback, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  taskId: Task;

  @ManyToOne(() => Company, c => c.feedback, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  companyId: Company;

  @Column()
  rating: number;

  @Column({ length: 500, nullable: true })
  comment: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}