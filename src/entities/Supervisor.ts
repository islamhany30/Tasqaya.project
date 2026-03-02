import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { TaskSupervisor } from './TaskSupervisor';
import { Admin } from './Admin';
import { Exclude } from 'class-transformer';

@Entity('supervisors')
export class Supervisor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  fullName: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 150, unique: true })
  email: string;

  @Column({ length: 255, nullable: true })
  address: string;

  @Exclude()
  @Column({ length: 255 })
  password: string;

  @Column({ type: 'varchar', nullable: true, default: '' })
  profileImage: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  joinDate: Date;

  @Column({ type: 'date', nullable: true })
  exitDate: Date | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  salary: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Exclude()
  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  verificationCode?: string | null;

  @Exclude()
  @Column({ nullable: true, type: 'timestamp' })
  verificationCodeExpiry?: Date | null;

  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  resetCode: string | null;

  @Exclude()
  @Column({ nullable: true, type: 'timestamp' })
  resetCodeExpiry: Date | null;

  @ManyToOne(() => Admin, (admin) => admin.workers, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'adminId' })
  adminId: Admin;

  @OneToMany(() => TaskSupervisor, (ts) => ts.supervisorId, { onDelete: 'CASCADE' })
  taskAssignments: TaskSupervisor[];
}
