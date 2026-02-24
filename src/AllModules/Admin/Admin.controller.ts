import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Put,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';

import { AdminService } from './Admin.service';
import { JwtAuthGuard } from '../../Auth/auth.guards';
import { JwtRegisterAuthGuard } from '../../Auth/auth.guards.register';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as path from 'path';

import { CreateAdminDto } from './Dto/CreateAdminDto';
import { LoginDto } from '../../Auth/Dto/Login.dto';
import { UpdateAdminDto } from './Dto/UpdateAdminDto';
import { ChangeCompanyStatusDto } from '../Company/Dto/change-company-status.dto';

import { AdminAuthGuard } from '../../Auth/Auth.roles';
import { VerifyEmailDto } from 'src/Auth/Dto/VerifyEmail.dto';
import { ChangePasswordDto } from 'src/Auth/Dto/ChangePassword.dto';
import { ForgotPasswordDto } from 'src/Auth/Dto/ForgotPassword.dto';
import { VerifyResetCodeDto } from 'src/Auth/Dto/VerifyReset.dto';
import { ResetPasswordDto } from 'src/Auth/Dto/ResetPassword.dto';

@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('register')
  public registerAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.register(dto);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('verify')
  async verify(@Body() dto: VerifyEmailDto, @Req() req) {
    console.log('zzzzzzzzzzzzzzzz');
    return this.adminService.verifyAdmin(dto.VERIFICATIONCODE, req.user.sub);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('resend-verification')
  async resendVerification(@Req() req) {
    return this.adminService.resendVerification(req.user.sub);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.adminService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  async changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    return this.adminService.changePassword(req.user.sub, dto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.adminService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.adminService.verifyResetCode(dto);
  }

  @Patch('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.adminService.resetPassword(resetPasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('get-admin-by-id')
  async getAdminById(@Req() req) {
    return this.adminService.getAdminById(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('edit-profile')
  async editProfile(@Req() req, @Body() updateDto: UpdateAdminDto) {
    return this.adminService.editProfile(req.user.sub, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req) {
    return this.adminService.deleteAccount(req.user.sub);
  }

  @Put('upload-profile-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'Uploads', 'Admin-Profile'),
        filename: (req, file, callback) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `admin-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return callback(new BadRequestException('Only jpg, jpeg, png files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
    }),
  )
  async uploadProfileImage(@UploadedFile() image: Express.Multer.File, @Req() req: any) {
    if (!image) throw new BadRequestException('Image file is required');
    return this.adminService.updateProfileImage(Number(req.user.sub), image.path);
  }

  // @UseGuards(AdminAuthGuard)
  // @Get('manage/company/:id')
  // async getCompanyByAdmin(@Param('id', ParseIntPipe) companyId: number) {
  //   return this.adminService.getCompanyDataForAdmin(companyId);
  // }

  // @UseGuards(AdminAuthGuard)
  // @Patch('manage/company/:id/status')
  // async changeStatus(@Param('id', ParseIntPipe) id: number, @Body() statusDto: ChangeCompanyStatusDto) {
  //   return this.adminService.changeCompanyStatus(id, statusDto);
  // }

  // @UseGuards(AdminAuthGuard)
  // @Get('manage/companies')
  // async getAllCompanies() {
  //   return this.adminService.getAllCompaniesForAdmin();
  // }
}
