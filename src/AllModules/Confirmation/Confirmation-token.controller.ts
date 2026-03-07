import { Controller, Get, Param } from '@nestjs/common';
import { ConfirmationResponseService } from './ConfirmationResponse.service';

@Controller('api/confirm')
export class ConfirmationController {
  constructor(private readonly confirmationResponseService: ConfirmationResponseService) {}

  // ───────── YES ─────────
  @Get('YES/:token')
  async confirmYes(@Param('token') token: string) {
    await this.confirmationResponseService.respond(token, true);
    return { message: 'Your attendance has been confirmed ✅' };
  }

  // ───────── NO ─────────
  @Get('NO/:token')
  async confirmNo(@Param('token') token: string) {
    await this.confirmationResponseService.respond(token, false);
    return { message: 'You have declined the task ❌' };
  }
}
