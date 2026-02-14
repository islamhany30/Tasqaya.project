import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './Admin.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Admin } from '../../entities/Admin';
import { MailService } from '../../Mail/MailService';
import { JwtService } from '@nestjs/jwt';
import { CompanyService } from '../Company/Company.service';
import { 
  BadRequestException, 
  NotFoundException, 
  UnauthorizedException, 
  ForbiddenException 
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

// نمنع bcrypt و fs من العمل الحقيقي لضمان سرعة واستقرار التيست
jest.mock('bcryptjs');
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    unlinkSync: jest.fn(),
  };
});

describe('AdminService (Comprehensive Coverage)', () => {
  let service: AdminService;
  let repo: any;

  // Mock Objects
  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockMailService = { sendMail: jest.fn().mockResolvedValue(true) };
  const mockJwtService = { sign: jest.fn().mockReturnValue('mock-jwt-token') };
  const mockCompanyService = { changeAccountStatus: jest.fn(), getCompanyById: jest.fn(), getAllCompanies: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Admin), useValue: mockRepo },
        { provide: MailService, useValue: mockMailService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: CompanyService, useValue: mockCompanyService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    repo = module.get(getRepositoryToken(Admin));
  });

  // 1. REGISTER
  describe('register', () => {
    it('should throw BadRequest if admin exists', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1 });
      await expect(service.register({ email: 'test@test.com' } as any)).rejects.toThrow(BadRequestException);
    });

    it('should register successfully', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pass');
      mockRepo.create.mockReturnValue({ email: 'a@a.com', id: 1 });
      mockRepo.save.mockResolvedValue({ email: 'a@a.com', id: 1 });

      const res = await service.register({ email: 'a@a.com', passwordHash: '123', confirmPassword: '123' } as any);
      expect(res.token).toBeDefined();
      expect(mockMailService.sendMail).toHaveBeenCalled();
    });
  });

  // 2. VERIFY ADMIN
  describe('verifyAdmin', () => {
    it('should throw NotFound if admin not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyAdmin({} as any, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequest if already verified', async () => {
      mockRepo.findOne.mockResolvedValue({ isVerified: true });
      await expect(service.verifyAdmin({} as any, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw if no verification code in DB', async () => {
      mockRepo.findOne.mockResolvedValue({ isVerified: false, verificationCode: null });
      await expect(service.verifyAdmin({} as any, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw if code is invalid', async () => {
      mockRepo.findOne.mockResolvedValue({ isVerified: false, verificationCode: '123', verificationCodeExpiry: new Date(Date.now() + 10000) });
      await expect(service.verifyAdmin({ VERFICATIONCODE: '999' } as any, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw if code expired', async () => {
      mockRepo.findOne.mockResolvedValue({ isVerified: false, verificationCode: '123', verificationCodeExpiry: new Date(Date.now() - 10000) });
      await expect(service.verifyAdmin({ VERFICATIONCODE: '123' } as any, 1)).rejects.toThrow(BadRequestException);
    });

    it('should verify successfully', async () => {
      const admin = { isVerified: false, verificationCode: '123', verificationCodeExpiry: new Date(Date.now() + 10000) };
      mockRepo.findOne.mockResolvedValue(admin);
      const res = await service.verifyAdmin({ VERFICATIONCODE: '123' } as any, 1);
      expect(admin.isVerified).toBe(true);
      expect(res.message).toContain('successfully');
    });
  });

  // 3. LOGIN
  describe('login', () => {
    it('should throw Unauthorized if email not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.login({ email: 'x', passwordHash: 'y' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequest if not verified', async () => {
      mockRepo.findOne.mockResolvedValue({ isVerified: false });
      await expect(service.login({ email: 'x', passwordHash: 'y' })).rejects.toThrow(BadRequestException);
    });

    it('should throw Unauthorized if password wrong', async () => {
      mockRepo.findOne.mockResolvedValue({ isVerified: true, passwordHash: 'h' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: 'x', passwordHash: 'y' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw Forbidden if inactive', async () => {
      mockRepo.findOne.mockResolvedValue({ isVerified: true, passwordHash: 'h', isActive: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(service.login({ email: 'x', passwordHash: 'y' })).rejects.toThrow(ForbiddenException);
    });

    it('should login successfully', async () => {
      mockRepo.findOne.mockResolvedValue({ isVerified: true, isActive: true, passwordHash: 'h', id: 1 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const res = await service.login({ email: 'x', passwordHash: 'y' });
      expect(res.access_token).toBe('mock-jwt-token');
    });
  });

  // 4. PROFILE & IMAGE
  describe('Profile Management', () => {
    it('editProfile: should update and return admin', async () => {
      const admin = { id: 1, firstName: 'Old' };
      mockRepo.findOne.mockResolvedValue(admin);
      const res = await service.editProfile(1, { name: 'New' } as any);
      expect(res.admin.name).toBe('New');
    });

    it('editProfile: should throw if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.editProfile(1, {} as any)).rejects.toThrow(NotFoundException);
    });

    it('updateProfileImage: should delete old image if exists', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, profileImage: 'old.png' });
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      await service.updateProfileImage(1, 'new.png');
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  // 5. PASSWORD MANAGEMENT
  describe('Password Flow', () => {
    it('changePassword: should throw if old password wrong', async () => {
      mockRepo.findOne.mockResolvedValue({ passwordHash: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.changePassword(1, { oldPassword: 'w', newPassword: 'n' } as any)).rejects.toThrow(BadRequestException);
    });

    it('forgotPassword: should send reset code', async () => {
      mockRepo.findOne.mockResolvedValue({ email: 'a@a.com' });
      const res = await service.forgotPassword({ email: 'a@a.com' });
      expect(mockMailService.sendMail).toHaveBeenCalled();
    });

    it('verifyResetCode: should throw if code invalid', async () => {
      mockRepo.findOne.mockResolvedValue({ resetCode: '111' });
      await expect(service.verifyResetCode({ email: 'a', code: '222' })).rejects.toThrow(BadRequestException);
    });

    it('resetPassword: should throw if no reset request found', async () => {
      mockRepo.findOne.mockResolvedValue({ resetCode: null });
      await expect(service.resetPassword({ email: 'a', newPassword: '1' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  // 6. UTILITIES (Delete, Get, Resend)
  describe('Utilities', () => {
    it('deleteAccount: should call remove', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1 });
      await service.deleteAccount(1);
      expect(mockRepo.remove).toHaveBeenCalled();
    });

    it('getAdminById: should throw if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.getAdminById(1)).rejects.toThrow(NotFoundException);
    });

    it('resendVerification: should send new mail', async () => {
      mockRepo.findOne.mockResolvedValue({ isVerified: false, email: 'a@a.com' });
      await service.resendVerification(1);
      expect(mockMailService.sendMail).toHaveBeenCalled();
    });

    it('changeCompanyStatus: should call companyService', async () => {
      await service.changeCompanyStatus(1, { isActive: true });
      expect(mockCompanyService.changeAccountStatus).toHaveBeenCalled();
    });

    it('getCompanyDataForAdmin: should call companyService', async () => {
      await service.getCompanyDataForAdmin(1);
      expect(mockCompanyService.getCompanyById).toHaveBeenCalled();
    });
  });

  // 7. GET ALL COMPANIES FOR ADMIN
  describe('getAllCompaniesForAdmin', () => {
    it('should call companyService.getAllCompanies and return result', async () => {
      const mockCompanies = [
        { id: 1, name: 'Company A', isActive: true },
        { id: 2, name: 'Company B', isActive: false },
      ];

      mockCompanyService.getAllCompanies.mockResolvedValue(mockCompanies);

      const result = await service.getAllCompaniesForAdmin();
      expect(result).toEqual(mockCompanies);
      expect(mockCompanyService.getAllCompanies).toHaveBeenCalled();
    });
  });
});
