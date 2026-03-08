// =============================================================================
// auth.controller.spec.ts
// =============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './Auth.controller';
import { AuthService } from './Auth.service';
import { JwtAccountAuthGuard } from './auth.guards.account';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  // JwtAccountAuthGuard بيستخدم JwtService + DataSource
  // .overrideGuard() بيحل الموضوع من غير ما نحتاج inject أي dependencies
  const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };
  const mockReq   = (id = 1) => ({ user: { id } });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login:           jest.fn(),
            forgotPassword:  jest.fn(),
            verifyResetCode: jest.fn(),
            resetPassword:   jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAccountAuthGuard).useValue(mockGuard)
      .compile();

    controller  = module.get(AuthController);
    authService = module.get(AuthService);
  });

  // ── login ─────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('should delegate to authService.login', async () => {
      authService.login.mockResolvedValue({ token: 'jwt_token', message: 'Login successful' });

      const result = await controller.login({ email: 'u@test.com', password: 'pass123' } as any);

      expect(authService.login).toHaveBeenCalledWith('u@test.com', 'pass123');
      expect(result.token).toBe('jwt_token');
    });
  });

  // ── forgotPassword ────────────────────────────────────────────────────────
  describe('forgotPassword', () => {
    it('should delegate to authService.forgotPassword', async () => {
      authService.forgotPassword.mockResolvedValue({ message: 'Reset code sent', token: 'rt' });

      const result = await controller.forgotPassword({ email: 'u@test.com' } as any);

      expect(authService.forgotPassword).toHaveBeenCalledWith('u@test.com');
      expect(result.message).toContain('sent');
    });
  });

  // ── verifyResetCode ───────────────────────────────────────────────────────
  describe('verifyResetCode', () => {
    it('should delegate to authService.verifyResetCode with user.id', async () => {
      authService.verifyResetCode.mockResolvedValue({ message: 'Code verified' });

      const result = await controller.verifyResetCode({ code: '111222' } as any, mockReq(5));

      // الـ controller بيبعت req.user.id مش req.user.sub
      expect(authService.verifyResetCode).toHaveBeenCalledWith(5, '111222');
      expect(result.message).toContain('verified');
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    it('should delegate to authService.resetPassword with user.id', async () => {
      authService.resetPassword.mockResolvedValue({ message: 'Password reset successfully' });

      const result = await controller.resetPassword({ newPassword: 'newPass123' } as any, mockReq(3));

      expect(authService.resetPassword).toHaveBeenCalledWith(3, 'newPass123');
      expect(result.message).toContain('reset');
    });
  });
});