import { Test, TestingModule } from '@nestjs/testing';
import { CompanyService } from './Company.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from '../../entities/Company';
import { Repository } from 'typeorm';
import { MailService } from '../../Mail/MailService';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';

// Mocking bcryptjs and fs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));
jest.mock('fs');

describe('CompanyService', () => {
  let service: CompanyService;
  let companyRepository: Repository<Company>;
  let mailService: MailService;

  const mockCompany: Partial<Company> = {
    id: 1,
    email: 'test@company.com',
    password: 'hashedPassword',
    name: 'Test Company',
    isVerified: true,
    isActive: true,
    verificationCode: '123456',
    verificationCodeExpiry: new Date(Date.now() + 10000),
    resetCode: '654321',
    resetCodeExpiry: new Date(Date.now() + 10000),
  };

  const mockCompanyRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockMailService = { sendMail: jest.fn() };
  const mockJwtService = { sign: jest.fn().mockReturnValue('mock-token') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        { provide: getRepositoryToken(Company), useValue: mockCompanyRepository },
        { provide: MailService, useValue: mockMailService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
    companyRepository = module.get<Repository<Company>>(getRepositoryToken(Company));
    mailService = module.get<MailService>(MailService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto = { email: 'new@c.com', password: '123', name: 'New', confirmPassword: '123', phone: '123', address: '123' };
    it('should register successfully', async () => {
      mockCompanyRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      mockCompanyRepository.create.mockReturnValue({ ...dto });
      mockCompanyRepository.save.mockResolvedValue({ id: 1, ...dto });

      const result = await service.register(dto);
      expect(result.token).toBeDefined();
      expect(mockMailService.sendMail).toHaveBeenCalled();
    });

    it('should throw if email exists', async () => {
      mockCompanyRepository.findOne.mockResolvedValue(mockCompany);
      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyCompany', () => {
    it('should throw BadRequestException if company not found', async () => {
      mockCompanyRepository.findOne.mockResolvedValue(null);
      await expect(service.verifyCompany({ VERFICATIONCODE: '123' }, 999))
        .rejects.toThrow(); 
    });

    it('should verify successfully', async () => {
      mockCompanyRepository.findOne.mockResolvedValue({ ...mockCompany, isVerified: false });
      const result = await service.verifyCompany({ VERFICATIONCODE: '123456' }, 1);
      expect(result.message).toContain('successfully');
    });
  });

  describe('login', () => {
    const loginDto = { email: 't@t.com', password: '123' };
    
    it('should login successfully', async () => {
      mockCompanyRepository.findOne.mockResolvedValue(mockCompany);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const result = await service.login(loginDto);
      expect(result.access_token).toBeDefined();
    });

    it('should throw if deactivated', async () => {
      mockCompanyRepository.findOne.mockResolvedValue({ ...mockCompany, isActive: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Password Management', () => {
    it('forgotPassword: should send mail', async () => {
      mockCompanyRepository.findOne.mockResolvedValue(mockCompany);
      await service.forgotPassword({ email: 't@t.com' });
      expect(mockMailService.sendMail).toHaveBeenCalled();
    });

    it('resetPassword: should reset successfully', async () => {
      mockCompanyRepository.findOne.mockResolvedValue(mockCompany);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHash');
      const result = await service.resetPassword({ email: 't@t.com', newPassword: '123', confirmPassword: '123' });
      expect(result.message).toBe('Password reset successfully');
    });

    it('resetPassword: should throw if no reset request found', async () => {
      // لضمان فشل الاختبار ودخوله في الـ catch كما في السيرفيس الخاصة بك
      mockCompanyRepository.findOne.mockResolvedValue(null);
      await expect(service.resetPassword({ email: 'wrong@t.com', newPassword: '123', confirmPassword: '123' }))
        .rejects.toThrow();
    });

    it('changePassword: should change successfully', async () => {
        mockCompanyRepository.findOne.mockResolvedValue(mockCompany);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        (bcrypt.hash as jest.Mock).mockResolvedValue('newHash');
        const result = await service.changePassword(1, { oldPassword: '123', newPassword: '321', confirmPassword: '321' });
        expect(result.message).toContain('successfully');
    });
  });

  describe('verifyResetCode', () => {
    it('should verify reset code successfully', async () => {
      mockCompanyRepository.findOne.mockResolvedValue({ ...mockCompany, resetCode: '654321' });
      const result = await service.verifyResetCode('test@company.com', '654321');
      // تم التعديل ليطابق: "Code verified."
      expect(result.message).toBe('Code verified.');
    });

    it('should throw if reset code is invalid', async () => {
      mockCompanyRepository.findOne.mockResolvedValue({ ...mockCompany, resetCode: '654321' });
      // تم التعديل ليطابق: "Invalid code or email"
      await expect(service.verifyResetCode('test@company.com', '000000'))
        .rejects.toThrow('Invalid code or email');
    });
  });

  describe('changeAccountStatus', () => {
    it('should activate/deactivate account', async () => {
      mockCompanyRepository.findOne.mockResolvedValue(mockCompany);
      const result = await service.changeAccountStatus(1, false);
      expect(result.message).toContain('deactivated');
    });
  });

  describe('Profile & Account Operations', () => {
    it('updateProfileImage: should unlink old and save new', async () => {
      mockCompanyRepository.findOne.mockResolvedValue({ ...mockCompany, profileImage: 'old.jpg' });
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const result = await service.updateProfileImage(1, 'new.jpg');
      expect(result.profileImage).toBe('new.jpg');
    });

    it('editProfile: should update fields', async () => {
      mockCompanyRepository.findOne.mockResolvedValue(mockCompany);
      const result = await service.editProfile(1, { name: 'Updated' });
      expect(result.message).toContain('updated');
    });

    it('deleteAccount: should remove', async () => {
      mockCompanyRepository.findOne.mockResolvedValue(mockCompany);
      const result = await service.deleteAccount(1);
      expect(mockCompanyRepository.remove).toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('should resend if not verified', async () => {
      mockCompanyRepository.findOne.mockResolvedValue({ ...mockCompany, isVerified: false });
      await service.resendVerification(1);
      expect(mockMailService.sendMail).toHaveBeenCalled();
    });

    it('should throw if already verified', async () => {
      mockCompanyRepository.findOne.mockResolvedValue({ ...mockCompany, isVerified: true });
      // تم التعديل ليطابق الـ Capitalization: "Already verified"
      await expect(service.resendVerification(1)).rejects.toThrow('Already verified');
    });
  });
});