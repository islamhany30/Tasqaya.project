import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../../Mail/MailService';
import { MailDTO } from '../../Mail/dto/Mail.dto';
import { JwtService } from '@nestjs/jwt';
import { Supervisor } from 'src/entities/Supervisor';
import { CreateSupervisorDto } from './Dto/create-supervisor.dto';
import { generateToken } from 'src/common/utils.jwt';
import { Payload } from 'src/Types/Payload';
import { UserRole } from 'src/Enums/User.role';
import { LoginSupervisorDto } from './Dto/login-supervisor.dto';
import { ForgotSupervisorPasswordDto } from './Dto/forgot-password.dto';
import { ResetSupervisorPasswordDto } from './Dto/reset-supervisor-password.dto';
import { identity } from 'rxjs';

@Injectable()
export class SupervisorService {
  constructor(
    @InjectRepository(Supervisor) private readonly supervisorRepository: Repository<Supervisor>,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: CreateSupervisorDto): Promise<any> {
    const exist = await this.supervisorRepository.findOne({ where: { email: dto.email } });

    if (exist) throw new BadRequestException('Email already registered');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const supervisor = this.supervisorRepository.create(dto);
    supervisor.password = hashedPassword;
    supervisor.profileImage = '';
    supervisor.isVerified = false;
    supervisor.isActive = true;
    supervisor.verificationCode = verificationCode;
    supervisor.verificationCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await this.supervisorRepository.save(supervisor);

    // await this.mailService.sendMail({
    //   to: supervisor.email,
    //   subject: 'Verify your company account',
    //   text: `Your verification code is: ${verificationCode}`,
    // });

    const payload = {
      ...new Payload({
        sub: supervisor.id,
        email: supervisor.email,
        role: UserRole.SUPERVISOR,
      }),
    };

    const token = generateToken(this.jwtService, payload);

    return { status: 'success', message: 'Registered successfully. Verification code sent to email.', token };
  }

  async verifySupervisor(dto: MailDTO, supervisorId: number): Promise<any> {
    const supervisor = await this.supervisorRepository.findOne({ where: { id: supervisorId } });

    if (!supervisor) throw new NotFoundException('Supervisor not found');

    if (supervisor.isVerified) throw new BadRequestException('Supervisor is already verified');

    if (!supervisor.verificationCode || !supervisor.verificationCodeExpiry)
      throw new BadRequestException('No verification code found');

    if (supervisor.verificationCodeExpiry < new Date()) throw new BadRequestException('Verification code expired');

    if (supervisor.verificationCode !== dto.VERIFICATIONCODE)
      throw new BadRequestException('Invalid verification code');

    supervisor.isVerified = true;
    supervisor.verificationCode = null;
    supervisor.verificationCodeExpiry = null;

    await this.supervisorRepository.save(supervisor);

    return { status: 'success', message: 'Company verified successfully' };
  }

  async resendVerification(sueprvisorId: number): Promise<any> {
    const supervisor = await this.supervisorRepository.findOne({ where: { id: sueprvisorId } });

    if (!supervisor) throw new NotFoundException('User not found');
    if (supervisor.isVerified) throw new BadRequestException('Already Verified');

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    supervisor.verificationCode = newCode;
    supervisor.verificationCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await this.supervisorRepository.save(supervisor);

    // await this.mailService.sendMail({
    //   to: supervisor.email,
    //   subject: 'Verification code',
    //   text: `Code: ${newCode}`,
    // });

    return { status: 'success', message: 'New verification code sent successfully' };
  }

  async login(dto: LoginSupervisorDto) {
    const { email, password } = dto;

    const supervisor = await this.supervisorRepository.findOne({ where: { email } });

    if (!supervisor) throw new UnauthorizedException('Invalid email or password.');
    if (!supervisor.isVerified) throw new BadRequestException('Please verify your account first!');
    if (!supervisor.isActive) throw new ForbiddenException('This account has been deactivated by the admin.');

    const passwordIsMatch = await bcrypt.compare(password, supervisor.password);

    if (!passwordIsMatch) throw new UnauthorizedException('Invalid email or password.');

    const payload = {
      ...new Payload({
        sub: supervisor.id,
        email,
        role: UserRole.SUPERVISOR,
      }),
    };

    const token = generateToken(this.jwtService, payload);

    return {
      status: 'success',
      message: 'Login successfully!',
      token,
    };
  }

  async forgotPassword(body: ForgotSupervisorPasswordDto) {
    const { email } = body;
    const supervisor = await this.supervisorRepository.findOne({ where: { email } });

    if (!supervisor) throw new NotFoundException('No user found with this email!');

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    supervisor.resetCode = resetCode;
    supervisor.resetCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await this.supervisorRepository.save(supervisor);

    // await this.mailService.sendMail({
    //   to: email,
    //   subject: 'Reste your password',
    //   text: `Code: ${resetCode}`,
    // });

    return {
      status: 'success',
      message: 'Reset code sent successfully',
    };
  }

  async resetPassword(dto: ResetSupervisorPasswordDto): Promise<any> {
    const supervisor = await this.supervisorRepository.findOne({ where: { resetCode: dto.resetCode } });

    if (!supervisor) throw new BadRequestException('Invalid reset code');

    if (!supervisor.resetCodeExpiry || supervisor.resetCodeExpiry < new Date())
      throw new BadRequestException('Reset code expired');

    supervisor.password = await bcrypt.hash(dto.newPassword, 10);
    supervisor.resetCode = null;
    supervisor.resetCodeExpiry = null;

    this.supervisorRepository.save(supervisor);

    return {
      status: 'success',
      message: 'Password reset successfully',
    };
  }
}
