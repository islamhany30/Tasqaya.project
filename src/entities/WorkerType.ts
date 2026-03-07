import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { TaskWorkerType } from './TaskWorkerType';
import { WorkerTypeEnum } from '../Enums/worker-type.enum';

@Entity('worker_types')
export class WorkerType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: WorkerTypeEnum,
  })
  typeName: WorkerTypeEnum;

  @OneToMany(() => TaskWorkerType, (twt) => twt.workerTypeId, { onDelete: 'CASCADE' })
  taskWorkerTypes: TaskWorkerType[];
}
