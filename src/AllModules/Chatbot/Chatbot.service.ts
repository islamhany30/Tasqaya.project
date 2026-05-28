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
  // تعريف الـ client لـ Groq باستخدام OpenAI SDK المتوافق تماماً
  private groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1', // توجيه الـ SDK لسيرفرات Groq الصاروخية
  });

  constructor(
    @InjectRepository(Worker)     private workerRepo:     Repository<Worker>,
    @InjectRepository(Company)    private companyRepo:    Repository<Company>,
    @InjectRepository(Supervisor) private supervisorRepo: Repository<Supervisor>,
    @InjectRepository(Task)       private taskRepo:       Repository<Task>,
    private dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════
  // MAIN CHAT METHOD WITH GROQ AGENT LOOP
  // ═══════════════════════════════════════════════
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

    // تجهيز الـ Tools بتنسيق JSON Schema المتوافق مع OpenAI/Groq
    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'getWorkerProfile',
          description: 'Fetches the complete profile details of the currently logged-in worker.',
          parameters: {
            type: 'object',
            properties: { workerId: { type: 'number', description: 'The ID of the worker' } },
            required: ['workerId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getCompanyDashboardStats',
          description: 'Fetches dashboard analytics for a company including task counts by status.',
          parameters: {
            type: 'object',
            properties: { companyId: { type: 'number', description: 'The ID of the company' } },
            required: ['companyId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'executeReadOnlyQuery',
          description: 'Executes a raw, read-only SELECT SQL query on the database to answer custom complex analytical questions. Strictly forbidden to run INSERT, UPDATE, DELETE.',
          parameters: {
            type: 'object',
            properties: { sqlQuery: { type: 'string', description: 'A valid MySQL SELECT query based on schema.' } },
            required: ['sqlQuery'],
          },
        },
      },
    ];

    try {
      // بناء مصفوفة الرسائل للـ Chat Completion
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(h => ({
          role: h.role as 'user' | 'assistant',
          content: h.content
        })),
        { role: 'user', content: message }
      ];

      // 1. الطلب الأول لـ Groq: الموديل بيقرر يجاوب ولا ينادي أداة
      const response = await this.groq.chat.completions.create({
        model: 'llama3-70b-8192', // موديل قوي جداً وذكي في الـ Tool Use والـ SQL
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.1,
      });

      const responseMessage = response.choices[0].message;
      const toolCalls = responseMessage.tool_calls;

      // 2. إذا طلب الموديل تشغيل دالة (Function Calling)
      if (toolCalls && toolCalls.length > 0) {
        // إضافة رد الموديل اللي بيحتوي على الـ tool_calls للمصفوفة (إجباري في الـ Loop)
        messages.push(responseMessage);

        for (const toolCall of toolCalls) {
          const { name } = toolCall.function;
          const args = JSON.parse(toolCall.function.arguments || '{}');
          let functionResult: any;

          // الـ Routing الفعلي على الداتابيز الحقيقية عندك
          if (name === 'getWorkerProfile') {
            functionResult = await this.workerRepo.findOne({
              where: { id: Number(args.workerId || userId) },
              relations: ['level']
            });
          } 
          else if (name === 'getCompanyDashboardStats') {
            functionResult = await this.executeCompanyStatsRaw(Number(args.companyId || userId));
          } 
          else if (name === 'executeReadOnlyQuery') {
            functionResult = await this.handleReadOnlySql((args.sqlQuery as string) || '');
          }

          // دفع نتيجة الدالة جوه الـ messages مع ربطها بنفس الـ tool_call_id
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ result: functionResult }),
          });
        }

        // 3. الطلب الثاني والنهائي لـ Groq بصياغة الرد البشري بناءً على الداتا المستخرجة
        const finalResponse = await this.groq.chat.completions.create({
          model: 'llama3-70b-8192',
          messages: messages,
        });

        return { reply: finalResponse.choices[0].message.content || 'تفضل الداتا المطلوبة.' };
      }

      // لو الرد مباشر بدون أدوات
      return { reply: responseMessage.content || 'لم أتمكن من معالجة الرد.' };

    } catch (err: any) {
      console.error('Groq Agent Full Loop Error:', err);
      return { 
        reply: `حدث خطأ في قاعدة البيانات الذكية عبر Groq. التفاصيل: ${err?.message || err}` 
      };
    }
  }

  // ═══════════════════════════════════════════════
  // SECURITY CHECK & SQL EXECUTION (Read-Only Guard)
  // ═══════════════════════════════════════════════
  private async handleReadOnlySql(query: string): Promise<any> {
    const cleanQuery = query.trim().toUpperCase();

    if (!cleanQuery) return { error: 'Empty query provided.' };

    if (!cleanQuery.startsWith('SELECT')) {
      return { error: 'Security Violation: Only SELECT queries are permitted.' };
    }
    if (cleanQuery.includes('DELETE') || cleanQuery.includes('DROP') || cleanQuery.includes('UPDATE') || cleanQuery.includes('ALTER') || cleanQuery.includes('INSERT')) {
      return { error: 'Security Violation: Destructive operations detected.' };
    }

    try {
      return await this.dataSource.query(query);
    } catch (dbError: any) {
      return { error: `Database execution error: ${dbError.message}` };
    }
  }

  private async executeCompanyStatsRaw(companyId: number) {
    const taskStats = await this.taskRepo
      .createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('task.companyId = :companyId', { companyId })
      .groupBy('task.status')
      .getRawMany();

    return { companyId, statsSummary: taskStats };
  }

  // ═══════════════════════════════════════════════
  // SYSTEM PROMPT FOR TEXT-TO-SQL
  // ═══════════════════════════════════════════════
  private buildSystemPrompt(currentUserId: number, role: UserRole): string {
    return `أنت "تسكاية الذكي (Tasqaya AI Agent)"، مساعد ذكي وصلاحيتك كاملة في مراجعة قاعدة البيانات ومساعدة المستخدمين.
أنت تتحدث حالياً مع مستخدم برقم معرّف (ID) يساوي: ${currentUserId} ويملك رتبة: ${role}.

🚨 معلومات هيكل الجداول في قاعدة البيانات (Database Schema):
1. جدول العمال (workers): يحتوي على الأعمدة (id, fullName, email, score, reliabilityRate, levelId, isActive).
2. جدول مستويات العمال (worker_level): يحتوي على (id, levelName, minScore, companyHourlyRate, workerHourlyRate). حيث يمثل workerHourlyRate السعر الذي يحصل عليه العامل، و companyHourlyRate السعر الظاهر للشركة.
3. جدول الشركات (companies): يحتوي على (id, name, email, isActive).
4. جدول المهام (tasks): يحتوي على (id, eventName, location, startDate, endDate, requiredWorkers, totalCost, status, companyId).

💡 تعليمات التشغيل والاستجابة الحرة للـ Agent:
- إذا سألك المستخدم سؤالاً عاماً أو تفصيلياً مخصصاً، ولم تجد دالة صريحة له، استخدم فوراً أداة 'executeReadOnlyQuery' لكتابة استعلام SQL والحصول على الداتا من الجداول الموضحة أعلاه.
- عند استخدام الـ SQL، احرص دائماً على ربط الفلترة بـ id المستخدم الحالي (${currentUserId}) ورتبته لتجلب له البيانات الخاصة به فقط ولا تخلط داتا المستخدمين ببعضهم.
- إذا سألك العامل عن سعره أو سعر المستويات، قم بعمل استعلام من جدول الـ worker_level واعرض له عمود الـ workerHourlyRate المتوافق مع فئته. لا تعرض له أبداً الـ companyHourlyRate لأنها أسعار خاصة بالشركات فقط!
- لا تطبع أبداً كود الـ SQL أو الـ Query لليوزر في الرد النهائي! صِغ الإجابة النهائية دائماً باللغة العربية بأسلوب بشري، احترافي وموجز، ونسق الردود باستخدام الـ Markdown بشكل منسق وجذاب.`;
  }
}
