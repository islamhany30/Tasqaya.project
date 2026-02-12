// test/helpers/test-helpers.ts

import { DataSource } from 'typeorm';
import { Company } from '../src/entities/Company';
import * as bcrypt from 'bcrypt';

/**
 * Helper لإنشاء company في الـ database للاختبار
 */
export async function createTestCompany(
  dataSource: DataSource,
  overrides?: Partial<Company>,
): Promise<Company> {
  const companyRepo = dataSource.getRepository(Company);

  const defaultCompany = {
    email: `test-${Date.now()}@company.com`,
    password: await bcrypt.hash('Test@12345', 10),
    name: 'Test Company',
    phone: '01234567890',
    address: 'Test Address, Test City',
    isVerified: true,
    isActive: true,
    ...overrides,
  };

  const company = companyRepo.create(defaultCompany);
  return await companyRepo.save(company);
}

/**
 * Helper لحذف company من الـ database
 */
export async function deleteTestCompany(
  dataSource: DataSource,
  companyId: number,
): Promise<void> {
  const companyRepo = dataSource.getRepository(Company);
  await companyRepo.delete({ id: companyId });
}

/**
 * Helper لإنشاء verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Helper لإنشاء admin token (للاختبارات التي تحتاج admin access)
 */
export function createAdminToken(jwtService: any): string {
  return jwtService.sign({
    sub: 1,
    email: 'admin@test.com',
    role: 'ADMIN',
  });
}

/**
 * Helper لإنشاء company token
 */
export function createCompanyToken(
  jwtService: any,
  companyId: number,
  email: string,
): string {
  return jwtService.sign({
    sub: companyId,
    email: email,
    role: 'COMPANY',
  });
}

/**
 * Helper لتنظيف الـ uploads folder بعد الاختبارات
 */
export function cleanupUploads(uploadsPath: string): void {
  const fs = require('fs');
  const path = require('path');

  if (fs.existsSync(uploadsPath)) {
    const files = fs.readdirSync(uploadsPath);
    files.forEach((file: string) => {
      if (file.startsWith('company-')) {
        fs.unlinkSync(path.join(uploadsPath, file));
      }
    });
  }
}

/**
 * Helper لانتظار فترة زمنية (مفيد للـ expiration tests)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper لإنشاء mock MailService
 */
export const createMockMailService = () => ({
  sendMail: jest.fn().mockResolvedValue(true),
});

/**
 * Helper لإنشاء mock JwtService
 */
export const createMockJwtService = () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({
    sub: 1,
    email: 'test@company.com',
    role: 'COMPANY',
  }),
  verifyAsync: jest.fn().mockResolvedValue({
    sub: 1,
    email: 'test@company.com',
    role: 'COMPANY',
  }),
});

/**
 * Helper لإنشاء test image file
 */
export function createTestImageFile(): Buffer {
  // Base64 encoded 1x1 transparent PNG
  const base64Image =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return Buffer.from(base64Image, 'base64');
}

/**
 * Helper للتحقق من email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Helper للتحقق من password strength
 */
export function isStrongPassword(password: string): boolean {
  // على الأقل 8 أحرف، حرف كبير، حرف صغير، رقم، ورمز خاص
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

/**
 * Helper لإنشاء expired date
 */
export function createExpiredDate(): Date {
  return new Date(Date.now() - 1000);
}

/**
 * Helper لإنشاء future date
 */
export function createFutureDate(minutesFromNow: number): Date {
  return new Date(Date.now() + minutesFromNow * 60 * 1000);
}

/**
 * Test data factory للـ Company
 */
export class CompanyFactory {
  static validCompanyData() {
    return {
      email: `company-${Date.now()}@test.com`,
      password: 'Test@12345',
      confirmPassword: 'Test@12345',
      name: 'Test Company',
      phone: '01234567890',
      address: 'Test Address, Test City',
    };
  }

  static invalidEmailData() {
    return {
      ...this.validCompanyData(),
      email: 'invalid-email',
    };
  }

  static weakPasswordData() {
    return {
      name: 'Test Company',
      email: `company-${Date.now()}@test.com`,
      password: '123',
      confirmPassword: '123',
      phone: '01234567890',
      address: 'Test Address',
    };
  }

  static passwordMismatchData() {
    return {
      ...this.validCompanyData(),
      confirmPassword: 'DifferentPassword@123',
    };
  }

  static shortNameData() {
    return {
      ...this.validCompanyData(),
      name: 'AB', // أقل من 3 أحرف
    };
  }

  static shortPhoneData() {
    return {
      ...this.validCompanyData(),
      phone: '123', // أقل من 10
    };
  }

  static shortAddressData() {
    return {
      ...this.validCompanyData(),
      address: 'ABC', // أقل من 5
    };
  }

  static unverifiedCompany() {
    return {
      name: 'Test Company',
      email: `unverified-${Date.now()}@test.com`,
      password: 'Test@12345',
      phone: '01234567890',
      address: 'Test Address',
      isVerified: false,
      verificationCode: generateVerificationCode(),
      verificationCodeExpiry: createFutureDate(5),
    };
  }

  static inactiveCompany() {
    return {
      name: 'Inactive Company',
      email: `inactive-${Date.now()}@test.com`,
      password: 'Test@12345',
      phone: '01234567890',
      address: 'Test Address',
      isActive: false,
    };
  }
}

/**
 * Matcher للتحقق من JWT token structure
 */
export function expectValidJWT(token: string): void {
  expect(token).toBeDefined();
  expect(typeof token).toBe('string');
  expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
}

/**
 * Matcher للتحقق من error response structure
 */
export function expectErrorResponse(
  response: any,
  statusCode: number,
  messageContains?: string,
): void {
  expect(response.status).toBe(statusCode);
  expect(response.body).toHaveProperty('message');
  if (messageContains) {
    expect(response.body.message).toContain(messageContains);
  }
}

/**
 * Matcher للتحقق من success response structure
 */
export function expectSuccessResponse(
  response: any,
  messageContains?: string,
): void {
  expect(response.status).toBeLessThan(400);
  expect(response.body).toHaveProperty('message');
  if (messageContains) {
    expect(response.body.message).toContain(messageContains);
  }
}

/**
 * Database seeder للـ testing
 */
export class DatabaseSeeder {
  constructor(private dataSource: DataSource) {}

  async seedCompanies(count: number = 5): Promise<Company[]> {
    const companies: Company[] = [];
    const companyRepo = this.dataSource.getRepository(Company);

    for (let i = 0; i < count; i++) {
      const company = await createTestCompany(this.dataSource, {
        email: `company-${i}-${Date.now()}@test.com`,
        name: `Test Company ${i}`,
      });
      companies.push(company);
    }

    return companies;
  }

  async cleanup(): Promise<void> {
    const companyRepo = this.dataSource.getRepository(Company);
    await companyRepo.delete({});
  }
}

/**
 * Mock Request helper
 */
export function createMockRequest(user?: any): any {
  return {
    user: user || { sub: 1, email: 'test@company.com', role: 'COMPANY' },
    headers: {},
  };
}

/**
 * Mock File Upload helper
 */
export function createMockFile(
  filename: string = 'test-image.jpg',
): Express.Multer.File {
  return {
    fieldname: 'image',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    destination: './Uploads/Company-Profile',
    filename: filename,
    path: `./Uploads/Company-Profile/${filename}`,
    buffer: createTestImageFile(),
    stream: null as any,
  };
}