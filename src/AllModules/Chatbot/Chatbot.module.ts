import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ChatbotController } from './Chatbot.controller';
import { ChatbotService } from './Chatbot.service';
import { Worker } from '../../entities/Worker';
import { Company } from '../../entities/Company';
import { Supervisor } from '../../entities/Supervisor';
import { Task } from '../../entities/Task';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Worker, Company, Supervisor, Task]),
  ],
  controllers: [ChatbotController],
  providers:   [ChatbotService],
})
export class ChatbotModule {}