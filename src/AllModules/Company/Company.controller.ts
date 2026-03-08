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
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import * as path from 'path';
import { CreateCompanyDto } from './Dto/CreateCompany.dto';
import { UpdateCompanyDto } from './Dto/UpdateCompany.dto';
import { VerifyEmailDto } from '../../Auth/Dto/VerifyEmail.dto';
import { ChangePasswordDto } from '../../Auth/Dto/ChangePassword.dto';
import { DeactivateAccountDto } from '../../Auth/Dto/DeactivateAccount.dto';
import { TaskService } from '../Task/Task.service';
import { PaymentService } from '../Payment/Payment.service';
import { TaskStatusEnum } from '../../Enums/task-status.enum';
import { CreateTaskDto } from '../Task/Dto/Create.task.dto';
import { UpdateTaskDto } from '../Task/Dto/Update.task.dto';
import { PayInvoiceDto } from './Dto/PayInvoice.dto';
import { CreateFeedbackDto } from './Dto/create-feedback.dto';
import { JwtAccountAuthGuard } from 'src/Auth/auth.guards.account';
import { AdminAuthGuard } from '../../Auth/Auth.roles';

@Controller('api/company')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly taskService: TaskService,
    private readonly paymentService: PaymentService,
  ) {}

  // ─────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────

  @Post('register')
  public registerCompany(@Body() dto: CreateCompanyDto) {
    return this.companyService.register(dto);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Post('verify')
  async verify(@Body() dto: VerifyEmailDto, @Req() req) {
    return this.companyService.verifyCompany(dto.VERIFICATIONCODE, req.user.sub);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Post('resend-verification')
  async resendVerification(@Req() req) {
    return this.companyService.resendVerification(req.user.sub);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Patch('change-password')
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req) {
    return this.companyService.changePassword(req.user.sub, dto);
  }

  // ─────────────────────────────────────────────
  // PROFILE
  // ─────────────────────────────────────────────

  @Put('profile-image')
  @UseGuards(JwtAccountAuthGuard)
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

  @UseGuards(JwtAccountAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.companyService.getCompanyById(Number(req.user.sub));
  }

  @UseGuards(JwtAccountAuthGuard)
  @Patch('edit-profile')
  async editProfile(@Req() req: any, @Body() updateDto: UpdateCompanyDto) {
    return this.companyService.editProfile(req.user.sub, updateDto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('deactivate-account')
  async deactivateAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.companyService.deactivateAccount(req.user.sub, dto);
  }

  @UseGuards(JwtAccountAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req: any, @Body() dto: DeactivateAccountDto) {
    return this.companyService.deleteAccount(req.user.sub, dto);
  }

  // ─────────────────────────────────────────────
  // TASKS
  // ─────────────────────────────────────────────

  @Post('create-task')
  @UseGuards(JwtAccountAuthGuard)
  async create(@Body() createTaskDto: CreateTaskDto, @Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.createTaskByCompany(createTaskDto, companyId);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAccountAuthGuard)
  async approve(@Param('id', ParseIntPipe) id: number, @Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.approveTaskByCompany(id, companyId);
  }

  @Get('my-tasks')
  @UseGuards(JwtAccountAuthGuard)
  async getMyTasks(@Req() req) {
    const companyId = req.user.sub;
    const tasks = await this.taskService.getCompanyApprovedTasks(companyId);
    return { count: tasks.length, tasks };
  }

  // BUG FIX 1: كانت متعرفة مرتين — اتشالت النسخة التانية (getPendingTasks) وفضلت الأولى بس
  @Get('tasks/pending')
  @UseGuards(JwtAccountAuthGuard)
  async getPending(@Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.getCompanyTasksByStatus(companyId, TaskStatusEnum.PENDING);
  }

  @Get('tasks/in-progress')
  @UseGuards(JwtAccountAuthGuard)
  async getInProgress(@Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.getCompanyTasksByStatus(companyId, TaskStatusEnum.IN_PROGRESS);
  }

  @Get('tasks/completed')
  @UseGuards(JwtAccountAuthGuard)
  async getCompleted(@Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.getCompanyTasksByStatus(companyId, TaskStatusEnum.COMPLETED);
  }

  @Get('tasks/:taskId')
  @UseGuards(JwtAccountAuthGuard)
  async getTaskDetails(@Param('taskId', ParseIntPipe) taskId: number, @Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.getTaskDetailsForCompany(taskId, companyId);
  }

  @Patch('update/:taskId')
  @UseGuards(JwtAccountAuthGuard)
  async update(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTaskDto,
    @Req() req,
  ) {
    const companyId = req.user.sub;
    return await this.taskService.updateTask(taskId, companyId, dto);
  }

  // BUG FIX 2: كان ناقصه @UseGuards(JwtAuthGuard) — اتضاف
  @Delete('delete-task/:taskId')
  @UseGuards(JwtAccountAuthGuard)
  async delete(@Param('taskId', ParseIntPipe) taskId: number, @Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.deleteTaskByCompany(taskId, companyId);
  }

  @Get(':taskId/confirmed-workers')
  @UseGuards(JwtAccountAuthGuard)
  async getConfirmedWorkersForTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() req,
  ) {
    const companyId = req.user.sub;
    return await this.taskService.getConfirmedWorkers(taskId, companyId);
  }

  // ─────────────────────────────────────────────
  // PAYMENTS
  // ─────────────────────────────────────────────

  // BUG FIX 3: كان '/payments' بـ leading slash — اتشال الـ slash
  @Get('payments')
  @UseGuards(JwtAccountAuthGuard)
  async getMyInvoices(@Req() req: any) {
    const companyId = req.user.sub;
    return await this.paymentService.getCompanyInvoices(companyId);
  }

  @Get('payments/:paymentId')
  @UseGuards(JwtAccountAuthGuard)
  async getInvoiceDetails(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Req() req,
  ) {
    const companyId = req.user.sub;
    return await this.paymentService.getCompanyInvoiceDetails(paymentId, companyId);
  }

  @Post('payments/:paymentId/pay')
  @UseGuards(JwtAccountAuthGuard)
  async payInvoice(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() body: PayInvoiceDto,
    @Req() req,
  ) {
    const companyId = req.user.sub;
    return await this.paymentService.initiatePayment(paymentId, companyId, body.method);
  }

  // ─────────────────────────────────────────────
  // FEEDBACK
  // ─────────────────────────────────────────────

  @Post(':taskId/feedback')
  @UseGuards(JwtAccountAuthGuard)
  async submitFeedback(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateFeedbackDto,
    @Req() req,
  ) {
    const companyId = req.user.sub;
    return await this.taskService.submitTaskFeedback(taskId, dto, companyId);
  }

  @Get('feedback')
  @UseGuards(JwtAccountAuthGuard)
  async getMyFeedbacks(@Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.getCompanyFeedbacks(companyId);
  }

  // ─────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────

  @Get('dashboard/stats')
  @UseGuards(JwtAccountAuthGuard)
  async getDashboardStats(@Req() req) {
    const companyId = req.user.sub;
    return await this.taskService.getCompanyDashboardStats(companyId);
  }
}