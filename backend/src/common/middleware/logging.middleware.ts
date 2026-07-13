import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = crypto.randomUUID();
    const start = Date.now();

    (req as Request & { correlationId: string }).correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    res.on('finish', () => {
      const duration = Date.now() - start;
      if (process.env.NODE_ENV === 'production') {
        this.logger.log(
          JSON.stringify({
            correlationId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration_ms: duration,
          }),
        );
      } else {
        this.logger.log(
          `[${correlationId}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
        );
      }
    });

    next();
  }
}
