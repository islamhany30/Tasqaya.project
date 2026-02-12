// test/company-advanced.e2e-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Company } from '../src/entities/Company';
import {
  createTestCompany,
  deleteTestCompany,
  CompanyFactory,
  expectValidJWT,
  expectErrorResponse,
  expectSuccessResponse,
  DatabaseSeeder,
  cleanupUploads,
} from './test-helpers';
import * as path from 'path';

describe('Company Advanced E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let seeder: DatabaseSeeder;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    seeder = new DatabaseSeeder(dataSource);
  });

  afterAll(async () => {
    await seeder.cleanup();
    cleanupUploads(path.join(process.cwd(), 'Uploads', 'Company-Profile'));
    await app.close();
  });

  describe('Verification Code Expiration', () => {
    it('should reject expired verification code', async () => {
      const companyData = CompanyFactory.validCompanyData();

      const regResponse = await request(app.getHttpServer())
        .post('/api/company/register')
        .send(companyData);

      const company = await dataSource
        .getRepository(Company)
        .findOne({ where: { email: companyData.email } });

      expect(company).not.toBeNull();

      await dataSource
        .getRepository(Company)
        .update(company!.id, {
          verificationCodeExpiry: new Date(Date.now() - 1000),
        });

      const code = company!.verificationCode ?? null;
      expect(code).not.toBeNull();

      const verifyResponse = await request(app.getHttpServer())
        .post('/api/company/verify')
        .set('Authorization', `Bearer ${regResponse.body.token}`)
        .send({ VERFICATIONCODE: code });

      expectErrorResponse(verifyResponse, 400, 'expired');
    });

    it('should allow verification within time limit', async () => {
      const companyData = CompanyFactory.validCompanyData();

      const regResponse = await request(app.getHttpServer())
        .post('/api/company/register')
        .send(companyData);

      const company = await dataSource
        .getRepository(Company)
        .findOne({ where: { email: companyData.email } });

      expect(company).not.toBeNull();

      const expiry = company!.verificationCodeExpiry;
      expect(expiry).not.toBeNull();
      expect(expiry!.getTime()).toBeGreaterThan(Date.now());

      const code = company!.verificationCode ?? null;
      expect(code).not.toBeNull();

      const verifyResponse = await request(app.getHttpServer())
        .post('/api/company/verify')
        .set('Authorization', `Bearer ${regResponse.body.token}`)
        .send({ VERFICATIONCODE: code });

      expectSuccessResponse(verifyResponse, 'verified');
    });
  });

  describe('Login Security', () => {
    let testCompany: Company;
    let companyData: any;

    beforeAll(async () => {
      companyData = CompanyFactory.validCompanyData();

      const regResponse = await request(app.getHttpServer())
        .post('/api/company/register')
        .send(companyData);

      testCompany = (await dataSource
        .getRepository(Company)
        .findOne({ where: { email: companyData.email } }))!;

      const code = testCompany.verificationCode ?? null;
      expect(code).not.toBeNull();

      await request(app.getHttpServer())
        .post('/api/company/verify')
        .set('Authorization', `Bearer ${regResponse.body.token}`)
        .send({ VERFICATIONCODE: code });
    });

    it('should prevent login for deactivated account', async () => {
      await dataSource
        .getRepository(Company)
        .update(testCompany.id, { isActive: false });

      const response = await request(app.getHttpServer())
        .post('/api/company/login')
        .send({
          email: companyData.email,
          password: companyData.password,
        });

      expectErrorResponse(response, 403, 'deactivated');

      await dataSource
        .getRepository(Company)
        .update(testCompany.id, { isActive: true });
    });
  });

  describe('Password Reset Flow', () => {
    let testCompany: Company;
    let companyData: any;

    beforeAll(async () => {
      testCompany = await createTestCompany(dataSource);
      companyData = { email: testCompany.email, password: 'Test@12345' };
    });

    afterAll(async () => {
      await deleteTestCompany(dataSource, testCompany.id);
    });

    it('should complete full password reset flow', async () => {
      await request(app.getHttpServer())
        .post('/api/company/forgot-password')
        .send({ email: testCompany.email });

      const company = await dataSource
        .getRepository(Company)
        .findOne({ where: { id: testCompany.id } });

      expect(company).not.toBeNull();

      const resetCode = company!.resetCode ?? null;
      expect(resetCode).not.toBeNull();

      const verifyResponse = await request(app.getHttpServer())
        .post('/api/company/verify-reset-code')
        .send({
          email: testCompany.email,
          code: resetCode,
        });

      expectSuccessResponse(verifyResponse, 'verified');

      const newPassword = 'NewPassword@123';

      await request(app.getHttpServer())
        .put('/api/company/reset-password')
        .send({
          email: testCompany.email,
          newPassword: newPassword,
        });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/company/login')
        .send({
          email: testCompany.email,
          password: newPassword,
        });

      expectSuccessResponse(loginResponse);
      expectValidJWT(loginResponse.body.access_token);
    });

    it('should invalidate old reset code after password reset', async () => {
      await request(app.getHttpServer())
        .post('/api/company/forgot-password')
        .send({ email: testCompany.email });

      const company = await dataSource
        .getRepository(Company)
        .findOne({ where: { id: testCompany.id } });

      const oldResetCode = company!.resetCode ?? null;
      expect(oldResetCode).not.toBeNull();

      await request(app.getHttpServer())
        .put('/api/company/reset-password')
        .send({
          email: testCompany.email,
          newPassword: 'AnotherPassword@123',
        });

      const response = await request(app.getHttpServer())
        .post('/api/company/verify-reset-code')
        .send({
          email: testCompany.email,
          code: oldResetCode,
        });

      expectErrorResponse(response, 400);
    });
  });
});
