import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Request');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { correlationId?: string }>();
    const correlationId = req.correlationId ?? 'unknown';
    const start = Date.now();

    this.logger.debug(`[${correlationId}] → ${req.method} ${req.path}`);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.debug(`[${correlationId}] ← ${Date.now() - start}ms`);
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `[${correlationId}] ✗ ${Date.now() - start}ms — ${message}`,
          );
        },
      }),
    );
  }
}
