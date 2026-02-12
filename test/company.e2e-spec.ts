import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Company } from '../src/entities/Company';


describe('Company E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let registerToken: string;
  let companyId: number;

  // ✅ المهم هنا — خليه قابل لـ null لأن الداتا بيز بتسمح بكده
  let verificationCode: string | null = null;
  let resetCode: string | null = null;

  const testCompany = {
    email: 'test@company.com',
    password: 'Test@12345',
    confirmPassword: 'Test@12345',
    name: 'Test Company',
    phone: '01234567890',
    address: 'Test Address, Cairo, Egypt',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    if (companyId) {
      const companyRepo = dataSource.getRepository(Company);
      await companyRepo.delete({ id: companyId });
    }
    await app.close();
  });

  describe('POST /api/company/register', () => {
    it('should register a new company successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/company/register')
        .send(testCompany)
        .expect(201);

      registerToken = response.body.token;

      const companyRepo = dataSource.getRepository(Company);
      const company = await companyRepo.findOne({
        where: { email: testCompany.email },
      });

      expect(company).not.toBeNull();
      companyId = company!.id;

      // ✅ التعديل الأساسي اللي انت عايزه:
      verificationCode = company!.verificationCode ?? null;
      expect(verificationCode).not.toBeNull();
    });
  });

  describe('POST /api/company/verify', () => {
    it('should verify company with correct code', async () => {
      // لو لسبب ما كان null بنرجع نجيبه من الداتا بيز
      if (!verificationCode) {
        const repo = dataSource.getRepository(Company);
        const company = await repo.findOne({
          where: { id: companyId },
        });
        verificationCode = company?.verificationCode ?? null;
      }

      const response = await request(app.getHttpServer())
        .post('/api/company/verify')
        .set('Authorization', `Bearer ${registerToken}`)
        .send({ VERFICATIONCODE: verificationCode })
        .expect(201);

      expect(response.body.message).toContain('verified successfully');
    });
  });

  describe('POST /api/company/forgot-password', () => {
    it('should send reset code to email', async () => {
      await request(app.getHttpServer())
        .post('/api/company/forgot-password')
        .send({ email: testCompany.email })
        .expect(201);

      const companyRepo = dataSource.getRepository(Company);
      const company = await companyRepo.findOne({
        where: { email: testCompany.email },
      });

      expect(company).not.toBeNull();

      // ✅ نفس الفكرة هنا
      resetCode = company!.resetCode ?? null;
      expect(resetCode).not.toBeNull();
    });
  });

  describe('POST /api/company/verify-reset-code', () => {
    it('should verify reset code successfully', async () => {
      // لو الكود null نجيبه تاني من الداتا بيز
      if (!resetCode) {
        const repo = dataSource.getRepository(Company);
        const company = await repo.findOne({
          where: { email: testCompany.email },
        });
        resetCode = company?.resetCode ?? null;
      }

      const response = await request(app.getHttpServer())
        .post('/api/company/verify-reset-code')
        .send({
          email: testCompany.email,
          code: resetCode,
        })
        .expect(201);

      expect(response.body.message).toContain('Code verified successfully');
    });
  });

  describe('PUT /api/company/reset-password', () => {
    const resetPassword = 'ResetPassword@123';

    it('should reset password successfully', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/company/reset-password')
        .send({
          email: testCompany.email,
          newPassword: resetPassword,
          confirmPassword: resetPassword,
        })
        .expect(200);

      testCompany.password = resetPassword;
    });
  });

  describe('POST /api/company/login', () => {
    it('should login successfully with new password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/company/login')
        .send({
          email: testCompany.email,
          password: testCompany.password,
        })
        .expect(201);

      authToken = response.body.access_token;
    });
  });

  describe('DELETE /api/company/delete-account', () => {
    it('should delete company account', async () => {
      await request(app.getHttpServer())
        .delete('/api/company/delete-account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const companyRepo = dataSource.getRepository(Company);
      const deletedCompany = await companyRepo.findOne({
        where: { id: companyId },
      });

      expect(deletedCompany).toBeNull();
    });
  });
});
