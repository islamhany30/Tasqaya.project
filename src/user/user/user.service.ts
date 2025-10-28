// user.service.ts
import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/Mail/MailService';    
import { MailDTO } from 'src/Mail/dto/Mail.dto';
import { Payload } from 'src/Types/Payload';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { generateToken } from 'src/common/utils.jwt';
import { ChangePasswordDto } from './dto/Changepassword.dto';
import * as path from 'path';
import * as fs from 'fs';
import { ChangeStatusDto } from './dto/Activation.dto';
import { ResetPasswordDto } from './dto/Resetpassword.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from 'src/Types/Enum.userrole';
import { ChangeRoleDto } from './dto/New.role.dto';
import { forgotPasswordDto } from './dto/Forgot.password.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: CreateUserDto): Promise<any> {
    const exist = await this.userRepository.findOne({ where: { email: dto.email } });
    if (exist) throw new BadRequestException('Email already registered');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = this.userRepository.create(dto);

    user.password = hashedPassword;             
    user.verificationCode = verificationCode;
    user.verificationCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);
    user.isVerified = false;                    
    user.active = true;     


    await this.userRepository.save(user);

    await this.mailService.sendMail({
      to: user.email,
      subject: 'Verify your account',
      text: `Your verification code is: ${verificationCode}`
    });

    return { message: `User registered successfully. Verification code sent to email`,user };
  }

  async verifyUser(dto: MailDTO): Promise<any> {
    const user = await this.userRepository.findOne({ where: { email: dto.email } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('User already verified');
    }

    if (!user.verificationCode || !user.verificationCodeExpiry) {
      throw new BadRequestException('No verification code found. Please request a new one.');
    }

    if (user.verificationCodeExpiry < new Date()) {
      throw new BadRequestException('Verification code expired. Please request a new one.');
    }

    if (user.verificationCode !== dto.VERFICATIONCODE) {
      throw new BadRequestException('Invalid verification code');
    }

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpiry = null;

    await this.userRepository.save(user);

    return { message: 'User verified successfully' };
  }


  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isVerified) {
      throw new BadRequestException('Please,verify your account first!');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if(user.active === false)
    {
      throw new ForbiddenException("This account has been deactivated by the admin.");
    }

    const payload:Payload = {
      sub: user.id,
      firstName: user.firstName,
      email: user.email,
      role:user.userRole
    };

    const token = generateToken(this.jwtService, payload);

    return {
      message: 'Login successful',
      access_token: token
    };
  }

  async changeAccountStatus(id: number, isActive: ChangeStatusDto) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.active = isActive.active;
    await this.userRepository.save(user);

    return {
      message: `User account has been ${isActive.active ? 'activated' : 'deactivated'} successfully.`,
    };
  }

  async changePassword(userid:number, dto: ChangePasswordDto) {
    const { password, newPassword, confirmPassword } = dto;


    const user = await this.userRepository.findOne({ where: { id:userid } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await this.userRepository.save(user);

    return { message: 'Password changed successfully' };
  }

  async updateProfileImage(userId: number, newImagePath: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.profileImage) {
      const oldImagePath = path.resolve(user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    user.profileImage = newImagePath;
    await this.userRepository.save(user);

    return user;
  }

  async getUserById(id: number) {
  const user = await this.userRepository.findOne({
    where: { id: id },
    relations: ['address']
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }
  return user;
  }

  async logout() {    
    return {
      message: `User has been logged out successfully.`,
    };
  }

  async forgotPassword(body: forgotPasswordDto) {
  const user = await this.userRepository.findOne({ where: { email:body.email } });
  if (!user) throw new NotFoundException('No account found with this email.');

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  user.resetCode = resetCode;
  user.resetCodeExpiry = new Date(Date.now() + 5 * 60 * 1000); 
  await this.userRepository.save(user);

  await this.mailService.sendMail({
    to: user.email,
    subject: 'Reset Your Password',
    text: `Your password reset code is: ${resetCode}. It will expire in 5 minutes.`,
  });

  return {
    message: 'Reset code has been sent to your email.',
  };
  }

  async verifyResetCode(email: string, code: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user)
      throw new NotFoundException('No account found with this email');

    if(user.resetCode !== code)
    {
      throw new BadRequestException('Invalid reset code.');
    }
    return { message: 'Code verified successfully.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<any> {
    const { email, newPassword, confirmPassword } = dto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    if (!user.resetCode || !user.resetCodeExpiry) {
      throw new BadRequestException('No reset request found for this user');
    }


    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetCode = null;
    user.resetCodeExpiry = null;

    await this.userRepository.save(user);

    return { message: 'Password reset successfully' };
  }

  async deleteAccount(targetUserId: number) {
  const user = await this.userRepository.findOne({ where: { id: targetUserId } });
  if (!user) {
    throw new NotFoundException('User not found');
  }

  await this.userRepository.remove(user);

  return { message: 'Account deleted successfully' };
  }

  async editProfile(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, updateUserDto);

    await this.userRepository.save(user);
    return {
      message: 'Profile updated successfully',
    };
  }

  async changeUserRole(id: number, body: ChangeRoleDto) {
  const user = await this.userRepository.findOne({ where: { id } });
  if (!user) {
    throw new NotFoundException('User not found');
  }

  if (user.userRole === UserRole.ADMIN) {
    throw new BadRequestException('This user is already an admin');
  }

  user.userRole = body.newRole;
  await this.userRepository.save(user);

  return {
    message: `User role changed to ${body.newRole} successfully`,
    user
  };
  }

   async resendVerification(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new BadRequestException('No user found with this email');
    }

    if (user.isVerified) {
      throw new BadRequestException('This account is already verified');
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.verificationCode = newCode;
    user.verificationCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await this.userRepository.save(user);

    await this.mailService.sendMail({
      to: user.email,
      subject: 'Verify your account',
      text: `Your verification code is: ${newCode}`
    });


    return {
      message: 'A new verification code has been sent to your email',
    };
  }
}
