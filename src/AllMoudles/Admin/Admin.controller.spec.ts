import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './Admin.controller';
import { AdminService } from './Admin.service';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
// تأكد من استيراد الـ Guards بشكل صحيح بناءً على مسارات مشروعك
import { JwtAuthGuard } from '../../Auth/auth.guards';
import { JwtRegisterAuthGuard } from '../../Auth/auth.guards.register';

describe('AdminController', () => {
  let controller: AdminController;
  let service: AdminService;

  const mockAdminService = {
    // أضف الدوال التي تستخدمها هنا
    updateProfileImage: jest.fn(),
    verifyResetCode: jest.fn(),
    forgotPassword: jest.fn(),
    changeCompanyStatus: jest.fn(),
    getAllCompaniesForAdmin: jest.fn(), // <-- ضيفنا الدالة الجديدة هنا
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
        // توفير JwtService وهمي (Mock)
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        // توفير DataSource وهمي (Mock)
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    })
      // كسر حلقة الـ Guards لكي لا يتم استدعاء المنطق الداخلي لها أثناء التست
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(JwtRegisterAuthGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // تيست جديد للـ get all companies
  describe('getAllCompanies', () => {
    it('should return an array of companies', async () => {
      const mockCompanies = [
        { id: 1, name: 'Company A', isActive: true },
        { id: 2, name: 'Company B', isActive: false },
      ];

      mockAdminService.getAllCompaniesForAdmin.mockResolvedValue(mockCompanies);

      const result = await controller.getAllCompanies();
      expect(result).toEqual(mockCompanies);
      expect(mockAdminService.getAllCompaniesForAdmin).toHaveBeenCalled();
    });
  });

  // ... باقي الاختبارات الخاصة بك
});
