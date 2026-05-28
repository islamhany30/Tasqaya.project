import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Worker } from '../../entities/Worker';
import { Company } from '../../entities/Company';
import { Supervisor } from '../../entities/Supervisor';
import { Task } from '../../entities/Task';
import { UserRole } from '../../Enums/User.role';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

@Injectable()
export class ChatbotService {
  // تعريف الـ SDK بالـ API KEY الخاص بك
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  constructor(
    @InjectRepository(Worker)     private workerRepo:     Repository<Worker>,
    @InjectRepository(Company)    private companyRepo:    Repository<Company>,
    @InjectRepository(Supervisor) private supervisorRepo: Repository<Supervisor>,
    @InjectRepository(Task)       private taskRepo:       Repository<Task>,
    private dataSource: DataSource, // بنحتاجه عشان الـ Raw SQL Queries الآمنة
  ) {}

  // ═══════════════════════════════════════════════
  // DEFINING TOOLS (FUNCTIONS DECLARATIONS)
  // ═══════════════════════════════════════════════
  
  // 1. أداة جلب بروفايل العامل
  private getWorkerProfileTool: FunctionDeclaration = {
    name: 'getWorkerProfile',
    description: 'Fetches the complete profile details of the currently logged-in worker, including their score, reliability rate, and level.',
    parameters: {
      type: Type.OBJECT,
      properties: { workerId: { type: Type.INTEGER, description: 'The ID of the worker' } },
      required: ['workerId'],
    },
  };

  // 2. أداة جلب إحصائيات لوحة تحكم الشركة
  private getCompanyStatsTool: FunctionDeclaration = {
    name: 'getCompanyDashboardStats',
    description: 'Fetches dashboard analytics for a company including total tasks count by status, active/completed tasks, total spent, pending payments, and average ratings.',
    parameters: {
      type: Type.OBJECT,
      properties: { companyId: { type: Type.INTEGER, description: 'The ID of the company' } },
      required: ['companyId'],
    },
  };

  // 3. الأداة السحرية: تنفيذ استعلام ديناميكي آمن (Read-Only SQL Execution)
  private executeReadOnlyQueryTool: FunctionDeclaration = {
    name: 'executeReadOnlyQuery',
    description: 'Executes a raw, read-only SELECT SQL query on the database to answer custom, specific, complex or analytical questions that do not have dedicated functions. Strictly forbidden to run INSERT, UPDATE, DELETE, or DROP.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        sqlQuery: { type: Type.STRING, description: 'A valid MySQL SELECT query based on the system schema.' }
      },
      required: ['sqlQuery'],
    },
  };

  // ═══════════════════════════════════════════════
  // MAIN CHAT METHOD WITH TOOL LOOP
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

    try {
      // إرسال الطلب لجمناي مع توفير الأدوات (Tools)
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2, // تقليل الـ temperature لضمان دقة كتابة الـ SQL والالتزام بالفانكشنز
          tools: [{
            functionDeclarations: [
              this.getWorkerProfileTool,
              this.getCompanyStatsTool,
              this.executeReadOnlyQueryTool
            ]
          }]
        },
        contents: [
          ...history.slice(-6).map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }]
          })),
          { role: 'user', parts: [{ text: message }] }
        ]
      });

      // التحقق مما إذا كان جمناي يريد استدعاء دالة (Function Call)
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        const { name, args } = call;
        
        let functionResult: any;

        // 🔀 الـ Routing الذكي بناءً على قرار جمناي
        if (name === 'getWorkerProfile') {
          functionResult = await this.workerRepo.findOne({
            where: { id: Number(args.workerId) },
            relations: ['level']
          });
        } 
        else if (name === 'getCompanyDashboardStats') {
          // جلب الإحصائيات مباشرة من الـ Query المكتوب في الـ TaskService بتاعك
          functionResult = await this.executeCompanyStatsRaw(Number(args.companyId));
        } 
        else if (name === 'executeReadOnlyQuery') {
          functionResult = await this.handleReadOnlySql(args.sqlQuery as string);
        }

        // إرسال نتيجة الدالة لجمناي ليصيغ الرد البشري النهائي
        const finalResponse = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          config: { systemInstruction: systemPrompt },
          contents: [
            ...history.slice(-6).map(h => ({
              role: h.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: h.content }]
            })),
            { role: 'user', parts: [{ text: message }] },
            {
              role: 'model',
              parts: [{ functionResponse: { name, response: { result: functionResult } } }]
            }
          ]
        });

        return { reply: finalResponse.text || 'تفضل داتا الاستعلام المحدثة.' };
      }

      // لو اليوزر سأل سؤال عام وجوابه مش محتاج داتابيز (جمناي هيرد مباشرة)
      return { reply: response.text || 'لم أتمكن من معالجة الرد.' };

    } catch (err) {
      console.error('Gemini Agent Error:', err);
      return { reply: 'حدث خطأ غير متوقع أثناء الاتصال بقاعدة البيانات الذكية.' };
    }
  }

  // ═══════════════════════════════════════════════
  // SECURITY CHECK & SQL EXECUTION (Read-Only Guard)
  // ═══════════════════════════════════════════════
  private async handleReadOnlySql(query: string): Promise<any> {
    const cleanQuery = query.trim().toUpperCase();

    // جدار حماية صارم لمنع أي محاولة تعديل أو تخريب في الداتا بيز
    if (!cleanQuery.startsWith('SELECT')) {
      return { error: 'Security Violation: Only SELECT queries are permitted.' };
    }
    if (cleanQuery.includes('DELETE') || cleanQuery.includes('DROP') || cleanQuery.includes('UPDATE') || cleanQuery.includes('ALTER') || cleanQuery.includes('INSERT')) {
      return { error: 'Security Violation: Destructive operations detected.' };
    }

    try {
      // تنفيذ الاستعلام على الداتابيز مباشرة
      return await this.dataSource.query(query);
    } catch (dbError) {
      return { error: `Database execution error: ${dbError.message}` };
    }
  }

  // ميثود مساعدة لجلب إحصائيات الشركات بناءً على الكود الفعلي للسيرفس عندك
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
  // INJECTING THE SCHEMA FOR TEXT-TO-SQL
  // ═══════════════════════════════════════════════
  private buildSystemPrompt(currentUserId: number, role: UserRole): string {
    return `أنت "تسكاية الذكي (Tasqaya AI Agent)"، مساعد ذكي وصلاحيتك كاملة في مراجعة قاعدة البيانات ومساعدة المستخدمين.
أنت تتحدث حالياً مع مستخدم برقم معرّف (ID) يساوي: ${currentUserId} ويملك رتبة: ${role}.

🚨 معلومات هيكل الجداول في قاعدة البيانات (Database Schema):
1. جدول العمال (workers): يحتوي على الأعمدة (id, fullName, email, score, reliabilityRate, levelId, isActive).
2. جدول مستويات العمال (worker_level): يحتوي على (id, levelName, minScore, companyHourlyRate, workerHourlyRate). حيث يمثل workerHourlyRate السعر الذي يحصل عليه العامل، و companyHourlyRate السعر الظاهر للشركة.
3. جدول الشركات (companies): يحتوي على (id, name, email, isActive).
4. جدول المهام (tasks): يحتوي على (id, eventName, location, startDate, endDate, requiredWorkers, totalCost, status, companyId).

💡 تعليمات التشغيل والاستجابة الحرة:
- إذا سألك المستخدم سؤالاً عاماً أو تفصيلياً مخصصاً، ولم تجد دالة صريحة له، استخدم فوراً أداة 'executeReadOnlyQuery' لكتابة استعلام SQL والحصول على الداتا من الجداول الموضحة أعلاه.
- عند استخدام الـ SQL، احرص دائماً على ربط الفلترة بـ id المستخدم الحالي (${currentUserId}) ورتبته لتجلب له البيانات الخاصة به فقط.
- إذا سألك العامل عن سعره أو سعر المستويات، قم بعمل استعلام من جدول الـ worker_level واعرض له عمود الـ workerHourlyRate المتوافق مع فئته.
- صِغ الإجابات النهائية باللغة العربية بأسلوب احترافي وموجز، ونسق الردود باستخدام الـ Markdown بشكل منسق وجذاب.`;
  }
}
