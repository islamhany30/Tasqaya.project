import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from './Company.controller';
import { CompanyService } from './Company.service';
import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../Auth/auth.guards';
import { JwtRegisterAuthGuard } from '../../Auth/auth.guards.register';
import { AdminAuthGuard } from '../../Auth/Auth.roles';

describe('CompanyController', () => {
  let controller: CompanyController;
  let service: CompanyService;

  const mockCompanyService = {
    register: jest.fn(),
    verifyCompany: jest.fn(),
    resendVerification: jest.fn(),
    login: jest.fn(),
    changePassword: jest.fn(),
    updateProfileImage: jest.fn(),
    changeAccountStatus: jest.fn(), // سيبناها كـ Mock بس مش هناديها في الـ Controller Tests
    getCompanyById: jest.fn(),
    forgotPassword: jest.fn(),
    verifyResetCode: jest.fn(),
    resetPassword: jest.fn(),
    deleteAccount: jest.fn(),
    editProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [
        { provide: CompanyService, useValue: mockCompanyService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(JwtRegisterAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(AdminAuthGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CompanyController>(CompanyController);
    service = module.get<CompanyService>(CompanyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('registerCompany()', async () => {
    await controller.registerCompany({} as any);
    expect(service.register).toHaveBeenCalled();
  });

  it('verify()', async () => {
    await controller.verify({} as any, { user: { sub: 1 } } as any);
    expect(service.verifyCompany).toHaveBeenCalled();
  });

  it('resendVerification()', async () => {
    await controller.resendVerification({ user: { sub: 1 } } as any);
    expect(service.resendVerification).toHaveBeenCalled();
  });

  it('login()', async () => {
    await controller.login({} as any);
    expect(service.login).toHaveBeenCalled();
  });

  it('changePassword()', async () => {
    await controller.changePassword({ user: { sub: 1 } } as any, {} as any);
    expect(service.changePassword).toHaveBeenCalled();
  });

  it('uploadProfileImage() - success', async () => {
    const mockFile = { path: 'test.png' } as any;
    mockCompanyService.updateProfileImage.mockResolvedValue({ id: 1 });
    await controller.uploadProfileImage(mockFile, { user: { sub: 1 } } as any);
    expect(service.updateProfileImage).toHaveBeenCalled();
  });

  it('uploadProfileImage() - error', async () => {
    await expect(controller.uploadProfileImage(null as any, { user: { sub: 1 } } as any))
      .rejects.toThrow(BadRequestException);
  });

  it('getOwnData()', async () => {
    await controller.getOwnData({ user: { sub: 1 } } as any);
    expect(service.getCompanyById).toHaveBeenCalled();
  });

  // تم حذف changeStatus() لأنها لم تعد موجودة في الـ CompanyController
  // تم حذف getCompanyByAdmin() لأنها لم تعد موجودة في الـ CompanyController

  it('forgotPassword()', async () => {
    await controller.forgotPassword({} as any);
    expect(service.forgotPassword).toHaveBeenCalled();
  });

  it('verifyResetCode()', async () => {
    await controller.verifyResetCode({ email: 'a@a.com', code: '1' } as any);
    expect(service.verifyResetCode).toHaveBeenCalled();
  });

  it('resetPassword()', async () => {
    await controller.resetPassword({} as any);
    expect(service.resetPassword).toHaveBeenCalled();
  });

  it('deleteAccount()', async () => {
    await controller.deleteAccount({ user: { sub: 1 } } as any);
    expect(service.deleteAccount).toHaveBeenCalled();
  });

  it('editProfile()', async () => {
    await controller.editProfile({ user: { sub: 1 } } as any, {} as any);
    expect(service.editProfile).toHaveBeenCalled();
  });
});