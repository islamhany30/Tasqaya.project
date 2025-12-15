import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ModerationService {
  async checkText(text: string): Promise<{ flagged: boolean; reason: string }> {
    // ---- Local filter patterns ----
    const forbiddenPatterns: RegExp[] = [
      // English
      /kill/i,
      /murder/i,
      /rape/i,
      /fuck/i,
      /pig/i,
      /cut your throat/i,
      /i'm going to find you/i,
      /threat/i,
      /terror/i,
      /bomb/i,
      /shoot/i,
      /stab/i,
      /(hurt|harm).*you/i,
      /i will.*(hurt|kill|cut|stab)/i,

      // Arabic
      /اقتل/i,
      /اغتصب/i,
      /أقتل/i,
      /أضرب/i,
      /أقتلوا/i,
      /أذبح/i,
      /أهين/i,
      /موت/i,
      /اللعنة/i,
      /خنزير/i,
      /ارم/i,
      /قتل/i,
      /تهديد/i,
      /عنف/i,
    ];

    if (forbiddenPatterns.some((p) => p.test(text))) {
      return {
        flagged: true,
        reason: 'Text contains violent or abusive content (local filter).',
      };
    }

    // ---- Safe content ----
    return { flagged: false, reason: 'Clean content' };
  }
}
