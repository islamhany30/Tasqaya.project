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
  ParseIntPipe,
  Param,
} from '@nestjs/common';

import { CompanyService } from './Company.service';
import { JwtAuthGuard } from '../../Auth/auth.guards';
import { JwtRegisterAuthGuard } from '../../Auth/auth.guards.register';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as path from 'path';
import { CreateCompanyDto } from './Dto/CreateCompany.dto';
import { UpdateCompanyDto } from './Dto/UpdateCompany.dto';
import { VerifyEmailDto } from '../../Auth/Dto/VerifyEmail.dto';
import { LoginDto } from '../../Auth/Dto/Login.dto';
import { ResetPasswordDto } from '../../Auth/Dto/ResetPassword.dto';
import { ForgotPasswordDto } from '../../Auth/Dto/ForgotPassword.dto';
import { VerifyResetCodeDto } from '../../Auth/Dto/VerifyReset.dto';
import { ChangePasswordDto } from '../../Auth/Dto/ChangePassword.dto';
import { DeactivateAccountDto } from '../../Auth/Dto/DeactivateAccount.dto';
import { TaskService } from '../Task/Task.service';
import { PaymentService } from '../Payment/Payment.service';
import { TaskStatusEnum } from '../../Enums/task-status.enum';
import { CreateTaskDto } from '../Task/Dto/Create.task.dto';
import { UpdateTaskDto } from '../Task/Dto/Update.task.dto';
import { PayInvoiceDto } from './Dto/PayInvoice.dto';
import { CreateFeedbackDto } from './Dto/create-feedback.dto';

@Controller('api/company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService,
        private readonly taskService: TaskService,  
        private readonly paymentService: PaymentService
  ) {}

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

  @Post("create-task")
    @UseGuards(JwtAuthGuard)
    async create(@Body() createTaskDto: CreateTaskDto, @Req() req) {
      const companyId = req.user.sub;     
      return await this.taskService.createTaskByCompany(createTaskDto, companyId);
    }
  
    @Patch(':id/approve')
    @UseGuards(JwtAuthGuard)
    async approve(
      @Param('id', ParseIntPipe) id: number, 
      @Req() req
    ) {
      const companyId = req.user.sub;
      
      return await this.taskService.approveTaskByCompany(id, companyId);
      
    }
  
  @Get('my-tasks')
  @UseGuards(JwtAuthGuard)
  async getMyTasks(@Req() req) {
    const companyId = req.user.sub; 
    const tasks = await this.taskService.getCompanyApprovedTasks(companyId);
    return {
      count: tasks.length,
      tasks: tasks
    };
  }
  
  @Get('tasks/pending')
  @UseGuards(JwtAuthGuard)
  async getPending(@Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.getCompanyTasksByStatus(companyId, TaskStatusEnum.PENDING);
  }
  
  @Get('tasks/in-progress')
  @UseGuards(JwtAuthGuard)
  async getInProgress(@Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.getCompanyTasksByStatus(companyId, TaskStatusEnum.IN_PROGRESS);
  }
  
  @Get('tasks/completed')
  @UseGuards(JwtAuthGuard)
  async getCompleted(@Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.getCompanyTasksByStatus(companyId, TaskStatusEnum.COMPLETED);
  }
  
  
  @Get('tasks/:taskId')
  @UseGuards(JwtAuthGuard) 
  async getTaskDetails(
    @Param('taskId', ParseIntPipe) taskId: number, 
    @Req() req,
  ) {
    const companyId = req.user.sub;
  
    return await this.taskService.getTaskDetailsForCompany(taskId, companyId);
  }
  
  @Patch('update/:taskId')
  @UseGuards(JwtAuthGuard) 
  async update(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTaskDto,
    @Req() req,
  ) {
      const companyId = req.user.sub;
      return await this.taskService.updateTask(taskId, companyId, dto);
    }
  
  @Delete('delete-task/:taskId')
    async delete(
      @Param('taskId', ParseIntPipe) taskId: number,
      @Req() req,
    ) {
      const companyId = req.user.sub;
      return await this.taskService.deleteTaskByCompany(taskId, companyId);
    }
  
    @Get('/payments')
    @UseGuards(JwtAuthGuard) 
    async getMyInvoices(@Req() req: any) {
      const companyId = req.user.sub; 
      return await this.paymentService.getCompanyInvoices(companyId);
    }
  
    @Get('payments/:paymentId')
    @UseGuards(JwtAuthGuard) 
    async getInvoiceDetails(
      @Param('paymentId', ParseIntPipe) paymentId: number,
      @Req() req,
    ) {
      const companyId = req.user.sub; 
      return await this.paymentService.getCompanyInvoiceDetails(paymentId, companyId);
    }
  
   @Post('payments/:paymentId/pay')
    @UseGuards(JwtAuthGuard)
    async payInvoice(
      @Param('paymentId', ParseIntPipe) paymentId: number,
      @Body() body: PayInvoiceDto,
      @Req() req,
    ) {
      const companyId = req.user.sub;
  
      return await this.paymentService.initiatePayment(
        paymentId,
        companyId,
        body.method
      );
    }
  
  @Post(':taskId/feedback')
  @UseGuards(JwtAuthGuard)
  async submitFeedback(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateFeedbackDto,
    @Req() req
  ) {
    const companyId = req.user.sub;
    return await this.taskService.submitTaskFeedback(taskId, dto, companyId);
  }
  
    @Get('feedback')
    @UseGuards(JwtAuthGuard)
    async getMyFeedbacks(@Req() req) {
      const companyId = req.user.sub;
      return await this.taskService.getCompanyFeedbacks(companyId);
    }
  
    @Get('tasks/pending')
    @UseGuards(JwtAuthGuard)
    async getPendingTasks(@Req() req) {
      const companyId = req.user.sub;
      const tasks = await this.taskService.getPendingCompanyTasks(companyId);
      
      return {
        count: tasks.length,
        tasks: tasks
      };
    }
  
    @Get('dashboard/stats')
    @UseGuards(JwtAuthGuard)
    async getDashboardStats(@Req() req) {
      const companyId = req.user.sub;
      return await this.taskService.getCompanyDashboardStats(companyId);
    }
  
  
  @Get(':taskId/confirmed-workers')
  @UseGuards(JwtAuthGuard)
  async getConfirmedWorkersForTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() req, 
  ) {
    const companyId = req.user.sub; 
    return await this.taskService.getConfirmedWorkers(taskId, companyId);
  }
}
