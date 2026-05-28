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
  // تعريف الـ SDK بمفتاح الـ API الخاص بك من ملف الـ .env
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  constructor(
    @InjectRepository(Worker)     private workerRepo:     Repository<Worker>,
    @InjectRepository(Company)    private companyRepo:    Repository<Company>,
    @InjectRepository(Supervisor) private supervisorRepo: Repository<Supervisor>,
    @InjectRepository(Task)       private taskRepo:       Repository<Task>,
    private dataSource: DataSource, // لتنفيذ استعلامات الـ SQL الديناميكية بأمان
  ) {}

  // ═══════════════════════════════════════════════
  // DEFINING TOOLS (FUNCTIONS DECLARATIONS)
  // ═══════════════════════════════════════════════
  
  // 1. أداة جلب بروفايل العامل الحالي
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

  // 3. الأداة الديناميكية السحرية: تنفيذ استعلام آمن (Read-Only SQL Execution)
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
  // MAIN CHAT METHOD WITH FULL AGENT LOOP
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
      // مصفوفة الـ Contents المشتركة لتنظيم المحادثة مع جمناي
      const contentsArray: any[] = [
        ...history.slice(-6).map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ];

      // 1. الخطوة الأولى: إرسال السؤال والأدوات لموديل gemini-1.5-flash
      let response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash', // التحديث للموديل المستقر ذو الليميت المفتوح
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.1, // منخفضة جداً لضمان دقة وصرامة كتابة الـ SQL والتزام الموديل بالداتا
          tools: [{
            functionDeclarations: [
              this.getWorkerProfileTool,
              this.getCompanyStatsTool,
              this.executeReadOnlyQueryTool
            ]
          }]
        },
        contents: contentsArray
      });

      // 2. الخطوة الثانية: التحقق مما إذا كان جمناي طلب تشغيل أداة (Function Call)
      let functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        const { name } = call;
        const args = call.args as Record<string, any> || {};
        const callId = call.id; // سحب الـ ID الفرعي للـ Call لمنع مشاكل الـ Matching

        let functionResult: any;

        // تنفيذ الـ Routing البرمجي الفعلي بناءً على طلب جمناي لايف في الـ Backend
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

        // 3. الخطوة الثالثة: إغلاق الـ Loop وإرسال النتيجة الحقيقية لموديل gemini-1.5-flash ليصيغ الرد النهائي
        const finalResponse = await this.ai.models.generateContent({
          model: 'gemini-1.5-flash', // التحديث للموديل المستقر ذو الليميت المفتوح
          config: { systemInstruction: systemPrompt },
          contents: [
            ...contentsArray,
            // تمرير طلب الموديل للـ Tool بالـ ID الفرعي له
            {
              role: 'model',
              parts: [{ functionCall: { name, args, id: callId } }]
            },
            // تمرير النتيجة الفعلية المستخرجة من قاعدة البيانات فوراً
            {
              role: 'user', 
              parts: [{ functionResponse: { name, response: { result: functionResult }, id: callId } }]
            }
          ]
        });

        return { reply: finalResponse.text || 'تفضل داتا الاستعلام المحدثة.' };
      }

      // إذا كان سؤال عام لا يحتاج لقاعدة البيانات، جمناي يرد مباشرة
      return { reply: response.text || 'لم أتمكن من معالجة الرد.' };

    } catch (err: any) {
      console.error('Gemini Agent Full Loop Error:', err);
      return { 
        reply: `حدث خطأ في قاعدة البيانات الذكية. التفاصيل: ${err?.message || err}` 
      };
    }
  }

  // ═══════════════════════════════════════════════
  // SECURITY CHECK & SQL EXECUTION (Read-Only Guard)
  // ═══════════════════════════════════════════════
  private async handleReadOnlySql(query: string): Promise<any> {
    const cleanQuery = query.trim().toUpperCase();

    if (!cleanQuery) {
      return { error: 'Empty query provided.' };
    }

    // جدار حماية صارم يمنع الموديل تماماً من التعديل أو التخريب في الجداول
    if (!cleanQuery.startsWith('SELECT')) {
      return { error: 'Security Violation: Only SELECT queries are permitted.' };
    }
    if (cleanQuery.includes('DELETE') || cleanQuery.includes('DROP') || cleanQuery.includes('UPDATE') || cleanQuery.includes('ALTER') || cleanQuery.includes('INSERT')) {
      return { error: 'Security Violation: Destructive operations detected.' };
    }

    try {
      // تنفيذ الـ SQL query المكتوب ديناميكياً من الموديل
      return await this.dataSource.query(query);
    } catch (dbError: any) {
      return { error: `Database execution error: ${dbError.message}` };
    }
  }

  // ميثود مساعدة لجلب إحصائيات الشركات بناءً على الـ Task Entity في مشروعك
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

💡 تعليمات التشغيل والاستجابة الحرة للـ Agent:
- إذا سألك المستخدم سؤالاً عاماً أو تفصيلياً مخصصاً، ولم تجد دالة صريحة له، استخدم فوراً أداة 'executeReadOnlyQuery' لكتابة استعلام SQL والحصول على الداتا من الجداول الموضحة أعلاه.
- عند استخدام الـ SQL، احرص دائماً على ربط الفلترة بـ id المستخدم الحالي (${currentUserId}) ورتبته لتجلب له البيانات الخاصة به فقط ولا تخلط داتا المستخدمين ببعضهم.
- إذا سألك العامل عن سعره أو سعر المستويات، قم بعمل استعلام من جدول الـ worker_level واعرض له عمود الـ workerHourlyRate المتوافق مع فئته. لاعرض له أبداً الـ companyHourlyRate لأنها أسعار خاصة بالشركات فقط!
- لا تطبع أبداً كود الـ SQL أو الـ Query لليوزر في الرد النهائي! صِغ الإجابة النهائية دائماً باللغة العربية بأسلوب بشري، احترافي وموجز، ونسق الردود باستخدام الـ Markdown بشكل منسق وجذاب.`;
  }
}
