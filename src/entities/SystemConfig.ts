import { Check, Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity()
@Check(`id = 1`) // شيلنا الدبل كوتيشن عشان MySQL
export class SystemConfig {
  @PrimaryColumn({ default: 1 }) 
  id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 400 })
  globalSupervisorBouns: number;

  @Column({ type: 'float', default: 0.15 })
  platformFeePercentage: number;
}