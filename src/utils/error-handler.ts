import type { RestorepointError } from '../constants/error-codes.js';
import { ERROR_CODES, RestorepointError as RestorepointErrorClass } from '../constants/error-codes.js';
import { HTTP_STATUS_CODES } from '../constants/endpoints.js';
import { Logger } from './logger.js';

/**
 * Error response structure for consistent API responses
 */
export interface ErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
    readonly timestamp: string;
    readonly requestId?: string;
  };
}

/**
 * Success response structure for consistent API responses
 */
export interface SuccessResponse<T = unknown> {
  readonly success: true;
  readonly data: T;
  readonly message?: string;
  readonly timestamp: string;
}

/**
 * Error handling utility with centralized error processing
 */
export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  /**
   * Singleton pattern implementation
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and log errors consistently
   */
  public handleError(error: unknown, context?: string, additionalInfo?: Record<string, unknown>): ErrorResponse {
    const timestamp = new Date().toISOString();
    let restorepointError: RestorepointError;

    if (error instanceof RestorepointErrorClass) {
      restorepointError = error;
    } else if (error instanceof Error) {
      restorepointError = new RestorepointErrorClass(
        ERROR_CODES.SYSTEM_INTERNAL_ERROR,
        error.message,
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        { originalError: error.name, stack: error.stack, ...additionalInfo }
      );
    } else {
      restorepointError = new RestorepointErrorClass(
        ERROR_CODES.SYSTEM_INTERNAL_ERROR,
        'Unknown error occurred',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        { unknownError: String(error), ...additionalInfo }
      );
    }

    // Log the error
    Logger.logWithContext('error', restorepointError.message, context, {
      errorCode: restorepointError.code,
      statusCode: restorepointError.statusCode,
      details: restorepointError.details,
      ...additionalInfo,
    });

    // Return standardized error response
    return {
      success: false,
      error: {
        code: restorepointError.code,
        message: restorepointError.message,
        details: restorepointError.details,
        timestamp,
      },
    };
  }

  /**
   * Create success response
   */
  public createSuccessResponse<T>(data: T, message?: string): SuccessResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Wrap async function with error handling
   */
  public async withErrorHandling<T>(
    fn: () => Promise<T>,
    context?: string,
    additionalInfo?: Record<string, unknown>
  ): Promise<SuccessResponse<T> | ErrorResponse> {
    try {
      const result = await fn();
      return this.createSuccessResponse(result);
    } catch (error) {
      return this.handleError(error, context, additionalInfo);
    }
  }

  /**
   * Check if error is retryable
   */
  public isRetryableError(error: RestorepointError): boolean {
    const retryableCodes: readonly string[] = [
      ERROR_CODES.NETWORK_TIMEOUT,
      ERROR_CODES.NETWORK_RATE_LIMITED,
      ERROR_CODES.NETWORK_SERVER_ERROR,
      ERROR_CODES.NETWORK_UNAVAILABLE,
      ERROR_CODES.SYSTEM_MAINTENANCE_MODE,
    ];

    return retryableCodes.includes(error.code as string);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  public calculateRetryDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.round(exponentialDelay + jitter);
  }

  /**
   * Retry async function with exponential backoff
   */
  public async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000,
    context?: string
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        const restorepointError = lastError instanceof RestorepointErrorClass 
          ? lastError 
          : new RestorepointErrorClass(
              ERROR_CODES.SYSTEM_INTERNAL_ERROR,
              lastError.message,
              HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
            );

        // Don't retry if this is the last attempt or error is not retryable
        if (attempt === maxAttempts - 1 || !this.isRetryableError(restorepointError)) {
          throw lastError;
        }

        const delay = this.calculateRetryDelay(attempt, baseDelay);
        
        Logger.logWithContext('warn', `Retrying operation after ${delay}ms`, context, {
          attempt: attempt + 1,
          maxAttempts,
          errorCode: restorepointError.code,
        });

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create circuit breaker pattern wrapper
   */
  public createCircuitBreaker<T>(
    fn: () => Promise<T>,
    options: {
      failureThreshold?: number;
      resetTimeout?: number;
      monitoringPeriod?: number;
    } = {}
  ): () => Promise<T> {
    const {
      failureThreshold = 5,
      resetTimeout = 60000, // 1 minute
      monitoringPeriod = 10000, // 10 seconds
    } = options;

    let failureCount = 0;
    let lastFailureTime = 0;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    return async (): Promise<T> => {
      const now = Date.now();

      // Check if we should reset the circuit breaker
      if (state === 'OPEN' && now - lastFailureTime > resetTimeout) {
        state = 'HALF_OPEN';
        failureCount = 0;
        Logger.logWithContext('info', 'Circuit breaker entering HALF_OPEN state', 'CircuitBreaker');
      }

      // If circuit is open, fail fast
      if (state === 'OPEN') {
        throw new RestorepointErrorClass(
          ERROR_CODES.NETWORK_UNAVAILABLE,
          'Circuit breaker is OPEN - service temporarily unavailable',
          HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
        );
      }

      try {
        const result = await fn();
        
        // Success: reset failure count and close circuit if half-open
        if (failureCount > 0) {
          failureCount = 0;
          if (state === 'HALF_OPEN') {
            state = 'CLOSED';
            Logger.logWithContext('info', 'Circuit breaker CLOSED after successful request', 'CircuitBreaker');
          }
        }
        
        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = now;

        // Check if we should open the circuit
        if (failureCount >= failureThreshold) {
          state = 'OPEN';
          Logger.logWithContext('warn', 'Circuit breaker OPENED due to repeated failures', 'CircuitBreaker', {
            failureCount,
            threshold: failureThreshold,
          });
        }

        throw error;
      }
    };
  }
}

/**
 * Export singleton instance for convenience
 */
export const errorHandler = ErrorHandler.getInstance();

/**
 * Convenience function for error handling
 */
export const handle_error = (
  error: unknown,
  context?: string,
  additionalInfo?: Record<string, unknown>
): ErrorResponse => {
  return errorHandler.handleError(error, context, additionalInfo);
};

/**
 * Convenience function for wrapping async functions
 */
export const with_error_handling = <T>(
  fn: () => Promise<T>,
  context?: string,
  additionalInfo?: Record<string, unknown>
): Promise<SuccessResponse<T> | ErrorResponse> => {
  return errorHandler.withErrorHandling(fn, context, additionalInfo);
};

/**
 * Type guard to check if response is an error
 */
export const is_error_response = (response: unknown): response is ErrorResponse => {
  return typeof response === 'object' && 
         response !== null && 
         'success' in response && 
         response.success === false;
};

/**
 * Type guard to check if response is a success
 */
export const is_success_response = <T = unknown>(response: unknown): response is SuccessResponse<T> => {
  return typeof response === 'object' && 
         response !== null && 
         'success' in response && 
         response.success === true;
};