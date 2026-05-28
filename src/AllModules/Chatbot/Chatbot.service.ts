import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Worker } from '../../entities/Worker';
import { Company } from '../../entities/Company';
import { Supervisor } from '../../entities/Supervisor';
import { Task } from '../../entities/Task';
import { UserRole } from '../../Enums/User.role';
import OpenAI from 'openai';

@Injectable()
export class ChatbotService {
  // تعريف الـ client لـ Groq
  private groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  constructor(
    @InjectRepository(Worker)     private workerRepo:     Repository<Worker>,
    @InjectRepository(Company)    private companyRepo:    Repository<Company>,
    @InjectRepository(Supervisor) private supervisorRepo: Repository<Supervisor>,
    @InjectRepository(Task)       private taskRepo:       Repository<Task>,
    private dataSource: DataSource,
  ) {}

  async chat(
    userId: number,
    role: UserRole,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ) {
    if (!message?.trim()) {
      throw new BadRequestException('Message is required');
    }

    const systemPrompt = this.buildSystemPrompt(userId, role);
    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'getWorkerProfile',
          description: 'Fetches the complete profile details of the worker.',
          parameters: {
            type: 'object',
            properties: { workerId: { type: 'number' } },
            required: ['workerId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getCompanyDashboardStats',
          description: 'Fetches company dashboard statistics.',
          parameters: {
            type: 'object',
            properties: { companyId: { type: 'number' } },
            required: ['companyId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'executeReadOnlyQuery',
          description: 'Executes a read-only SELECT SQL query.',
          parameters: {
            type: 'object',
            properties: { sqlQuery: { type: 'string' } },
            required: ['sqlQuery'],
          },
        },
      },
    ];

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user', content: message }
      ];

      const response = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        tools: tools,
        temperature: 0.1,
      });

      const responseMessage = response.choices[0].message;
      const toolCalls = responseMessage.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        messages.push(responseMessage);

        for (const toolCall of toolCalls) {
          // حل مشكلة الـ Type Narrowing هنا
          if (toolCall.type === 'function') {
            const name = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments || '{}');
            let functionResult: any;

            if (name === 'getWorkerProfile') {
              functionResult = await this.workerRepo.findOne({ where: { id: Number(args.workerId || userId) }, relations: ['level'] });
            } else if (name === 'getCompanyDashboardStats') {
              functionResult = await this.executeCompanyStatsRaw(Number(args.companyId || userId));
            } else if (name === 'executeReadOnlyQuery') {
              functionResult = await this.handleReadOnlySql((args.sqlQuery as string) || '');
            }

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ result: functionResult }),
            });
          }
        }

        const finalResponse = await this.groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: messages,
        });

        return { reply: finalResponse.choices[0].message.content || 'تم تنفيذ الطلب بنجاح.' };
      }

      return { reply: responseMessage.content || 'لم أتمكن من الرد.' };

    } catch (err: any) {
      console.error('Groq Agent Error:', err);
      return { reply: `حدث خطأ: ${err?.message}` };
    }
  }

  private async handleReadOnlySql(query: string): Promise<any> {
    const cleanQuery = query.trim().toUpperCase();
    if (!cleanQuery.startsWith('SELECT') || cleanQuery.includes('DELETE') || cleanQuery.includes('DROP')) {
      return { error: 'غير مسموح بعمليات التعديل.' };
    }
    return await this.dataSource.query(query);
  }

  private async executeCompanyStatsRaw(companyId: number) {
    return await this.taskRepo.createQueryBuilder('task')
      .select('task.status', 'status').addSelect('COUNT(*)', 'count')
      .where('task.companyId = :companyId', { companyId })
      .groupBy('task.status').getRawMany();
  }

  private buildSystemPrompt(currentUserId: number, role: UserRole): string {
    return `أنت "تسكاية الذكي"، مساعد خبير في قاعدة البيانات. 
    المستخدم ID: ${currentUserId}، الرتبة: ${role}. 
    يمنع منعاً باتاً طباعة كود SQL للمستخدم. أجب دائماً بالعربية.`;
  }
}
