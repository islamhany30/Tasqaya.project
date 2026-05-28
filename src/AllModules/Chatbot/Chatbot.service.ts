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

    // 1. بناء الـ Prompt الديناميكي بناءً على الـ Role وبيانات الداتابيز الحالية واللغات والـ UI
    const systemPrompt = await this.buildSystemPrompt(userId, role);

    try {
      // 2. إرسال الطلب لجوجل بالـ SDK الرسمي
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash', // أحدث موديل مستقر وسريع
        config: {
          systemInstruction: systemPrompt, // حقن الـ Prompt هنا رسمي ونظيف لضمان الالتزام بالهوية واللغة والـ UI
          temperature: 0.7,
          maxOutputTokens: 1500, // مرفوعة لـ 1500 عشان الردود الإنجليزي والعربي تطلع كاملة ومتقطعش
        },
        // تحويل الـ history للشكل الهندسي اللي الـ SDK بيفهمه (آخر 6 رسائل للحفاظ على الـ Tokens)
        contents: [
          ...history.slice(-6).map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }]
          })),
          { role: 'user', parts: [{ text: message }] }
        ]
      });

      // 3. استخراج الرد المباشر
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
  // SYSTEM PROMPTS BUILDERS (الدمج بين الداتا وتوجيه الـ UI)
  // ═══════════════════════════════════════════════

  private async buildSystemPrompt(
    userId: number,
    role: UserRole,
  ): Promise<string> {
    const base = `أنت مساعد ذكي مدمج داخل منصة Tasqaya (تسكاية) لإدارة العمالة المؤقتة للفعاليات.
رد دائماً بنفس اللغة التي يتحدث بها المستخدم واجعل الرد موجز ومختصر للغاية (Very concise).

🎯 تعليمات واجهة التطبيق وتنسيق الردود (UI & Formatting Rules):
1. نسق ردودك دائماً باستخدام الـ Markdown (مثل الخط العريض **Bold** والقوائم النقطية) لتكون مريحة ومقروءة داخل واجهة شات الموبايل/الويب.
2. أنت واعي تماماً بصفحات الأبليكيشن المتاحة للمستخدم؛ إذا سألك عن (المهام، النقاط، الفواتير، أو الحضور)، لا تكتفِ بالإجابة النصية، بل وجهه بوضوح للتبويب أو الزرار الصحيح في الأبليكيشن ليرى البيانات بنفسه أو يكمل المصلحة بإيده.
3. إذا سألك بالإنجليزية وجهه لأسماء الصفحات بالإنجليزية، وإذا سألك بالعربية وجهه بأسماء الصفحات العربية المحددة لك.
4. لا تخترع معلومات أو أرقام — استند فقط على البيانات المستخرجة من قاعدة البيانات المتاحة لك أدناه.`;

    switch (role) {
      case UserRole.COMPANY:
        return await this.buildCompanyPrompt(userId, base);

      case UserRole.WORKER:
        return await this.buildWorkerPrompt(userId, base);

      case UserRole.SUPERVISOR:
        return await this.buildSupervisorPrompt(userId, base);

      case UserRole.ADMIN:
        return `${base}\n\nأنت تتحدث مع مدير النظام (Admin). وجهه لـ "لوحة التحكم الرئيسية (Admin Dashboard)" لإدارة المستخدمين، والطلبات المعلقة، والتقارير العامة للسيستم بأسلوب موجز.`;

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

    const tasksSummary = tasks.length > 0
      ? tasks.map((t) => `- ${t.eventName} | Status: ${t.status} | Cost: ${t.totalCost} EGP`).join('\n')
      : 'لا توجد مهام مسجلة حالياً في قاعدة البيانات / No tasks recorded currently in database.';

    return `${base}

الشركة الحالية / Current Company: "${company?.name || 'غير معروف / Unknown'}"

آخر 5 مهام خاصة بالشركة من قاعدة البيانات الحالية:
${tasksSummary}

🗺️ خريطة صفحات الشركة (Company UI Map) - استخدمها لتوجيه المستخدم فوراً:
1. لوحة التحكم (Company Dashboard Tab): لمتابعة الإحصائيات، والمهام النشطة وحالتها الحالية لايف.
2. إنشاء مهمة جديدة (Create Task Tab / Button): المكان المخصص لملء بيانات الفعالية الجديدة وإطلاقها على السيستم.
3. الفواتير والماليات (Billing / Invoices Tab): لمتابعة الدفعات وحالة الفواتير (نظام الـ 50% مقدماً والـ 50% بعد انتهاء الفعالية).`;
  }

  // ── WORKER PROMPT ─────────────────────────────────────
  private async buildWorkerPrompt(workerId: number, base: string): Promise<string> {
    const worker = await this.workerRepo.findOne({
      where: { id: workerId },
      relations: ['level'],
    });

    return `${base}

العامل الحالي / Current Worker: "${worker?.fullName || 'غير معروف / Unknown'}"

بيانات العامل من قاعدة البيانات:
- المستوى الحالي / Level: ${worker?.level?.levelName || 'غير محدد / Undefined'}
- إجمالي النقاط / Score: ${worker?.score || 0}
- معدل الالتزام والحضور / Reliability Rate: ${worker?.reliabilityRate || 0}%

🗺️ خريطة صفحات العامل (Worker UI Map) - استخدمها لتوجيه المستخدم فوراً:
1. الشاشة الرئيسية (Home / Tasks Dashboard): لمشاهدة والتقديم على الوظائف والفعاليات المتاحة حالياً في الأبليكيشن.
2. الملف الشخصي (Profile Tab): الشاشة التي يظهر فيها (المستوى الحالي برونزي/فضي/ذهبي، إجمالي النقاط، ومعدل الالتزام والـ Reliability Rate).
3. محفظتي واليوميات (Wallet / Earnings Tab): لمتابعة الأجر واليوميات المستحقة عن الفعاليات التي حضرها.`;
  }

  // ── SUPERVISOR PROMPT ──────────────────────────────────
  private async buildSupervisorPrompt(supervisorId: number, base: string): Promise<string> {
    const supervisor = await this.supervisorRepo.findOne({ where: { id: supervisorId } });

    return `${base}

المشرف الحالي / Current Supervisor: "${supervisor?.fullName || 'غير معروف / Unknown'}"

🗺️ خريطة صفحات المشرف (Supervisor UI Map) - استخدمها لتوجيه المستخدم فوراً:
1. لوحة إشراف الفعاليات (Supervisor Dashboard): لعرض الفعاليات المسندة إليه والعمال التابعين له في كل فعالية.
2. كشف الحضور والانصراف (Attendance Tab): لتسجيل حضور وانصراف العمال مباشرة، أو تحميل ورفع شيت الـ Excel الخاص بالحضور.
3. مجموعات التنسيق (Coordination / WhatsApp Links): للوصول السريع لروابط جروبات الواتساب الخاصة بكل فعالية للتنسيق مع العمال.`;
  }
}
