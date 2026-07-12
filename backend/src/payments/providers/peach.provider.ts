import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import type {
  CardPaymentResultDto,
  InitiateCardPaymentDto,
} from '@astar-pos/shared';

// TODO: switch to production URL when PEACH_ENV=production
const SANDBOX_URL = 'https://testsecure.peachpayments.com/v1';
const PRODUCTION_URL = 'https://secure.peachpayments.com/v1';

@Injectable()
export class PeachProvider {
  private readonly logger = new Logger(PeachProvider.name);
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly entityId: string;

  constructor(private readonly config: ConfigService) {
    const env = config.get<string>('PEACH_ENV') ?? 'sandbox';
    this.baseUrl = env === 'production' ? PRODUCTION_URL : SANDBOX_URL;
    this.accessToken = config.get<string>('PEACH_ACCESS_TOKEN') ?? '';
    this.entityId = config.get<string>('PEACH_ENTITY_ID') ?? '';
  }

  async chargeCard(dto: InitiateCardPaymentDto): Promise<CardPaymentResultDto> {
    try {
      const response = await axios.post<Record<string, unknown>>(
        `${this.baseUrl}/payments`,
        {
          entityId: this.entityId,
          amount: (Math.round(dto.amount * 100) / 100).toFixed(2),
          currency: dto.currency,
          paymentType: 'DB',
          merchantTransactionId: dto.reference,
        },
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      );

      this.logger.log(`Peach charge success: ${dto.reference}`);
      return {
        success: true,
        reference: dto.reference,
        provider: 'peach',
        rawResponse: response.data,
      };
    } catch (err) {
      // NEVER throw — return failure result
      const raw = axios.isAxiosError(err)
        ? ((err.response?.data as Record<string, unknown>) ?? {})
        : {};
      this.logger.error(`Peach charge failed: ${String(err)}`);
      return {
        success: false,
        reference: '',
        provider: 'peach',
        rawResponse: raw,
      };
    }
  }
}
