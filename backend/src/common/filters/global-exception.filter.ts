import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { correlationId?: string }>();
    const res = ctx.getResponse<Response>();

    const correlationId = req.correlationId ?? 'unknown';
    const isProduction = process.env.NODE_ENV === 'production';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message =
          (Array.isArray(b['message'])
            ? b['message'].join(', ')
            : (b['message'] as string)) ?? message;
        error = (b['error'] as string) ?? HttpStatus[statusCode] ?? error;
      }
      error =
        error === 'Internal Server Error'
          ? (HttpStatus[statusCode] ?? error)
          : error;
    }

    // Always log full error internally with correlationId
    const stack =
      exception instanceof Error ? exception.stack : String(exception);
    this.logger.error(
      `[${correlationId}] ${statusCode} ${req.method} ${req.path} — ${message}`,
      stack,
    );

    res.status(statusCode).json({
      statusCode,
      error,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      path: req.path,
      ...(isProduction
        ? {}
        : { stack: exception instanceof Error ? exception.stack : undefined }),
    });
  }
}
