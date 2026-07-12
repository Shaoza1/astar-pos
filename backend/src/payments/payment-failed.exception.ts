import { HttpException, HttpStatus } from '@nestjs/common';

export class PaymentFailedException extends HttpException {
  constructor(provider: string, details: Record<string, unknown>) {
    super(
      { message: `Card payment failed via ${provider}`, details },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
