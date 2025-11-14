import winston from 'winston';
import type { AppConfig } from '@/config/types.js';

/**
 * Professional logging utility using Winston
 * Provides structured logging with multiple levels and output formats
 */

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  context?: string;
  taskId?: string;
  deviceId?: string;
  duration?: number;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Custom format for log entries
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const logEntry: LogEntry = {
      level: info.level as string,
      message: info.message as string,
      timestamp: info.timestamp as string,
    };

    // Add optional fields if present
    if (info.context) logEntry.context = info.context as string;
    if (info.taskId) logEntry.taskId = info.taskId as string;
    if (info.deviceId) logEntry.deviceId = info.deviceId as string;
    if (info.duration) logEntry.duration = info.duration as number;
    if (info.error) logEntry.error = info.error as Error;
    if (info.metadata && Object.keys(info.metadata as Record<string, unknown>).length > 0) {
      logEntry.metadata = info.metadata as Record<string, unknown>;
    }

    return JSON.stringify(logEntry);
  })
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: 'HH:mm:ss.SSS',
  }),
  winston.format.printf((info) => {
    const timestamp = info.timestamp as string;
    const level = info.level;
    const message = info.message;
    const context = info.context ? `[${info.context}]` : '';
    const taskId = info.taskId ? ` Task:${info.taskId}` : '';
    const deviceId = info.deviceId ? ` Device:${info.deviceId}` : '';
    const duration = info.duration ? ` (${info.duration}ms)` : '';

    return `${timestamp} ${level} ${context}${taskId}${deviceId} ${message}${duration}`;
  })
);

/**
 * Logger class implementing singleton pattern
 */
export class Logger {
  private static instance: winston.Logger;
  private static config: AppConfig;

  private constructor() {}

  /**
   * Initialize logger with configuration
   */
  public static initialize(config: AppConfig): void {
    Logger.config = config;

    const transports: winston.transport[] = [];

    // Console transport for development
    if (process.env.NODE_ENV !== 'production') {
      transports.push(
        new winston.transports.Console({
          level: config.mcp.logLevel,
          format: consoleFormat,
        })
      );
    }

    // File transport for production
    if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE) {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: customFormat,
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        })
      );

      transports.push(
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: customFormat,
          maxsize: 10485760, // 10MB
          maxFiles: 10,
        })
      );
    }

    Logger.instance = winston.createLogger({
      level: config.mcp.logLevel,
      transports,
      exitOnError: false,
      silent: process.env.NODE_ENV === 'test',
    });

    // Handle uncaught exceptions and rejections
    Logger.instance.exceptions.handle(
      new winston.transports.File({
        filename: 'logs/exceptions.log',
        format: customFormat,
      })
    );

    Logger.instance.rejections.handle(
      new winston.transports.File({
        filename: 'logs/rejections.log',
        format: customFormat,
      })
    );
  }

  /**
   * Get logger instance
   */
  public static getInstance(): winston.Logger {
    if (!Logger.instance) {
      throw new Error('Logger not initialized. Call Logger.initialize() first.');
    }
    return Logger.instance;
  }

  /**
   * Log with context
   */
  public static logWithContext(
    level: string,
    message: string,
    context?: string,
    metadata?: Record<string, unknown>
  ): void {
    const logger = Logger.getInstance();
    logger.log(level, message, { context, ...metadata });
  }

  /**
   * Debug logging convenience method
   */
  public static debug(message: string, context?: string, metadata?: Record<string, unknown>): void {
    Logger.logWithContext('debug', message, context, metadata);
  }

  /**
   * Performance logging utility
   */
  public static startTimer(context: string, operation: string): () => void {
    const startTime = Date.now();
    const timerId = `${context}-${operation}-${startTime}`;

    Logger.debug(`Starting ${operation}`, context, { timerId });

    return () => {
      const duration = Date.now() - startTime;
      Logger.debug(`Completed ${operation}`, context, { timerId, duration });
    };
  }
}

// Export convenience functions
export const logInfo = (message: string, context?: string, metadata?: Record<string, unknown>): void => {
  Logger.logWithContext('info', message, context, metadata);
};

export const logWarn = (message: string, context?: string, metadata?: Record<string, unknown>): void => {
  Logger.logWithContext('warn', message, context, metadata);
};

export const logError = (
  message: string,
  error?: Error,
  context?: string,
  metadata?: Record<string, unknown>
): void => {
  Logger.logWithContext('error', message, context, { error: error?.stack, ...metadata });
};

export const logDebug = (message: string, context?: string, metadata?: Record<string, unknown>): void => {
  Logger.logWithContext('debug', message, context, metadata);
};

/**
 * Performance measurement utility
 */
export class PerformanceTimer {
  private readonly startTime: number;
  private readonly context: string;
  private readonly operation: string;

  constructor(context: string, operation: string) {
    this.startTime = Date.now();
    this.context = context;
    this.operation = operation;
  }

  public finish(additionalMetadata?: Record<string, unknown>): number {
    const duration = Date.now() - this.startTime;
    logDebug(`Performance: ${this.operation}`, this.context, {
      operation: this.operation,
      duration,
      ...additionalMetadata,
    });
    return duration;
  }
}