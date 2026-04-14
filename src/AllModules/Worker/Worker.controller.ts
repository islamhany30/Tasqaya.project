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
// import { JwtRegisterAuthGuard } from 'src/Auth/auth.guards.register';
import { VerifyEmailDto } from 'src/Auth/Dto/VerifyEmail.dto';
import { JwtAccountAuthGuard } from 'src/Auth/auth.guards.account';
import { DeactivateAccountDto } from 'src/Auth/Dto/DeactivateAccount.dto';
import { ChangePasswordDto } from 'src/Auth/Dto/ChangePassword.dto';
import { UpdateWorkerDto } from './Dto/UpdateWorker.dto';
import { PaginationDto } from './Dto/PaginationDto';
import { GetWorkerJobsQueryDto } from './Dto/GetWorkerJobsQueryDto';
import { CreateApplicationDto } from './Dto/CreateApplicationDto';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as path from 'path';;

@Controller('api/worker')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post('register')
  async registerWorker(@Body() dto: CreateWorkerDto) {
    return this.workerService.register(dto);
  }

  @Post('verify')
  @UseGuards(JwtAccountAuthGuard)
  async verify(@Body() dto: VerifyEmailDto, @Req() req: any) {
    return this.workerService.verifyWorker(dto.VERIFICATIONCODE, req.user.sub);
  }

  @Post('resend-verification')
  @UseGuards(JwtAccountAuthGuard)
  async resendVerification(@Req() req: any) {
    return this.workerService.resendVerification(req.user.sub);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Patch('change-password')
  async changePasswors(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.workerService.changePassword(req.user.sub, dto);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Patch('deactivate-account')
  async deactivateAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.workerService.deactivateAccount(req.user.sub, dto);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.workerService.deleteAccount(Number(req.user.sub), dto);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.workerService.getWorkerById(req.user.sub);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Patch('edit-profile')
  async editProfile(@Req() req: any, @Body() dto: UpdateWorkerDto) {
    return this.workerService.editProfile(req.user.sub, dto);
  }

  @Put('profile-image')
@UseGuards(JwtAccountAuthGuard)
@UseInterceptors(
  FileInterceptor('image', {
    // شلنا diskStorage خالص عشان ميسيفش محلي ويطلب ريستارت
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
  
  // بنبعت الـ image object كامل (اللي جواه الـ buffer) مش الـ path
  return this.workerService.updateProfileImage(Number(req.user.sub), image);
}
  // ==================== JOB BROWSING ENDPOINTS ====================

  @UseGuards(JwtAccountAuthGuard)
  @Get('job-posts')
  async getAvailableJobs(@Query() query: GetWorkerJobsQueryDto, @Req() req: any) {
    return this.workerService.getAvailableJobs(req.user.sub, query);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Post('apply')
  async applyForJob(@Body() dto: CreateApplicationDto, @Req() req: any) {
    return this.workerService.applyForJob(req.user.sub, dto);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Get('applications')
  async getMyApplications(@Query() query: PaginationDto, @Req() req: any) {
    return this.workerService.getMyApplications(req.user.sub, query);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Delete('applications/:applicationId')
  async withdrawApplication(@Param('applicationId', ParseIntPipe) applicationId: number, @Req() req: any) {
    return this.workerService.withdrawApplication(applicationId, req.user.sub);
  }
}
