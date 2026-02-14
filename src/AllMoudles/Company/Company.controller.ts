import { 
  Controller, Get, Post, Body, Patch, Delete, 
  UseGuards, Req, Put, UseInterceptors, UploadedFile, 
  BadRequestException 
} from '@nestjs/common';

import { CompanyService } from './Company.service';
import { CreateCompanyDto } from './Dto/create-company.dto'; 
import { MailDTO } from '../../Mail/dto/Mail.dto';
import { LoginCompanyDto } from './Dto/login-company.dto'; 
import { JwtAuthGuard } from '../../Auth/auth.guards';
import { JwtRegisterAuthGuard } from '../../Auth/auth.guards.register';
import { ChangeCompanyPasswordDto } from './Dto/change-company-password.dto'; 
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as path from 'path';
import { ResetCompanyPasswordDto } from './Dto/reset-company-password.dto'; 
import { UpdateCompanyDto } from './Dto/update-company.dto'; 
import { ForgotCompanyPasswordDto } from './Dto/forgot-company-password.dto';
import { VerifyCompanyResetDto } from './Dto/verify-company-reset.dto';

@Controller('api/company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  // 1. عمليات التسجيل والتفعيل
  @Post("/register")
  public registerCompany(@Body() dto: CreateCompanyDto) {
    return this.companyService.register(dto);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('/verify')
  async verify(@Body() dto: MailDTO, @Req() req) {
    return this.companyService.verifyCompany(dto, req.user.sub);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('/resend-verification')
  async resendVerification(@Req() req) {
    return this.companyService.resendVerification(req.user.sub);
  }

  // 2. الدخول
  @Post('/login')
  login(@Body() loginDto: LoginCompanyDto) {
    return this.companyService.login(loginDto);
  }

  // 3. إدارة الملف الشخصي (الشركة لنفسها)
  @UseGuards(JwtAuthGuard)
  @Get('/GetMyData')
  async getOwnData(@Req() req) {
    const companyId = req.user.sub;
    return this.companyService.getCompanyById(companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('edit-profile')
  async editProfile(@Req() req, @Body() updateDto: UpdateCompanyDto) {
    const companyId = req.user.sub; 
    return this.companyService.editProfile(companyId, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/change-password')
  async changePassword(@Req() req, @Body() dto: ChangeCompanyPasswordDto) {
    const companyId = req.user.sub; 
    return this.companyService.changePassword(companyId, dto);
  }

  @Put('/profile-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'Uploads', 'Company-Profile'),
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `company-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 4 * 1024 * 1024 }
    }),
  )
  async uploadProfileImage(@UploadedFile() image: Express.Multer.File, @Req() req: any) {
    if (!image) throw new BadRequestException('Image file is required');
    const companyId = req.user.sub; 
    const updatedCompany = await this.companyService.updateProfileImage(companyId, image.path);
    return { message: 'Company profile image updated successfully!', company: updatedCompany };
  }

  // 4. استعادة كلمة المرور
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotCompanyPasswordDto) {
    return this.companyService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() body: VerifyCompanyResetDto) {
    return this.companyService.verifyResetCode(body.email, body.code);
  }

  @Put('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetCompanyPasswordDto) {
    return this.companyService.resetPassword(resetPasswordDto);
  }

  // 5. الحساب
  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req) {
    const companyId = req.user.sub;
    return this.companyService.deleteAccount(companyId);
  }
}