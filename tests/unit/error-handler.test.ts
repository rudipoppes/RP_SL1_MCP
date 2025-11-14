/**
 * Unit Tests for Error Handler
 */

import { errorHandler } from '../../src/utils/error-handler';
import { RestorepointError } from '../../src/constants/error-codes';

describe('ErrorHandler', () => {
  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      const retryableError = new RestorepointError(
        'NETWORK_TIMEOUT',
        'Request timed out',
        408
      );
      
      expect(errorHandler.isRetryableError(retryableError)).toBe(true);
    });

    it('should not retry non-retryable errors', () => {
      const nonRetryableError = new RestorepointError(
        'VALIDATION_INVALID_INPUT',
        'Invalid input provided',
        400
      );
      
      expect(errorHandler.isRetryableError(nonRetryableError)).toBe(false);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff with jitter', () => {
      const delay1 = errorHandler.calculateRetryDelay(0, 1000, 10000);
      const delay2 = errorHandler.calculateRetryDelay(1, 1000, 10000);
      
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThan(1200); // Base + 10% jitter
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThan(2400); // Base * 2 + jitter
    });

    it('should handle high attempt numbers', () => {
      const delay = errorHandler.calculateRetryDelay(10, 1000, 60000);
      expect(delay).toBeGreaterThan(1000); // Should be exponential
      expect(delay).toBeLessThan(70000); // Reasonable upper bound
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await errorHandler.retryWithBackoff(mockFn, 3, 1000);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleError', () => {
    it('should create error response', () => {
      const error = new RestorepointError('TEST_ERROR', 'Test message', 400);
      const response = errorHandler.handleError(error);
      
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('TEST_ERROR');
      expect(response.error?.message).toBe('Test message');
      expect(response.error?.timestamp).toBeDefined();
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response', () => {
      const data = { id: 1, name: 'Test' };
      const response = errorHandler.createSuccessResponse(data, 'Success message');
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.message).toBe('Success message');
    });
  });
});