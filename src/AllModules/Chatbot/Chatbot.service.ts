import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Worker } from '../../entities/Worker';
import { Company } from '../../entities/Company';
import { Supervisor } from '../../entities/Supervisor';
import { Task } from '../../entities/Task';
import { UserRole } from '../../Enums/User.role';

// 1. استيراد المكتبة الرسمية والأحدث من جوجل 🎯
import { GoogleGenAI } from '@google/genai'; 

@Injectable()
export class ChatbotService {
  // 2. تعريف الـ SDK بمفتاح الـ API بتاعك من الـ .env
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  constructor(
    @InjectRepository(Worker)     private workerRepo:     Repository<Worker>,
    @InjectRepository(Company)    private companyRepo:    Repository<Company>,
    @InjectRepository(Supervisor) private supervisorRepo: Repository<Supervisor>,
    @InjectRepository(Task)       private taskRepo:       Repository<Task>,
  ) {}

  // ═══════════════════════════════════════════════
  // MAIN CHAT METHOD
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

    // 1. بناء الـ Prompt المشترك (بيعمل Query للداتابيز حالا وبيدمجها بالـ UI)
    const systemPrompt = await this.buildSystemPrompt(userId, role);

    try {
      // 2. إرسال الطلب لجوجل بالـ SDK الحديث
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3, // صارم جداً لضمان الالتزام بالتعليمات المكتوبة حرفياً وميلفش ويدور
          maxOutputTokens: 1500, 
        },
        contents: [
          ...history.slice(-6).map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }]
          })),
          { role: 'user', parts: [{ text: message }] }
        ]
      });

      const reply = response.text || 'لم يتم استلام رد من الذكاء الاصطناعي';
      return { reply };

    } catch (err) {
      console.error('Gemini SDK Error:', err);
      return {
        reply: 'حدث خطأ أثناء التواصل مع الذكاء الاصطناعي، يرجى المحاولة لاحقاً.',
      };
    }
  }

  // ═══════════════════════════════════════════════
  // SYSTEM PROMPTS BUILDERS
  // ═══════════════════════════════════════════════

  private async buildSystemPrompt(
    userId: number,
    role: UserRole,
  ): Promise<string> {
    const base = `أنت مساعد ذكي مدمج داخل منصة Tasqaya (تسكاية) لإدارة العمالة المؤقتة للفعاليات.
رد دائماً بنفس اللغة التي يتحدث بها المستخدم واجعل الرد موجز ومختصر للغاية (Very concise).
نسق الردود دائماً باستخدام الـ Markdown (مثل الخط العريض **Bold** والنقاط).

🚨 تعليمات صارمة (STRICT DIRECTIVES):
- إذا سألك المستخدم "هل عندي تاسكات؟" أو أي سؤال شبيه (Do I have tasks / jobs / events?)، يجب أن تبدأ ردك فوراً بذكر حالته العددية الحالية من الداتابيز المكتوبة في [CRITICAL DATA] (سواء كان عنده أو معندوش)، ثم بعد ذلك وجهه للـ UI المخصص. لا تذكر اسم الـ UI فقط أبداً كإجابة مستقلة!`;

    switch (role) {
      case UserRole.COMPANY:
        return await this.buildCompanyPrompt(userId, base);

      case UserRole.WORKER:
        return await this.buildWorkerPrompt(userId, base);

      case UserRole.SUPERVISOR:
        return await this.buildSupervisorPrompt(userId, base);

      case UserRole.ADMIN:
        return `${base}\n\n[CRITICAL DATA]\nأنت تتحدث مع الـ Admin. وجهه لـ "لوحة التحكم الرئيسية (Admin Dashboard)".`;

      default:
        return base;
    }
  }

  // ── COMPANY PROMPT ────────────────────────────────────
  private async buildCompanyPrompt(companyId: number, base: string): Promise<string> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    const tasks = await this.taskRepo.find({
      where: { company: { id: companyId } },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const companyName = company?.name || 'Unknown';
    
    const tasksSummary = tasks.length > 0
      ? `The user HAS active tasks in DB: [${tasks.map((t) => `${t.eventName} (${t.status})`).join(', ')}]. Tell them their tasks list, then state they can track them in **Company Dashboard Tab**.`
      : `The user currently has ZERO (0) active tasks in the database. 
         - If they ask in English, you MUST start your response exactly with: "You currently don't have any active tasks." and then guide them to the **Company Dashboard Tab** or click **'Create Task' button** to add one.
         - إذا سألك بالعربية، ابدأ ردك بـ: "لا توجد لديك أي مهام نشطة حالياً." ثم وجهه لتبويب **لوحة التحكم** أو زر **إنشاء مهمة جديدة**.`;

    return `${base}

[CRITICAL DATA]
- Current Company Name: "${companyName}"
- Tasks Live Status: ${tasksSummary}
- Financial Rules: For payments, guide them to the **Billing / Invoices Tab** (50% upfront, 50% post-event).`;
  }

  // ── WORKER PROMPT (تم حل مشكلة الـ TypeORM والـ Relations بنجاح 🎯) ──
  private async buildWorkerPrompt(workerId: number, base: string): Promise<string> {
    const worker = await this.workerRepo.findOne({
      where: { id: workerId },
      relations: ['level'],
    });

    const workerName = worker?.fullName || 'Unknown';
    const level = worker?.level?.levelName || 'Undefined';
    const score = worker?.score || 0;
    const reliability = worker?.reliabilityRate || 0;

    // 🎯 استخدام الـ QueryBuilder لعمل Join صحيح ومضمون مع جدول الـ taskWorkers الوسيط
    const tasks = await this.taskRepo.createQueryBuilder('task')
      .leftJoin('task.taskWorkers', 'taskWorker')
      .where('taskWorker.workerId = :workerId', { workerId })
      .take(1)
      .getMany();

    const tasksSummary = tasks.length > 0 
      ? `The worker HAS active jobs assigned in DB right now. Inform them and guide them to check their **Home / Tasks Dashboard** to see details.`
      : `The database strictly shows ZERO (0) active tasks/jobs assigned to this worker right now. 
         - If they ask in English (e.g., "i have tasks or not?"), you MUST start your response exactly with: "You currently don't have any assigned tasks." and then guide them to check the **Home / Tasks Dashboard** tab to apply for jobs.
         - إذا سألك بالعربية، ابدأ ردك بـ: "معندكش أي مهام مسندة حالياً يا بطل." ثم وجهه لتبويب **الرئيسية / لوحة المهام** ليقدم على الشغل المتاح.`;

    return `${base}

[CRITICAL DATA]
- Current Worker Name: "${workerName}"
- Tasks Live Status: ${tasksSummary}
- Level & Points Status: The worker has **${score} points**, **${reliability}% reliability rate**, and is at the **${level} level**. They can view this inside the **Profile Tab** / **ملفي الشخصي**.
- Earnings: Guide them to the **Wallet / Earnings Tab** / **محفظتي واليوميات** to follow up on their daily payments.`;
  }

  // ── SUPERVISOR PROMPT ──────────────────────────────────
  private async buildSupervisorPrompt(supervisorId: number, base: string): Promise<string> {
    const supervisor = await this.supervisorRepo.findOne({ where: { id: supervisorId } });
    const supervisorName = supervisor?.fullName || 'Unknown';

    return `${base}

[CRITICAL DATA]
- Current Supervisor Name: "${supervisorName}"
- Attendance Operations: Manage via the **Attendance Tab** (upload/download Excel sheets).
- Active Events: Check the **Supervisor Dashboard** to see assigned events.
- Communications: Guide them to **Coordination / WhatsApp Links** to fetch group links.`;
  }
}
