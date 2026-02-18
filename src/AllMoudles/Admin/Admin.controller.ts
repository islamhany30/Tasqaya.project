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
import { MailDTO } from '../../Mail/dto/Mail.dto';
import { JwtAuthGuard } from '../../Auth/auth.guards';
import { JwtRegisterAuthGuard } from '../../Auth/auth.guards.register';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as path from 'path';

import { CreateAdminDto } from './Dto/CreateAdminDto';
import { LoginAdminDto } from './Dto/LoginAdminDto';
import { UpdateAdminDto } from './Dto/UpdateAdminDto';
import { ChangeAdminPasswordDto } from './Dto/ChangeAdminPasswordDto';
import { ForgotAdminPasswordDto } from './Dto/ForgotAdminPasswordDto';
import { ResetAdminPasswordDto } from './Dto/ResetAdminPasswordDto';
import { VerifyAdminResetDto } from './Dto/VerifyAdminResetDto';
import { ChangeCompanyStatusDto } from '../Company/Dto/change-company-status.dto';

import { AdminAuthGuard } from '../../Auth/Auth.roles';

@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('register')
  public registerAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.register(dto);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('verify')
  async verify(@Body() dto: MailDTO, @Req() req) {
    return this.adminService.verifyAdmin(dto, req.user.sub);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('resend-verification')
  async resendVerification(@Req() req) {
    return this.adminService.resendVerification(req.user.sub);
  }

  @Post('login')
  login(@Body() loginDto: LoginAdminDto) {
    return this.adminService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  async changePassword(@Req() req, @Body() dto: ChangeAdminPasswordDto) {
    const adminId = req.user.sub;
    return this.adminService.changePassword(adminId, dto);
  }

  @Put('profile-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'Uploads', 'Admin-Profile'),
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `admin-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 4 * 1024 * 1024, // 4MB
      },
    }),
  )
  async uploadProfileImage(@UploadedFile() image: Express.Multer.File, @Req() req: any) {
    if (!image) {
      throw new BadRequestException('Image file is required');
    }

    const adminId = req.user.sub;
    const imagePath = image.path;

    const updatedAdmin = await this.adminService.updateProfileImage(adminId, imagePath);

    return {
      message: 'Admin profile image updated successfully!',
      admin: updatedAdmin,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('GetMyData')
  async getOwnData(@Req() req) {
    const adminId = req.user.sub;
    return this.adminService.getAdminById(adminId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/GetAdminData')
  async getAdminData(@Param('id', ParseIntPipe) adminId: number) {
    return this.adminService.getAdminById(adminId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('edit-profile')
  async editProfile(@Req() req, @Body() updateDto: UpdateAdminDto) {
    const adminId = req.user.sub;
    return this.adminService.editProfile(adminId, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req) {
    const adminId = req.user.sub;
    return this.adminService.deleteAccount(adminId);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotAdminPasswordDto) {
    return this.adminService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() dto: VerifyAdminResetDto) {
    return this.adminService.verifyResetCode(dto);
  }

  @Put('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetAdminPasswordDto) {
    return this.adminService.resetPassword(resetPasswordDto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('manage/company/:id')
  async getCompanyByAdmin(@Param('id', ParseIntPipe) companyId: number) {
    return this.adminService.getCompanyDataForAdmin(companyId);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('manage/company/:id/status')
  async changeStatus(@Param('id', ParseIntPipe) id: number, @Body() statusDto: ChangeCompanyStatusDto) {
    return this.adminService.changeCompanyStatus(id, statusDto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('manage/companies')
  async getAllCompanies() {
    return this.adminService.getAllCompaniesForAdmin();
  }
}
