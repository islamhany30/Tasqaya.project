import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Worker } from '../../entities/Worker';
import { Company } from '../../entities/Company';
import { Supervisor } from '../../entities/Supervisor';
import { Task } from '../../entities/Task';
import { UserRole } from '../../Enums/User.role';

@Injectable()
export class ChatbotService {
  constructor(
    @InjectRepository(Worker)     private workerRepo:     Repository<Worker>,
    @InjectRepository(Company)    private companyRepo:    Repository<Company>,
    @InjectRepository(Supervisor) private supervisorRepo: Repository<Supervisor>,
    @InjectRepository(Task)       private taskRepo:       Repository<Task>,
    private readonly httpService: HttpService,
  ) {}

  // ════════════════════════════════════════════════════════
  // MAIN CHAT METHOD
  // ════════════════════════════════════════════════════════
  async chat(
    userId: number,
    role: UserRole,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ) {
    if (!message?.trim()) throw new BadRequestException('Message is required');

    // ── Build system prompt based on role ────────────────
    const systemPrompt = await this.buildSystemPrompt(userId, role);

    // ── Build messages array ──────────────────────────────
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6), // keep last 6 messages for context
      { role: 'user', content: message },
    ];

    // ── Call OpenRouter API ───────────────────────────────
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'meta-llama/llama-3.1-8b-instruct:free',
            messages,
            max_tokens: 500,
            temperature: 0.7,
          },
          {
            headers: {
              Authorization:  `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer':  process.env.APP_BASE_URL || 'https://tasqaya-project-1.onrender.com',
              'X-Title':       'Tasqaya Platform',
            },
          },
        ),
      );

      const reply = response.data.choices[0].message.content;
      return { reply };

    } catch (err) {
     console.error('FULL ERROR => ', JSON.stringify(err?.response?.data, null, 2));

      return {
        error: err?.response?.data || err.message,
      };
    }
  }

  // ════════════════════════════════════════════════════════
  // BUILD SYSTEM PROMPT PER ROLE
  // ════════════════════════════════════════════════════════
  private async buildSystemPrompt(userId: number, role: UserRole): Promise<string> {
    const base = `أنت مساعد ذكي لمنصة Tasqaya لإدارة العمالة المؤقتة للفعاليات.
رد دائماً بالعربية بأسلوب احترافي وودي ومختصر.
لا تخترع معلومات — استند فقط على البيانات المتاحة لك.`;

    switch (role) {
      case UserRole.COMPANY:
        return await this.buildCompanyPrompt(userId, base);

      case UserRole.WORKER:
        return await this.buildWorkerPrompt(userId, base);

      case UserRole.SUPERVISOR:
        return await this.buildSupervisorPrompt(userId, base);

      case UserRole.ADMIN:
        return `${base}
أنت تتحدث مع مدير النظام.
صلاحياتك: إدارة المستخدمين، مراقبة المهام، تعديل الحسابات.
ساعده في أي استفسار عن إدارة المنصة.`;

      default:
        return base;
    }
  }

  // ── Company prompt ────────────────────────────────────
  private async buildCompanyPrompt(companyId: number, base: string): Promise<string> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
    });

    const tasks = await this.taskRepo.find({
      where: { company: { id: companyId } },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const tasksSummary = tasks.length > 0
      ? tasks.map(t =>
          `- ${t.eventName} | الحالة: ${t.status} | البداية: ${t.startDate} | التكلفة: ${t.totalCost} جنيه`
        ).join('\n')
      : 'لا توجد مهام حتى الآن';

    return `${base}
أنت تتحدث مع شركة اسمها: ${company?.name || 'غير معروف'}

آخر 5 مهام لهذه الشركة:
${tasksSummary}

يمكنك مساعدتهم في:
- فهم حالة مهامهم (UNAPPROVED / PENDING / IN_PROGRESS / COMPLETED)
- شرح خطوات إنشاء مهمة جديدة وموافقتها
- شرح نظام الدفع 50% قبل + 50% بعد
- الإجابة على أسئلة الفواتير والدفع
- توجيههم لإكمال أي خطوة ناقصة`;
  }

  // ── Worker prompt ─────────────────────────────────────
  private async buildWorkerPrompt(workerId: number, base: string): Promise<string> {
    const worker = await this.workerRepo.findOne({
      where: { id: workerId },
      relations: ['level'],
    });

    return `${base}
أنت تتحدث مع عامل اسمه: ${worker?.fullName || 'غير معروف'}

بياناته:
- المستوى: ${worker?.level?.levelName || 'غير محدد'}
- النقاط: ${worker?.score || 0}
- معدل الحضور: ${worker?.reliabilityRate || 0}%
- المهام المكتملة: ${worker?.completedTasks || 0}

يمكنك مساعدته في:
- فهم مستواه وكيفية الترقي (BRONZE → SILVER → GOLD)
- شرح كيفية التقديم على الوظائف المتاحة
- شرح نظام تأكيد الحضور (YES/NO links في الإيميل)
- الإجابة على أسئلة عن المدفوعات
- نصائح لرفع معدل الحضور والنقاط`;
  }

  // ── Supervisor prompt ─────────────────────────────────
  private async buildSupervisorPrompt(supervisorId: number, base: string): Promise<string> {
    const supervisor = await this.supervisorRepo.findOne({
      where: { id: supervisorId },
    });

    return `${base}
أنت تتحدث مع مشرف اسمه: ${supervisor?.fullName || 'غير معروف'}

يمكنك مساعدته في:
- شرح مهامه كمشرف (الإشراف على العمال، تسجيل الحضور)
- كيفية تحميل قالب الحضور Excel ورفعه
- كيفية إنشاء مجموعة WhatsApp للعمال
- شرح كيفية احتساب المكافأة بتاعته
- الإجابة على أسئلة عن المهام المسندة إليه`;
  }
}
