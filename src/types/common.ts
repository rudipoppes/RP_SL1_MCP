/**
 * Shared types used across the MCP server
 * Common interfaces and utilities for consistent type handling
 */

/**
 * Generic result wrapper for operations
 */
export interface OperationResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
    readonly timestamp: string;
  };
  readonly timestamp: string;
}

/**
 * Configuration types
 */
export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly protocol: 'http' | 'https';
  readonly path?: string;
}

/**
 * Logging context
 */
export interface LogContext {
  readonly operation: string;
  readonly component: string;
  readonly requestId?: string;
  readonly userId?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  readonly operation: string;
  readonly duration: number;
  readonly timestamp: string;
  readonly success: boolean;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Cache entry
 */
export interface CacheEntry<T = unknown> {
  readonly key: string;
  readonly value: T;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly accessCount: number;
  readonly lastAccessed: Date;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  readonly limit: number;
  readonly remaining: number;
  readonly resetTime: Date;
  readonly retryAfter?: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
  readonly jitter: boolean;
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  readonly state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  readonly failureCount: number;
  readonly lastFailureTime: Date;
  readonly nextAttemptTime?: Date;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  readonly service: string;
  readonly status: 'healthy' | 'unhealthy' | 'degraded';
  readonly timestamp: string;
  readonly responseTime?: number;
  readonly details?: Record<string, unknown>;
  readonly error?: string;
}

/**
 * System health information
 */
export interface SystemHealth {
  readonly status: 'healthy' | 'unhealthy' | 'degraded';
  readonly timestamp: string;
  readonly checks: readonly HealthCheckResult[];
  readonly uptime: number;
  readonly version: string;
  readonly environment: string;
}

/**
 * Event information
 */
export interface SystemEvent {
  readonly id: string;
  readonly type: string;
  readonly source: string;
  readonly timestamp: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly tags?: readonly string[];
}

/**
 * User session information
 */
export interface UserSession {
  readonly id: string;
  readonly userId?: string;
  readonly createdAt: Date;
  readonly lastAccessed: Date;
  readonly expiresAt: Date;
  readonly metadata?: Record<string, unknown>;
  readonly active: boolean;
}

/**
 * API request information
 */
export interface ApiRequestInfo {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly query?: Record<string, string>;
  readonly body?: unknown;
  readonly timestamp: string;
  readonly userId?: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

/**
 * API response information
 */
export interface ApiResponseInfo {
  readonly requestId: string;
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body?: unknown;
  readonly timestamp: string;
  readonly duration: number;
  readonly success: boolean;
}

/**
 * Task queue information
 */
export interface TaskQueueInfo {
  readonly name: string;
  readonly size: number;
  readonly processing: number;
  readonly completed: number;
  readonly failed: number;
  readonly averageWaitTime: number;
  readonly averageProcessTime: number;
  readonly timestamp: string;
}

/**
 * Memory usage information
 */
export interface MemoryUsage {
  readonly used: number;
  readonly total: number;
  readonly percentage: number;
  readonly heap: {
    readonly used: number;
    readonly total: number;
    readonly limit: number;
  };
  readonly external: number;
  readonly rss: number;
  readonly timestamp: string;
}

/**
 * CPU usage information
 */
export interface CpuUsage {
  readonly user: number;
  readonly system: number;
  readonly idle: number;
  readonly total: number;
  readonly percentage: number;
  readonly timestamp: string;
  readonly cores?: readonly number[];
}

/**
 * System resource usage
 */
export interface SystemResources {
  readonly memory: MemoryUsage;
  readonly cpu: CpuUsage;
  readonly uptime: number;
  readonly loadAverage: readonly number[];
  readonly timestamp: string;
}

/**
 * Version information
 */
export interface VersionInfo {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: string;
  readonly build?: string;
  readonly timestamp: string;
  readonly commit?: string;
}

/**
 * Feature flag information
 */
export interface FeatureFlag {
  readonly name: string;
  readonly enabled: boolean;
  readonly description?: string;
  readonly rolloutPercentage?: number;
  readonly conditions?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Database connection pool metrics
 */
export interface ConnectionPoolMetrics {
  readonly total: number;
  readonly active: number;
  readonly idle: number;
  readonly waiting: number;
  readonly max: number;
  readonly min: number;
  readonly averageWaitTime: number;
  readonly timestamp: string;
}

/**
 * Service dependency information
 */
export interface ServiceDependency {
  readonly name: string;
  readonly url: string;
  readonly status: 'up' | 'down' | 'degraded';
  readonly responseTime?: number;
  readonly lastCheck: string;
  readonly errorRate?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly action: string;
  readonly resource: string;
  readonly userId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly success: boolean;
  readonly details?: Record<string, unknown>;
  readonly changes?: {
    readonly before?: unknown;
    readonly after?: unknown;
  };
}

/**
 * Pagination cursor
 */
export interface Cursor {
  readonly value: string;
  readonly hasMore: boolean;
  readonly next?: string;
  readonly prev?: string;
}

/**
 * Sort configuration
 */
export interface SortConfig {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
  readonly nullsFirst?: boolean;
}

/**
 * Filter configuration
 */
export interface FilterConfig {
  readonly field: string;
  readonly operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startsWith' | 'endsWith';
  readonly value: unknown;
  readonly caseSensitive?: boolean;
}

/**
 * Search configuration
 */
export interface SearchConfig {
  readonly query: string;
  readonly fields?: readonly string[];
  readonly fuzzy?: boolean;
  readonly caseSensitive?: boolean;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  readonly field: string;
  readonly required?: boolean;
  readonly type: string;
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: string;
  readonly enum?: readonly unknown[];
  readonly custom?: (value: unknown) => boolean | string;
}

/**
 * Export configuration
 */
export interface ExportConfig {
  readonly format: 'json' | 'csv' | 'xml' | 'pdf';
  readonly fields?: readonly string[];
  readonly filters?: readonly FilterConfig[];
  readonly sort?: SortConfig;
  readonly pagination?: {
    readonly limit: number;
    readonly offset: number;
  };
}

/**
 * Import configuration
 */
export interface ImportConfig {
  readonly format: 'json' | 'csv' | 'xml';
  readonly mapping?: Record<string, string>;
  readonly validation?: boolean;
  readonly skipErrors?: boolean;
  readonly batchSize?: number;
}

/**
 * WebSocket message
 */
export interface WebSocketMessage {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: string;
  readonly userId?: string;
  readonly sessionId?: string;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  readonly type: 'email' | 'sms' | 'webhook' | 'in-app';
  readonly enabled: boolean;
  readonly recipients: readonly string[];
  readonly template?: string;
  readonly metadata?: Record<string, unknown>;
}