import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Task } from './Task';
import { Worker } from './Worker';
import { AttendanceStatusEnum } from '../Enums/attendance-status.enum';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, t => t.attendance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @ManyToOne(() => Worker, w => w.attendance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' }) 
  workerId: Worker;

  @Column({ type: 'datetime', nullable: true })
  checkInTime: Date;

  @Column({ type: 'datetime', nullable: true })
  checkOutTime: Date;

  @Column({ 
    type:"enum",
    enum:AttendanceStatusEnum
   })
  status: AttendanceStatusEnum; 

  @Column({ type: 'longblob', nullable: true })
  excelFile: Buffer;
}