import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';

import { CompanyService } from './Company.service';
import { JwtAuthGuard } from '../../Auth/auth.guards';
import { JwtRegisterAuthGuard } from '../../Auth/auth.guards.register';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as path from 'path';

import { MailDTO } from '../../Mail/dto/Mail.dto';
import { CreateCompanyDto } from './Dto/CreateCompany.dto';
import { UpdateCompanyDto } from './Dto/UpdateCompany.dto';
import { VerifyEmailDto } from 'src/Auth/Dto/VerifyEmail.dto';
import { LoginDto } from 'src/Auth/Dto/Login.dto';
import { ResetPasswordDto } from 'src/Auth/Dto/ResetPassword.dto';
import { ForgotPasswordDto } from 'src/Auth/Dto/ForgotPassword.dto';
import { VerifyResetCodeDto } from 'src/Auth/Dto/VerifyReset.dto';
import { ChangePasswordDto } from 'src/Auth/Dto/ChangePassword.dto';
import { DeactivateAccountDto } from 'src/Auth/Dto/DeactivateAccount.dto';

@Controller('api/company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post('register')
  public registerCompany(@Body() dto: CreateCompanyDto) {
    return this.companyService.register(dto);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('verify')
  async verify(@Body() dto: VerifyEmailDto, @Req() req) {
    return this.companyService.verifyCompany(dto.VERIFICATIONCODE, req.user.sub);
  }

  @UseGuards(JwtRegisterAuthGuard)
  @Post('resend-verification')
  async resendVerification(@Req() req) {
    return this.companyService.resendVerification(req.user.sub);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.companyService.login(dto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.companyService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.companyService.verifyResetCode(dto);
  }

  @Patch('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.companyService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req) {
    return this.companyService.changePassword(req.user.sub, dto);
  }

  @Put('profile-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'Uploads', 'Company-Profile'),
        filename: (req, file, callback) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `company-${uniqueSuffix}${extname(file.originalname)}`);
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
    return this.companyService.updateProfileImage(Number(req.user.sub), image.path);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.companyService.getCompanyById(Number(req.user.sub));
  }

  @UseGuards(JwtAuthGuard)
  @Patch('edit-profile')
  async editProfile(@Req() req: any, @Body() updateDto: UpdateCompanyDto) {
    return this.companyService.editProfile(req.user.sub, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('deactivate-account')
  async deactivateAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.companyService.deactivateAccount(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.companyService.deleteAccount(req.user.sub, dto);
  }
}
