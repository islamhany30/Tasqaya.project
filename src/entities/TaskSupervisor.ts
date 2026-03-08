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

  @Column({ type: 'varchar', length: 255, nullable: true })
  whatsAppGroupLink: string;

  @Column({ type: 'datetime', nullable: true })
  whatsAppLinkAddedAt: Date;


  @ManyToOne(() => Task, t => t.supervisors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @ManyToOne(() => Supervisor, s => s.taskAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supervisorId' })
  supervisor: Supervisor;

  @Column({ type: 'longblob', nullable: true })
  attendanceFile: Buffer;

  @Column({ type: 'datetime', nullable: true })
  attendanceUploadedAt: Date;

  
}