import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
const mockGetRequest = jest.fn().mockReturnValue({
  correlationId: 'test-correlation-id',
  method: 'GET',
  path: '/api/v1/test',
});
const mockHost = {
  switchToHttp: () => ({
    getResponse: mockGetResponse,
    getRequest: mockGetRequest,
  }),
} as unknown as ArgumentsHost;

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    jest.clearAllMocks();
    mockStatus.mockReturnValue({ json: mockJson });
  });

  it('should return consistent error shape for HttpException', () => {
    filter.catch(
      new HttpException('Not found', HttpStatus.NOT_FOUND),
      mockHost,
    );

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        correlationId: 'test-correlation-id',
        path: '/api/v1/test',
        timestamp: expect.any(String) as string,
      }),
    );
  });

  it('should return 500 for unhandled errors', () => {
    filter.catch(new Error('Something exploded'), mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500 }),
    );
  });

  it('should include correlationId in response', () => {
    filter.catch(new HttpException('Bad Request', 400), mockHost);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'test-correlation-id' }),
    );
  });

  it('should not expose stack trace when NODE_ENV is production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    filter.catch(new Error('prod error'), mockHost);

    const calls = mockJson.mock.calls as Array<[Record<string, unknown>]>;
    expect('stack' in calls[0][0]).toBe(false);

    process.env.NODE_ENV = original;
  });

  it('should log the full error internally regardless of environment', () => {
    const logger = (filter as unknown as Record<string, { error: jest.Mock }>)[
      'logger'
    ];
    const logSpy = jest
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);

    filter.catch(new Error('internal error'), mockHost);

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
