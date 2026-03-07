import {
  Controller,
  Body,
  Req,
  Post,
  Patch,
  Delete,
  Put,
  Get,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  UploadedFile,
  Query,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { WorkerService } from './Worker.service';
import { CreateWorkerDto } from './Dto/CreateWorker.dto';
import { JwtRegisterAuthGuard } from 'src/Auth/auth.guards.register';
import { VerifyEmailDto } from 'src/Auth/Dto/VerifyEmail.dto';
import { JwtAuthGuard } from 'src/Auth/auth.guards';
import { LoginDto } from 'src/Auth/Dto/Login.dto';
import { ForgotPasswordDto } from 'src/Auth/Dto/ForgotPassword.dto';
import { VerifyResetCodeDto } from 'src/Auth/Dto/VerifyReset.dto';
import { ResetPasswordDto } from 'src/Auth/Dto/ResetPassword.dto';
import { DeactivateAccountDto } from 'src/Auth/Dto/DeactivateAccount.dto';
import { ChangePasswordDto } from 'src/Auth/Dto/ChangePassword.dto';
import { UpdateWorkerDto } from './Dto/UpdateWorker.dto';
import { PaginationDto } from './Dto/PaginationDto';
import { GetWorkerJobsQueryDto } from './Dto/GetWorkerJobsQueryDto';
import { CreateApplicationDto } from './Dto/CreateApplicationDto';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as path from 'path';

@Controller('api/worker')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post('register')
  async registerWorker(@Body() dto: CreateWorkerDto) {
    return this.workerService.register(dto);
  }

  @Post('verify')
  @UseGuards(JwtRegisterAuthGuard)
  async verify(@Body() dto: VerifyEmailDto, @Req() req: any) {
    return this.workerService.verifyWorker(dto.VERIFICATIONCODE, req.user.sub);
  }

  @Post('resend-verification')
  @UseGuards(JwtRegisterAuthGuard)
  async resendVerification(@Req() req: any) {
    return this.workerService.resendVerification(req.user.sub);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.workerService.login(dto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.workerService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.workerService.verifyResetCode(dto);
  }

  @Patch('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.workerService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  async changePasswors(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.workerService.changePassword(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('deactivate-account')
  async deactivateAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.workerService.deactivateAccount(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.workerService.deleteAccount(Number(req.user.sub), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.workerService.getWorkerById(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('edit-profile')
  async editProfile(@Req() req: any, @Body() dto: UpdateWorkerDto) {
    return this.workerService.editProfile(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'Uploads', 'Worker-Profile'),
        filename: (req, file, callback) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `worker-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return callback(new BadRequestException('Only jpg, jpeg, png files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  async uploadProfileImage(@UploadedFile() image: Express.Multer.File, @Req() req: any) {
    if (!image) throw new BadRequestException('Image file is required');
    return this.workerService.uploadProfileImage(Number(req.user.sub), image.path);
  }

  // ==================== JOB BROWSING ENDPOINTS ====================

  @UseGuards(JwtAuthGuard)
  @Get('job-posts')
  async getAvailableJobs(@Query() query: GetWorkerJobsQueryDto, @Req() req: any) {
    return this.workerService.getAvailableJobs(req.user.sub, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('apply')
  async applyForJob(@Body() dto: CreateApplicationDto, @Req() req: any) {
    return this.workerService.applyForJob(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('applications')
  async getMyApplications(@Query() query: PaginationDto, @Req() req: any) {
    return this.workerService.getMyApplications(req.user.sub, query);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('applications/:applicationId')
  async withdrawApplication(@Param('applicationId', ParseIntPipe) applicationId: number, @Req() req: any) {
    return this.workerService.withdrawApplication(applicationId, req.user.sub);
  }
}
