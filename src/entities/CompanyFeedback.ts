import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { Task } from './Task';
import { Company } from './Company';
import { RatingEnum } from '../Enums/Rating.enum';

@Entity('company_feedback')
export class CompanyFeedback {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Task, t => t.feedback, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @ManyToOne(() => Company, c => c.feedback, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column()
  rating: RatingEnum;

  @Column({ length: 500, nullable: true })
  comment: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}