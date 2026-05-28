import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ChatbotService } from './Chatbot.service';
import { ChatMessageDto } from './ChatMessage.dto';
import { JwtAccountAuthGuard } from '../../Auth/auth.guards.account';
import { UserRole } from '../../Enums/User.role';

@Controller('api/chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  // ════════════════════════════════════════════════════════
  // POST /api/chatbot/message
  // Works for ALL roles: COMPANY, WORKER, SUPERVISOR, ADMIN
  // ════════════════════════════════════════════════════════
  @Post('message')
  @UseGuards(JwtAccountAuthGuard)
  async chat(@Body() dto: ChatMessageDto, @Req() req: any) {
    const userId: number = req.user.sub;
    const role:   UserRole = req.user.role;

    return await this.chatbotService.chat(
      userId,
      role,
      dto.message,
      dto.history || [],
    );
  }
}