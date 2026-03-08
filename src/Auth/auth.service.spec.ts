// =============================================================================
// auth.service.spec.ts
// =============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './Auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MailService } from '../Mail/MailService';
import { Account } from '../entities/Accounts';
import { Admin } from '../entities/Admin';
import { Worker } from '../entities/Worker';
import { Supervisor } from '../entities/Supervisor';
import { Company } from '../entities/Company';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '../Enums/User.role';
import * as bcrypt from 'bcryptjs';

// ── Mock IAuthUser — مطابق للـ interface الحقيقية ────────────────────────────
const mockUserService = () => ({
  findByEmail:          jest.fn(),
  findById:             jest.fn(),
  validatePassword:     jest.fn(),
  setVerificationCode:  jest.fn(),
  setResetCode:         jest.fn(),
  verifyUser:           jest.fn(),
  updatePassword:       jest.fn(),
  clearResetCode:       jest.fn(),
  createUser:           jest.fn().mockResolvedValue({ id: 10 }),
  deactivateUser:       jest.fn(),
  deleteUser:           jest.fn(),
});

const mockRepoFactory = () => ({
  findOne:  jest.fn(),
  find:     jest.fn(),
  create:   jest.fn().mockImplementation((dto) => dto),
  save:     jest.fn().mockImplementation((e) => Promise.resolve({ id: 1, ...e })),
});

// ── DataSource transaction mock ───────────────────────────────────────────────
// بيعمل manager جوا transaction وبيرجع ناتج الـ callback
const buildDataSourceMock = (
  savedAccount = { id: 1, email: 'u@test.com', role: UserRole.COMPANY },
) => {
  const txAccountRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save:   jest.fn().mockResolvedValue(savedAccount),
  };

  const txManager = {
    getRepository: jest.fn().mockReturnValue(txAccountRepo),
  };

  return {
    transaction: jest.fn().mockImplementation((cb) => cb(txManager)),
    getRepository: jest.fn().mockReturnValue(mockRepoFactory()),
    _txAccountRepo: txAccountRepo, // للـ assertions
  };
};

// =============================================================================
describe('AuthService', () => {
  let service: AuthService;
  let accountRepo: ReturnType<typeof mockRepoFactory>;
  let mailService: { sendMail: jest.Mock };
  let dataSource: ReturnType<typeof buildDataSourceMock>;
  let userService: ReturnType<typeof mockUserService>;

  beforeEach(async () => {
    dataSource = buildDataSourceMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService,    useValue: { sign: jest.fn().mockReturnValue('mock_token') } },
        { provide: MailService,   useValue: { sendMail: jest.fn().mockResolvedValue(true) } },
        { provide: getRepositoryToken(Account),    useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Admin),      useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Worker),     useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Supervisor), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Company),    useValue: mockRepoFactory() },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service      = module.get(AuthService);
    accountRepo  = module.get(getRepositoryToken(Account));
    mailService  = module.get(MailService);
    userService  = mockUserService();
  });

  // =========================================================================
  // 1. register
  // =========================================================================
  describe('register', () => {
    const dto = { email: 'co@test.com', password: 'pass123' };

    it('should register inside a transaction and return token', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      const result = await service.register(dto, 'Welcome', userService, UserRole.COMPANY);

      // التأكد إن الـ transaction اتعملت
      expect(dataSource.transaction).toHaveBeenCalled();
      // account اتعمل جوا الـ transaction
      expect(dataSource._txAccountRepo.save).toHaveBeenCalled();
      // createUser اتنادى جوا الـ transaction
      expect(userService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'co@test.com',
          isVerified: false,
          isActive: true,
        }),
      );
      // الإيميل اتبعت بعد الـ transaction
      expect(mailService.sendMail).toHaveBeenCalled();
      expect(result.token).toBe('mock_token');
      expect(result.message).toContain('Registered');
    });

    it('should throw BadRequestException if email already exists — transaction never runs', async () => {
      accountRepo.findOne.mockResolvedValue({ id: 1, email: 'co@test.com' });

      await expect(
        service.register(dto, 'Welcome', userService, UserRole.COMPANY),
      ).rejects.toThrow(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('should NOT send email if transaction fails — rollback behavior', async () => {
      accountRepo.findOne.mockResolvedValue(null);
      dataSource.transaction.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.register(dto, 'Welcome', userService, UserRole.COMPANY),
      ).rejects.toThrow('DB Error');

      // الإيميل ما اتبعتش عشان الـ transaction فشلت
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. verifyUser
  // =========================================================================
  describe('verifyUser', () => {
    it('should verify user successfully', async () => {
      userService.findById.mockResolvedValue({
        isVerified: false,
        verificationCode: '123456',
        verificationCodeExpiry: new Date(Date.now() + 60_000),
      });

      const result = await service.verifyUser('123456', 1, userService);
      expect(userService.verifyUser).toHaveBeenCalledWith(1);
      expect(result.message).toContain('verified');
    });

    it('should throw NotFoundException if user not found', async () => {
      userService.findById.mockResolvedValue(null);
      await expect(service.verifyUser('123456', 1, userService))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already verified', async () => {
      userService.findById.mockResolvedValue({ isVerified: true });
      await expect(service.verifyUser('123456', 1, userService))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no verification code on record', async () => {
      userService.findById.mockResolvedValue({
        isVerified: false,
        verificationCode: null,
        verificationCodeExpiry: null,
      });
      await expect(service.verifyUser('123456', 1, userService))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if code does not match', async () => {
      userService.findById.mockResolvedValue({
        isVerified: false,
        verificationCode: '999999',
        verificationCodeExpiry: new Date(Date.now() + 60_000),
      });
      await expect(service.verifyUser('123456', 1, userService))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if code is expired', async () => {
      userService.findById.mockResolvedValue({
        isVerified: false,
        verificationCode: '123456',
        verificationCodeExpiry: new Date(Date.now() - 1_000),
      });
      await expect(service.verifyUser('123456', 1, userService))
        .rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 3. resendVerification
  // =========================================================================
  describe('resendVerification', () => {
    it('should resend code and send email', async () => {
      userService.findById.mockResolvedValue({ isVerified: false, email: 'u@test.com' });

      const result = await service.resendVerification(1, userService);

      expect(userService.setVerificationCode).toHaveBeenCalled();
      expect(mailService.sendMail).toHaveBeenCalled();
      expect(result.message).toContain('sent');
    });

    it('should throw BadRequestException if user not found', async () => {
      userService.findById.mockResolvedValue(null);
      await expect(service.resendVerification(1, userService))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already verified', async () => {
      userService.findById.mockResolvedValue({ isVerified: true });
      await expect(service.resendVerification(1, userService))
        .rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 4. login
  // =========================================================================
  describe('login', () => {
    it('should login successfully and return token', async () => {
      const hashed = await bcrypt.hash('pass123', 10);
      accountRepo.findOne.mockResolvedValue({
        id: 1, email: 'u@test.com', password: hashed,
        role: UserRole.COMPANY, isActive: true,
      });

      const result = await service.login('u@test.com', 'pass123');
      expect(result.token).toBe('mock_token');
      expect(result.message).toContain('successful');
    });

    it('should throw UnauthorizedException if email not found', async () => {
      accountRepo.findOne.mockResolvedValue(null);
      await expect(service.login('x@x.com', 'pass'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      accountRepo.findOne.mockResolvedValue({ id: 1, password: hashed, isActive: true });
      await expect(service.login('u@test.com', 'wrong'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if account is deactivated', async () => {
      const hashed = await bcrypt.hash('pass123', 10);
      accountRepo.findOne.mockResolvedValue({ id: 1, password: hashed, isActive: false });
      await expect(service.login('u@test.com', 'pass123'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // 5. changePassword
  // =========================================================================
  describe('changePassword', () => {
    it('should change password successfully', async () => {
      userService.findById.mockResolvedValue({ id: 1 });
      userService.validatePassword.mockResolvedValue(true);

      const result = await service.changePassword(1, 'oldpass', 'newpass', userService);
      expect(userService.updatePassword).toHaveBeenCalled();
      expect(result.message).toContain('changed');
    });

    it('should throw BadRequestException if user not found', async () => {
      userService.findById.mockResolvedValue(null);
      await expect(service.changePassword(1, 'old', 'new', userService))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if old password is wrong', async () => {
      userService.findById.mockResolvedValue({ id: 1 });
      userService.validatePassword.mockResolvedValue(false);
      await expect(service.changePassword(1, 'wrong', 'new', userService))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // 6. forgotPassword
  // =========================================================================
  describe('forgotPassword', () => {
    it('should send reset code and return token', async () => {
      accountRepo.findOne
        .mockResolvedValueOnce({ id: 1, email: 'u@test.com', role: 'company' })
        .mockResolvedValueOnce({
          id: 1, role: 'company',
          company: { id: 10, resetCode: null, resetCodeExpiry: null },
        });

      dataSource.getRepository.mockReturnValue({
        save: jest.fn().mockResolvedValue({}),
      });

      const result = await service.forgotPassword('u@test.com');
      expect(mailService.sendMail).toHaveBeenCalled();
      expect(result.token).toBe('mock_token');
      expect(result.message).toContain('sent');
    });

    it('should throw NotFoundException if email not found', async () => {
      accountRepo.findOne.mockResolvedValue(null);
      await expect(service.forgotPassword('x@x.com'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if profile relation not found', async () => {
      accountRepo.findOne
        .mockResolvedValueOnce({ id: 1, email: 'u@test.com', role: 'company' })
        .mockResolvedValueOnce({ id: 1, role: 'company', company: null });

      await expect(service.forgotPassword('u@test.com'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // 7. verifyResetCode
  // =========================================================================
  describe('verifyResetCode', () => {
    it('should verify reset code successfully', async () => {
      accountRepo.findOne
        .mockResolvedValueOnce({ id: 1, role: 'company' })
        .mockResolvedValueOnce({
          id: 1, role: 'company',
          company: { resetCode: '111222', resetCodeExpiry: new Date(Date.now() + 60_000) },
        });

      const result = await service.verifyResetCode(1, '111222');
      expect(result.message).toContain('verified');
    });

    it('should throw NotFoundException if account not found', async () => {
      accountRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyResetCode(1, '111222'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if profile not found', async () => {
      accountRepo.findOne
        .mockResolvedValueOnce({ id: 1, role: 'company' })
        .mockResolvedValueOnce({ id: 1, role: 'company', company: null });

      await expect(service.verifyResetCode(1, '111222'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if code is wrong', async () => {
      accountRepo.findOne
        .mockResolvedValueOnce({ id: 1, role: 'company' })
        .mockResolvedValueOnce({
          id: 1, role: 'company',
          company: { resetCode: '999999', resetCodeExpiry: new Date(Date.now() + 60_000) },
        });
      await expect(service.verifyResetCode(1, '111222'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if code is expired', async () => {
      accountRepo.findOne
        .mockResolvedValueOnce({ id: 1, role: 'company' })
        .mockResolvedValueOnce({
          id: 1, role: 'company',
          company: { resetCode: '111222', resetCodeExpiry: new Date(Date.now() - 1_000) },
        });
      await expect(service.verifyResetCode(1, '111222'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 8. resetPassword (with transaction)
  // =========================================================================
  describe('resetPassword', () => {
    it('should reset password successfully using transaction', async () => {
      accountRepo.findOne
        .mockResolvedValueOnce({ id: 1, role: 'company', password: 'old' })
        .mockResolvedValueOnce({
          id: 1, role: 'company',
          company: { id: 10, resetCode: '111222' },
        });

      const result = await service.resetPassword(1, 'newPassword123');
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.message).toContain('reset');
    });

    it('should throw NotFoundException if account not found', async () => {
      accountRepo.findOne.mockResolvedValue(null);
      await expect(service.resetPassword(1, 'newpass'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if profile not found', async () => {
      accountRepo.findOne
        .mockResolvedValueOnce({ id: 1, role: 'company' })
        .mockResolvedValueOnce({ id: 1, role: 'company', company: null });

      await expect(service.resetPassword(1, 'newpass'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if no resetCode exists', async () => {
      accountRepo.findOne
        .mockResolvedValueOnce({ id: 1, role: 'company' })
        .mockResolvedValueOnce({
          id: 1, role: 'company',
          company: { id: 10, resetCode: null },
        });
      await expect(service.resetPassword(1, 'newpass'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 9. deactivateAccount
  // =========================================================================
  describe('deactivateAccount', () => {
    it('should deactivate account successfully', async () => {
      userService.findById.mockResolvedValue({ id: 1 });
      userService.validatePassword.mockResolvedValue(true);

      const result = await service.deactivateAccount(1, 'pass123', userService);
      expect(userService.deactivateUser).toHaveBeenCalledWith(1);
      expect(result.message).toContain('Deactivated');
    });

    it('should throw NotFoundException if user not found', async () => {
      userService.findById.mockResolvedValue(null);
      await expect(service.deactivateAccount(1, 'pass', userService))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      userService.findById.mockResolvedValue({ id: 1 });
      userService.validatePassword.mockResolvedValue(false);
      await expect(service.deactivateAccount(1, 'wrong', userService))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // 10. deleteAccount
  // =========================================================================
  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      userService.findById.mockResolvedValue({ id: 1 });
      userService.validatePassword.mockResolvedValue(true);

      const result = await service.deleteAccount(1, 'pass123', userService);
      expect(userService.deleteUser).toHaveBeenCalledWith(1);
      expect(result.message).toContain('Deleted');
    });

    it('should throw NotFoundException if user not found', async () => {
      userService.findById.mockResolvedValue(null);
      await expect(service.deleteAccount(1, 'pass', userService))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      userService.findById.mockResolvedValue({ id: 1 });
      userService.validatePassword.mockResolvedValue(false);
      await expect(service.deleteAccount(1, 'wrong', userService))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});


