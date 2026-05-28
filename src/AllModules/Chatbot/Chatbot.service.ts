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

    // 1. بناء الـ Prompt الديناميكي
    const systemPrompt = await this.buildSystemPrompt(userId, role);

    // 2. تحويل الـ History القديم فقط لصيغة Gemini (أخر 6 رسائل مثلاً للحفاظ على الـ Tokens)
    const formattedHistory = history.slice(-6).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // 3. بناء الـ contents بالترتيب الزمني الصح (القديم ثم السؤال الجديد في الآخر)
    const contents = [
      ...formattedHistory,
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    try {
      // ضرب الـ Endpoint الرسمي لـ Gemini 2.0 Flash
      const response = await firstValueFrom(
        this.httpService.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            contents,
            // 🎯 هنا السر: تمرير الـ System Prompt في مكانه الصحيح عشان يفضل مسيطر على الحوار كله
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500,
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        ),
      );

      console.log(
        'Gemini Response:',
        JSON.stringify(response.data, null, 2),
      );

      const reply =
        response?.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'لم يتم استلام رد من الذكاء الاصطناعي';

      return { reply };
    } catch (err) {
      console.error(
        'Gemini Error:',
        JSON.stringify(err?.response?.data || err.message, null, 2),
      );

      return {
        reply: 'حدث خطأ أثناء التواصل مع الذكاء الاصطناعي، يرجى المحاولة لاحقاً.',
        actual_error: err.message,
        gemini_details: err?.response?.data || 'No response data'
      };
    }
  }

  // ═══════════════════════════════════════════════
  // SYSTEM PROMPTS (باقي الكود بتاعك سليم وممتاز زي ما هو)
  // ═══════════════════════════════════════════════
  private async buildSystemPrompt(
    userId: number,
    role: UserRole,
  ): Promise<string> {
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
        return `${base}\n\nأنت تتحدث مع مدير النظام. ساعده في إدارة المنصة والمهام والمستخدمين.`;
      default:
        return base;
    }
  }

  // COMPANY
  private async buildCompanyPrompt(companyId: number, base: string): Promise<string> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    const tasks = await this.taskRepo.find({
      where: { company: { id: companyId } },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const tasksSummary = tasks.length > 0
      ? tasks.map((t) => `- ${t.eventName} | الحالة: ${t.status} | التكلفة: ${t.totalCost}`).join('\n')
      : 'لا توجد مهام';

    return `${base}\n\nالشركة: ${company?.name || 'غير معروف'}\n\nآخر المهام:\n${tasksSummary}\n\nساعد الشركة في:\n- فهم حالة المهام\n- الدفع والفواتير\n- إنشاء المهام\n- متابعة الطلبات`;
  }

  // WORKER
  private async buildWorkerPrompt(workerId: number, base: string): Promise<string> {
    const worker = await this.workerRepo.findOne({
      where: { id: workerId },
      relations: ['level'],
    });

    return `${base}\n\nالعامل: ${worker?.fullName || 'غير معروف'}\n\nبياناته:\n- المستوى: ${worker?.level?.levelName || 'غير محدد'}\n- النقاط: ${worker?.score || 0}\n- الحضور: ${worker?.reliabilityRate || 0}%\n\nساعده في:\n- التقديم على الوظائف\n- فهم النقاط والمستويات\n- تحسين الحضور`;
  }

  // SUPERVISOR
  private async buildSupervisorPrompt(supervisorId: number, base: string): Promise<string> {
    const supervisor = await this.supervisorRepo.findOne({ where: { id: supervisorId } });
    return `${base}\n\nالمشرف: ${supervisor?.fullName || 'غير معروف'}\n\nساعده في:\n- الإشراف على العمال\n- الحضور\n- رفع ملفات Excel\n- إدارة المهام`;
  }
}
