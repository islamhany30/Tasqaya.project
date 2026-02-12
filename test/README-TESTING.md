# تعليمات تشغيل E2E Tests للـ Company Module

## المتطلبات الأساسية

تأكد من تثبيت الحزم التالية:

```bash
npm install --save-dev @nestjs/testing supertest @types/supertest jest ts-jest
```

## إعداد Test Database

### الطريقة الأولى: SQLite In-Memory (الأسهل والأسرع)

في ملف `app.module.ts` أو في test module منفصل، أضف:

```typescript
TypeOrmModule.forRoot({
  type: 'sqlite',
  database: ':memory:',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: true, // فقط للـ testing
})
```

### الطريقة الثانية: Test Database منفصلة

إنشاء ملف `.env.test`:

```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=test_user
DB_PASSWORD=test_password
DB_DATABASE=company_test_db
JWT_SECRET=test_jwt_secret_key
```

## هيكل الملفات

```
project-root/
├── test/
│   ├── company.e2e-spec.ts      # ملف الاختبارات الرئيسي
│   └── jest-e2e.json             # إعدادات Jest
├── src/
│   └── ... (الكود الأصلي)
└── package.json
```

## تشغيل الاختبارات

أضف السكريبت التالي في `package.json`:

```json
{
  "scripts": {
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "test:e2e:watch": "jest --config ./test/jest-e2e.json --watch",
    "test:e2e:cov": "jest --config ./test/jest-e2e.json --coverage"
  }
}
```

### تشغيل جميع الاختبارات:
```bash
npm run test:e2e
```

### تشغيل مع watch mode:
```bash
npm run test:e2e:watch
```

### تشغيل مع coverage report:
```bash
npm run test:e2e:cov
```

## ملاحظات مهمة

### 1. Admin Token للاختبارات
الـ tests الخاصة بـ Admin operations معطلة حالياً (مكتوبة كـ comments) لأنها تحتاج admin token حقيقي.

لتفعيلها، محتاج:
- إما تعمل admin registration/login endpoint
- أو تستخدم admin موجود مسبقاً في الـ test database

### 2. Mail Service في الـ Testing
لأن الـ tests بتستخدم `MailService.sendMail()`, في خيارين:

#### الخيار الأول: Mock الـ Mail Service
```typescript
const mockMailService = {
  sendMail: jest.fn().mockResolvedValue(true),
};

// في الـ testing module:
providers: [
  CompanyService,
  { provide: MailService, useValue: mockMailService },
]
```

#### الخيار الثاني: استخدام Mail Service حقيقي
- استخدم test email service مثل Ethereal Email
- أو اترك الـ service يشتغل عادي (بس ده هيبطئ الـ tests)

### 3. File Upload Testing
الـ test بتاع `profile-image` بينشئ صورة test بسيطة.

لو عايز تستخدم صورة حقيقية:
```bash
# ضع صورة test في مجلد test
test/
└── fixtures/
    └── test-image.jpg
```

وعدل المسار في الكود:
```typescript
const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
```

### 4. التعديلات المطلوبة

#### في ملف `company.e2e-spec.ts`:
1. أضف باقي حقول `CreateCompanyDto` في الـ `testCompany` object
2. فعّل الـ Admin tests بعد إضافة admin authentication
3. عدّل الـ DTOs حسب الـ validation rules عندك

#### مثال لإضافة الحقول:
```typescript
const testCompany = {
  email: 'test@company.com',
  password: 'Test@12345',
  name: 'Test Company',
  phone: '+201234567890',
  address: 'Test Address',
  // ... أضف باقي الحقول المطلوبة
};
```

## تشغيل Tests محددة

### تشغيل describe block واحد فقط:
```typescript
describe.only('POST /api/company/register', () => {
  // tests here
});
```

### تشغيل test واحد فقط:
```typescript
it.only('should register a new company successfully', async () => {
  // test here
});
```

### تخطي test معين:
```typescript
it.skip('should upload profile image successfully', async () => {
  // test here
});
```

## نصائح للـ Debugging

### 1. طباعة الـ response في حالة فشل الـ test:
```typescript
const response = await request(app.getHttpServer())
  .post('/api/company/register')
  .send(testCompany);

console.log('Response:', response.body);
expect(response.status).toBe(201);
```

### 2. فحص الـ database بعد الـ test:
```typescript
it('should verify company', async () => {
  // ... test code
  
  const company = await dataSource.getRepository(Company).findOne({ 
    where: { email: testCompany.email } 
  });
  console.log('Company after verification:', company);
});
```

### 3. استخدام `--verbose` flag:
```bash
npm run test:e2e -- --verbose
```

## معالجة الأخطاء الشائعة

### خطأ: "Cannot find module"
```bash
npm install
```

### خطأ: "Connection timeout"
زود الـ timeout في `jest-e2e.json`:
```json
{
  "testTimeout": 60000
}
```

### خطأ: "Port already in use"
تأكد إن الـ application مش شغال على نفس الـ port

## Test Coverage

لعرض test coverage report تفصيلي:
```bash
npm run test:e2e:cov
open coverage/lcov-report/index.html
```

## Next Steps

بعد ما تشغل الـ tests وتتأكد إنها شغالة:

1. أضف tests للـ validation errors (مثلاً: email format, password strength, إلخ)
2. أضف tests للـ edge cases (مثلاً: expired verification codes, concurrent requests)
3. أضف integration tests مع modules تانية (Tasks, Feedback, إلخ)
4. أضف performance tests للـ endpoints
5. أضف security tests (مثلاً: SQL injection, XSS)

---

**ملحوظة:** الـ tests دي غطت جميع الـ endpoints الموجودة في الـ CompanyController.
لو في endpoints تانية أو سيناريوهات محددة عايز تختبرها، قولي وأضيفها! 🚀
