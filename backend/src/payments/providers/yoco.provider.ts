import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import type {
  CardPaymentResultDto,
  InitiateCardPaymentDto,
} from '@astar-pos/shared';

// TODO: switch baseUrl to production when YOCO_ENV=production
const SANDBOX_URL = 'https://sandbox.yoco.com/v1';
const PRODUCTION_URL = 'https://online.yoco.com/v1';

@Injectable()
export class YocoProvider {
  private readonly logger = new Logger(YocoProvider.name);
  private readonly baseUrl: string;
  private readonly secretKey: string;

  constructor(private readonly config: ConfigService) {
    const env = config.get<string>('YOCO_ENV') ?? 'sandbox';
    this.baseUrl = env === 'production' ? PRODUCTION_URL : SANDBOX_URL;
    this.secretKey = config.get<string>('YOCO_SECRET_KEY') ?? '';
  }

  async chargeCard(dto: InitiateCardPaymentDto): Promise<CardPaymentResultDto> {
    try {
      const response = await axios.post<Record<string, unknown>>(
        `${this.baseUrl}/charges`,
        {
          token: dto.reference,
          amountInCents: Math.round(dto.amount * 100),
          currency: dto.currency,
        },
        {
          headers: { Authorization: `Bearer ${this.secretKey}` },
        },
      );

      this.logger.log(`Yoco charge success: ${dto.reference}`);
      return {
        success: true,
        reference: dto.reference,
        provider: 'yoco',
        rawResponse: response.data,
      };
    } catch (err) {
      // NEVER throw — return failure result so the caller decides what to do
      const raw = axios.isAxiosError(err)
        ? ((err.response?.data as Record<string, unknown>) ?? {})
        : {};
      this.logger.error(`Yoco charge failed: ${String(err)}`);
      return {
        success: false,
        reference: '',
        provider: 'yoco',
        rawResponse: raw,
      };
    }
  }
}
