import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  UseGuards,
  Req,
  Put,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseIntPipe,
  Render,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as path from 'path';
import { JwtAuthGuard } from '../../Auth/auth.guards';
import { JwtRegisterAuthGuard } from '../../Auth/auth.guards.register';
import { SupervisorService } from './Supervisor.service';
import { CreateSupervisorDto } from './Dto/CreateSupervisor.dto';
import { VerifyEmailDto } from 'src/Auth/Dto/VerifyEmail.dto';
import { LoginDto } from 'src/Auth/Dto/Login.dto';
import { ForgotPasswordDto } from 'src/Auth/Dto/ForgotPassword.dto';
import { ResetPasswordDto } from 'src/Auth/Dto/ResetPassword.dto';
import { ChangePasswordDto } from 'src/Auth/Dto/ChangePassword.dto';
import { VerifyResetCodeDto } from 'src/Auth/Dto/VerifyReset.dto';
import { DeactivateAccountDto } from 'src/Auth/Dto/DeactivateAccount.dto';
import { updateSupervisorDto } from './Dto/UpdateSupervisor.dto';
import { TaskService } from 'src/AllModules/Task/Task.service';
@Controller('api/supervisor')
export class SupervisorController {
  constructor(private readonly supervisorService: SupervisorService,
    private readonly taskService: TaskService
  ) {}

  @Post('register')
  async registerSupervisor(@Body() dto: CreateSupervisorDto) {
    return this.supervisorService.register(dto);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('verify')
  async verifySupervisor(@Body() dto: VerifyEmailDto, @Req() req: any) {
    return this.supervisorService.verifySupervisor(dto.VERIFICATIONCODE, req.user.sub);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('resend-verification')
  async resendVerification(@Req() req: any) {
    return this.supervisorService.resendVerification(req.user.sub);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.supervisorService.login(dto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.supervisorService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.supervisorService.verifyResetCode(dto);
  }

  @Patch('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.supervisorService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  async changePasswors(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.supervisorService.changePassword(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('deactivate-account')
  async deactivateAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.supervisorService.deactivateAccount(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.supervisorService.deleteAccount(Number(req.user.sub), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.supervisorService.getSupervisorById(Number(req.user.sub));
  }

  @UseGuards(JwtAuthGuard)
  @Patch('edit-profile')
  async editProfile(@Req() req: any, @Body() dto: updateSupervisorDto) {
    return this.supervisorService.editProfile(req.user.sub, dto);
  }

  @Put('profile-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'Uploads', 'Supervisor-Profile'),
        filename: (req, file, callback) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `supervisor-${uniqueSuffix}${extname(file.originalname)}`);
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
    return this.supervisorService.updateProfileImage(Number(req.user.sub), image.path);
  }

  @Get(':taskId/update-link')
    @Render('update-whatsapp') 
    getUpdatePage(@Param('taskId', ParseIntPipe) taskId: number) {
      return { taskId }; 
    }
  
    @Patch(':taskId/whatsapp-link')
    async updateWhatsAppLink(
      @Param('taskId', ParseIntPipe) taskId: number,
      @Body('link') link: string,
    ) {
      return await this.taskService.saveWhatsAppLinkAndNotify(taskId, link);
    }
}
