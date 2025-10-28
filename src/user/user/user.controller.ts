import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Put, UseInterceptors, UploadedFile, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { MailDTO } from 'src/Mail/dto/Mail.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from 'src/Auth/auth.guards';
import { ChangePasswordDto } from './dto/Changepassword.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as path from 'path';
import { ChangeStatusDto } from './dto/Activation.dto';
import { AdminAuthGuard } from 'src/Auth/Auth.roles';
import { ResetPasswordDto } from './dto/Resetpassword.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangeRoleDto } from './dto/New.role.dto';
import { forgotPasswordDto } from './dto/Forgot.password.dto';
import { verifyresetpassDto } from './dto/Verifyresespass.dto';



@Controller('api/ecommerce')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post("/register")
  public createaccount(@Body() dto:CreateUserDto)
  {
    return this.userService.register(dto);
  }

  @Post('/verify')
  async verify(@Body() dto: MailDTO) {
    return this.userService.verifyUser(dto);
  }

  @Post('/resend-verification')
  async resendVerification(@Body('email') email: string) {
    return this.userService.resendVerification(email);
  }


  @Post('/login')
  login(@Body() loginDto: LoginDto) {
    return this.userService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/change-password')
  async changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    const userId = req.user.id;
    return this.userService.changePassword(userId, dto);
  }

  @Put('/profile-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'Uploads', 'Profile-Pictures'),
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `user-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
        limits: {
        fileSize: 4 * 1024 * 1024, 
        }
    }),
  )
  async uploadProfileImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ) {
    const userId = req.user.id; 
    const imagePath = file.path;

    const updatedUser = await this.userService.updateProfileImage(userId, imagePath);

    return {
      message: 'Profile image updated successfully!',
      user: updatedUser,
    };
  }

  @UseGuards(AdminAuthGuard)
  @Patch(':id/status')
  async changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() active: ChangeStatusDto,
  ) {
    return this.userService.changeAccountStatus(id, active);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/GetMyData')
  async getOwnData(@Req() request: Request) {
    const userId = request['user'].sub;
    return this.userService.getUserById(userId);
  }

  @UseGuards(AdminAuthGuard)
  @Get(':id/GetUserData')
  async getUserByAdmin(@Param('id', ParseIntPipe) userId: number) {
    return this.userService.getUserById(userId);
  }



  @UseGuards(JwtAuthGuard)
  @Get('logout')
  async logout() {
    return this.userService.logout();
  }

  @Post('forgot-password')
  async forgotPassword(@Body() email: forgotPasswordDto) {
    return this.userService.forgotPassword(email);
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() body:verifyresetpassDto) {
    return this.userService.verifyResetCode(body.email, body.code);
  }

  @Put('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.userService.resetPassword(resetPasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() request: Request) {
    const userId = request['user'].sub;
    return this.userService.deleteAccount(userId);
  }

  @UseGuards(AdminAuthGuard)
  @Delete('/:id/delete-account')
  async deleteAccountbyAdmin(@Param('id', ParseIntPipe) userId: number) {
    const result = await this.userService.deleteAccount(userId);
    return { ...result, deletedBy: 'admin' };
  }



  @UseGuards(JwtAuthGuard)
  @Put('edit-profile')
  async editProfile(@Req() request: Request, @Body() updateUserDto: UpdateUserDto) {
    const userId = request['user'].sub; 
    return this.userService.editProfile(userId, updateUserDto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch(':id/change-role')
  async changeUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ChangeRoleDto,
  ) {
    return this.userService.changeUserRole(id, body);
  }

}



