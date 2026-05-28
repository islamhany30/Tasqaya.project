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
          temperature: 0.7,
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
استند فقط على النص المكتوب في قسم [CRITICAL CONTEXT] بالأسفل للرد على حالة المستخدم ولا تخترع أرقاماً أو تنحاز لإجابات عامة.`;

    switch (role) {
      case UserRole.COMPANY:
        return await this.buildCompanyPrompt(userId, base);

      case UserRole.WORKER:
        return await this.buildWorkerPrompt(userId, base);

      case UserRole.SUPERVISOR:
        return await this.buildSupervisorPrompt(userId, base);

      case UserRole.ADMIN:
        return `${base}\n\n[CRITICAL CONTEXT]\nأنت تتحدث مع الـ Admin. وجهه لـ "لوحة التحكم الرئيسية (Admin Dashboard)".`;

      default:
        return base;
    }
  }

  // ── COMPANY PROMPT (الدمج الإجباري هنا 🎯) ─────────────────
  private async buildCompanyPrompt(companyId: number, base: string): Promise<string> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    const tasks = await this.taskRepo.find({
      where: { company: { id: companyId } },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const companyName = company?.name || 'Unknown';
    
    // سطر واحد مدمج يربط حالة الداتا الحقيقية بالـ UI اللحظي غصب عن الموديل
    const tasksSummary = tasks.length > 0
      ? `The database shows these active tasks: [${tasks.map((t) => `${t.eventName} (${t.status})`).join(', ')}]. Mention them to the user and tell them they can view their full live details in their **Company Dashboard Tab**.`
      : `The database strictly shows **0 active tasks** (No tasks recorded) for this company right now. You MUST explicitly tell them they currently have no tasks, and guide them to check the **Company Dashboard Tab** or click the **'Create Task' button** to launch one.`;

    return `${base}

[CRITICAL CONTEXT]
- Current Company Name: "${companyName}"
- Database & UI Status: ${tasksSummary}
- Financial Rules: For payments, guide them to the **Billing / Invoices Tab** (50% upfront, 50% post-event).`;
  }

  // ── WORKER PROMPT (الدمج الإجباري هنا 🎯) ──────────────────
  private async buildWorkerPrompt(workerId: number, base: string): Promise<string> {
    const worker = await this.workerRepo.findOne({
      where: { id: workerId },
      relations: ['level'],
    });

    const workerName = worker?.fullName || 'Unknown';
    const level = worker?.level?.levelName || 'Undefined';
    const score = worker?.score || 0;
    const reliability = worker?.reliabilityRate || 0;

    return `${base}

[CRITICAL CONTEXT]
- Current Worker Name: "${workerName}"
- Level & Points Status: The worker currently has **${score} points**, **${reliability}% reliability rate**, and is at the **${level} level**. You MUST tell them these exact numbers from DB and inform them they can track them inside their **Profile Tab**.
- Job Applications: Guide them to the **Home / Tasks Dashboard** tab to browse and apply for available tasks.
- Earnings: Guide them to the **Wallet / Earnings Tab** to follow up on their daily payments.`;
  }

  // ── SUPERVISOR PROMPT ──────────────────────────────────
  private async buildSupervisorPrompt(supervisorId: number, base: string): Promise<string> {
    const supervisor = await this.supervisorRepo.findOne({ where: { id: supervisorId } });
    const supervisorName = supervisor?.fullName || 'Unknown';

    return `${base}

[CRITICAL CONTEXT]
- Current Supervisor Name: "${supervisorName}"
- Attendance Operations: Tell them to manage worker schedules and check-ins via the **Attendance Tab** (where they can upload/download Excel sheets).
- Active Events: Tell them to check the **Supervisor Dashboard** to see assigned events.
- Communications: Guide them to **Coordination / WhatsApp Links** to fetch group links.`;
  }
}
