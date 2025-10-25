import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from 'typeorm';
import { IsEmail, IsOptional, Matches } from 'class-validator';
import { Address } from './Address.entity';
import { Exclude } from 'class-transformer';
import { UserRole } from 'src/Types/Enum.userrole';

@Entity('Users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  age:number;

  @Column({ unique: true })
  @IsEmail()
  email: string;

  @Column()
  @Exclude()
  password: string;


  @Column({ nullable: true })
  @Matches(/^(\+20|0)?1[0-2,5]\d{8}$/, {
    message: 'Phone number must be a valid Egyptian number',
  })
  phone: string;

  @Column({ type: 'enum', enum: ['male', 'female']})
  gender: string;

  @Column({ nullable: true })
  @Exclude()
  profileImage?: string;

  @OneToOne(() => Address, (address) => address.user, { cascade: true })
  address?: Address;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  userRole: UserRole;

  @Column()
  active:boolean;

  @Column({ type:"nvarchar", nullable: true })
  @Exclude()
  verificationCode?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  verificationCodeExpiry?: Date | null;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ nullable: true ,type:'nvarchar' })
  @Exclude()
  resetCode?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  resetCodeExpiry?: Date | null;
}
