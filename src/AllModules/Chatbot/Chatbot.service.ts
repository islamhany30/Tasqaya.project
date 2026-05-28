import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Worker } from '../../entities/Worker';
import { Company } from '../../entities/Company';
import { Supervisor } from '../../entities/Supervisor';
import { Task } from '../../entities/Task';
import { UserRole } from '../../Enums/User.role';
import { GoogleGenAI } from '@google/genai'; 

@Injectable()
export class ChatbotService {
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

    // 🎯 التحسين الذكي: تحليل نية الرسالة لمعرفة هل تحتاج بيانات لايف من الداتابيز أم لا
    const needsDbData = this.checkIfMessageNeedsData(message);

    // بناء الـ Prompt بناءً على الفلترة وتمرير سياق الـ message الحالي
    const systemPrompt = await this.buildSystemPrompt(userId, role, needsDbData);

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3, 
          maxOutputTokens: 1200, // تقليله قليلاً لزيادة السرعة في الـ Free Tier
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

  // 📝 دالة الفلترة السريعة لحماية الـ Tokens والـ Rate Limits
  private checkIfMessageNeedsData(message: string): boolean {
    const text = message.toLowerCase();
    // الكلمات المفتاحية التي تستدعي النزول للداتابيز فورا
    const keywords = [
      'task', 'job', 'event', 'score', 'point', 'level', 'reliability', 'money', 'payout',
      'تاسك', 'وظيفة', 'شغل', 'مهام', 'نقاط', 'نقط', 'مستوى', 'مستوايا', 'فلوس', 'يومية'
    ];
    return keywords.some(keyword => text.includes(keyword));
  }

  // ═══════════════════════════════════════════════
  // SYSTEM PROMPTS BUILDERS
  // ═══════════════════════════════════════════════

  private async buildSystemPrompt(
    userId: number,
    role: UserRole,
    needsDbData: boolean,
  ): Promise<string> {
    const base = `أنت مساعد ذكي مدمج داخل منصة Tasqaya (تسكاية) لإدارة العمالة المؤقتة للفعاليات.
رد دائماً بنفس اللغة التي يتحدث بها المستخدم واجعل الرد موجز ومختصر للغاية (Very concise).
نسق الردود دائماً باستخدام الـ Markdown (مثل الخط العريض **Bold** والنقاط).

🚨 تعليمات صارمة (STRICT DIRECTIVES):
- إذا سألك المستخدم عن حالته أو مهامه، يجب أن تبدأ ردك فوراً بذكر حالته العددية الحالية المكتوبة في [CRITICAL DATA] (سواء كان عنده أو معندوش)، ثم بعد ذلك وجهه للـ UI المخصص. لا تذكر اسم الـ UI فقط أبداً كإجابة مستقلة!`;

    switch (role) {
      case UserRole.COMPANY:
        return await this.buildCompanyPrompt(userId, base, needsDbData);

      case UserRole.WORKER:
        return await this.buildWorkerPrompt(userId, base, needsDbData);

      case UserRole.SUPERVISOR:
        return await this.buildSupervisorPrompt(userId, base, needsDbData);

      case UserRole.ADMIN:
        return `${base}\n\n[CRITICAL DATA]\nأنت تتحدث مع الـ Admin. وجهه لـ "لوحة التحكم الرئيسية (Admin Dashboard)".`;

      default:
        return base;
    }
  }

  // ── COMPANY PROMPT ────────────────────────────────────
  private async buildCompanyPrompt(companyId: number, base: string, needsDbData: boolean): Promise<string> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    const companyName = company?.name || 'Unknown';

    let tasksSummary = 'No specific dynamic tasks requested.';

    // 🎯 لا ننزل للداتابيز للبحث عن لستة التاسكات إلا لو سأل عنها فعلياً
    if (needsDbData) {
      const tasks = await this.taskRepo.find({
        where: { company: { id: companyId } },
        order: { createdAt: 'DESC' },
        take: 3, // تقليل الـ take لـ 3 لتخفيف حجم الداتا المبعوثة لجوجل
      });

      tasksSummary = tasks.length > 0
        ? `The user HAS active tasks in DB: [${tasks.map((t) => `${t.eventName} (${t.status})`).join(', ')}]. Tell them their tasks list, then state they can track them in **Company Dashboard Tab**.`
        : `The user currently has ZERO (0) active tasks in the database. If they ask in English, start with: "You currently don't have any active tasks." If Arabic start with: "لا توجد لديك أي مهام نشطة حالياً." then guide them to **Company Dashboard Tab** or **'Create Task' button**.`;
    }

    return `${base}

[CRITICAL DATA]
- Current Company Name: "${companyName}"
- Tasks Live Status: ${tasksSummary}
- Financial Rules: For payments, guide them to the **Billing / Invoices Tab** (50% upfront, 50% post-event).`;
  }

  // ── WORKER PROMPT ─────────────────────────────────────
  private async buildWorkerPrompt(workerId: number, base: string, needsDbData: boolean): Promise<string> {
    const worker = await this.workerRepo.findOne({
      where: { id: workerId },
      relations: ['level'],
    });

    const workerName = worker?.fullName || 'Unknown';
    const level = worker?.level?.levelName || 'Undefined';
    const score = worker?.score || 0;
    const reliability = worker?.reliabilityRate || 0;

    let tasksSummary = 'No specific dynamic tasks requested.';

    // 🎯 لا ننزل لجدول الـ Join المعقد إلا لو لزم الأمر
    if (needsDbData) {
      const tasks = await this.taskRepo.createQueryBuilder('task')
        .leftJoin('task.taskWorkers', 'taskWorker')
        .where('taskWorker.workerId = :workerId', { workerId })
        .take(1)
        .getMany();

      tasksSummary = tasks.length > 0 
        ? `The worker HAS active jobs assigned in DB right now. Inform them and guide them to check their **Home / Tasks Dashboard** to see details.`
        : `The database strictly shows ZERO (0) active tasks/jobs assigned to this worker right now. 
           - If they ask in English (e.g., "i have tasks or not?"), you MUST start your response exactly with: "You currently don't have any assigned tasks." and then guide them to check the **Home / Tasks Dashboard** tab to apply for jobs.
           - إذا سألك بالعربية، ابدأ ردك بـ: "معندكش أي مهام مسندة حالياً يا بطل." ثم وجهه لتبويب **الرئيسية / لوحة المهام** ليقدم على الشغل المتاح.`;
    }

    return `${base}

[CRITICAL DATA]
- Current Worker Name: "${workerName}"
- Tasks Live Status: ${tasksSummary}
- Level & Points Status: The worker has **${score} points**, **${reliability}% reliability rate**, and is at the **${level} level**. They can view this inside the **Profile Tab** / **ملفي الشخصي**.
- Earnings: Guide them to the **Wallet / Earnings Tab** / **محفظتي واليوميات** to follow up on their daily payments.`;
  }

  // ── SUPERVISOR PROMPT ──────────────────────────────────
  private async buildSupervisorPrompt(supervisorId: number, base: string, needsDbData: boolean): Promise<string> {
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
