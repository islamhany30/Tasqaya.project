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
  Query,
} from '@nestjs/common';

import { AdminService } from './Admin.service';
import { JwtAccountAuthGuard } from '../../Auth/auth.guards.account';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as path from 'path';
import { UpdateAdminDto } from './Dto/UpdateAdmin.dto';
import { ChangeAccountStatusDto } from './Dto/ChangeAccountStatus.dto';
import { AdminAuthGuard } from '../../Auth/Auth.roles';
import { ChangePasswordDto } from 'src/Auth/Dto/ChangePassword.dto';
import { DeactivateAccountDto } from 'src/Auth/Dto/DeactivateAccount.dto';
import { GetTasksFilterDto } from '../Task/Dto/GetTasksFilter.dto';
import { CreateAdminDto } from './Dto/CreateAdmin.dto';
import { VerifyEmailDto } from 'src/Auth/Dto/VerifyEmail.dto';

@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ================= Routes for Admin Account =================

  // @Post('register')
  // async register(@Body() dto: CreateAdminDto) {
  //   return this.adminService.register(dto);
  // }

  // @UseGuards(JwtAccountAuthGuard)
  // @Post('verify')
  // async verify(@Body() dto: VerifyEmailDto, @Req() req) {
  //   return this.adminService.verifyAdmin(dto.VERIFICATIONCODE, req.user.sub);
  // }

  @UseGuards(JwtAccountAuthGuard)
  @Patch('change-password')
  async changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    return this.adminService.changePassword(req.user.sub, dto);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Get('get-all-admins')
  async getAllAdmins() {
    return this.adminService.getAdmins();
  }

  @UseGuards(JwtAccountAuthGuard)
  @Get('get-admin-by-id')
  async getAdminById(@Req() req) {
    return this.adminService.getAdminById(req.user.sub);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Patch('edit-profile')
  async editProfile(@Req() req, @Body() updateDto: UpdateAdminDto) {
    return this.adminService.editProfile(req.user.sub, updateDto);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req, @Body() dto: DeactivateAccountDto) {
    return this.adminService.deleteAccount(req.user.sub, dto);
  }

  @Put('upload-profile-image')
  @UseGuards(JwtAccountAuthGuard)
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

  // ================= Routes restricted to Admin Role =================
  @UseGuards(AdminAuthGuard)
  @Patch('manage/company/:id/status')
  async changeCompanyStatus(@Param('id', ParseIntPipe) id: number, @Body() statusDto: ChangeAccountStatusDto) {
    return this.adminService.changeCompanyStatus(id, statusDto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('manage/companies')
  async getAllCompanies() {
    return this.adminService.getAllCompaniesForAdmin();
  }

  @UseGuards(AdminAuthGuard)
  @Get('manage/company/:id')
  async getCompanyById(@Param('id', ParseIntPipe) companyId: number) {
    return this.adminService.getCompanyById(companyId);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('manage/supervisor/:id/status')
  async changeSupervisorStatus(@Param('id', ParseIntPipe) id: number, @Body() statusDto: ChangeAccountStatusDto) {
    return this.adminService.changeSupervisorStatus(id, statusDto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('manage/supervisors')
  async getAllSupervisors() {
    return this.adminService.getAllSupervisors();
  }

  @UseGuards(AdminAuthGuard)
  @Get('manage/supervisor/:id')
  async getSupervisorById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getSupervisorById(id);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('manage/worker/:id/status')
  async changeWorkerStatus(@Param('id', ParseIntPipe) id: number, @Body() statusDto: ChangeAccountStatusDto) {
    return this.adminService.changeWorkerStatus(id, statusDto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('manage/worker/:id')
  async getWorkerById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getWorkerByID(id);
  }

  @UseGuards(AdminAuthGuard)
  @Get('manage/workers')
  async getAllWorkers() {
    return this.adminService.getAllWorkers();
  }

  @UseGuards(AdminAuthGuard)
  @Get('manage/tasks')
  async getAllTasks(@Query() filters: GetTasksFilterDto) {
    return this.adminService.getAllTasksForAdmin(filters);
  }

  @UseGuards(AdminAuthGuard)
  @Get('manage/tasks/:taskId')
  async getTaskDetails(@Param('id', ParseIntPipe) taskId: number) {
    return this.adminService.getTaskDetailsForAdmin(taskId);
  }

  @UseGuards(AdminAuthGuard)
  @Get('manage/job-posts/:jobPostId/applicants')
  async getJobPostApplicants(@Param('id', ParseIntPipe) jobPostId: number) {
    return this.adminService.getJobPostApplicantsForAdmin(jobPostId);
  }
}
