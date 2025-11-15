import type { TaskStatus } from '../constants/endpoints.js';
import { ERROR_CODES, RestorepointError } from '../constants/error-codes.js';
import { Logger } from './logger.js';

/**
 * Task information interface
 */
export interface TaskInfo {
  readonly id: string;
  readonly type: 'backup' | 'restore' | 'command' | 'custom';
  status: TaskStatus;
  readonly createdAt: Date;
  updatedAt: Date;
  progress: number; // 0-100
  message: string;
  details?: Record<string, unknown>;
  error?: Error;
  readonly timeoutMs: number;
  readonly onTimeout?: () => void;
  readonly onComplete?: (result: unknown) => void;
  readonly onError?: (error: Error) => void;
}

/**
 * Task creation options
 */
export interface TaskOptions {
  readonly type: TaskInfo['type'];
  readonly timeoutMs?: number;
  readonly onTimeout?: () => void;
  readonly onComplete?: (result: unknown) => void;
  readonly onError?: (error: Error) => void;
}

/**
 * Async operation result
 */
export interface AsyncOperationResult<T = unknown> {
  readonly success: boolean;
  readonly taskId: string;
  readonly message: string;
  readonly estimatedTime?: string;
  readonly data?: T;
}

/**
 * Task manager for handling long-running operations
 * Implements the fire-and-forget pattern with proper cleanup
 */
export class TaskManager {
  private static instance: TaskManager;
  private readonly tasks = new Map<string, TaskInfo>();
  private maxConcurrentTasks: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_TIMEOUT = 3600000; // 1 hour

  private constructor(maxConcurrentTasks: number = 10) {
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.startCleanupInterval();
  }

  /**
   * Singleton pattern implementation
   */
  public static getInstance(maxConcurrentTasks?: number): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager(maxConcurrentTasks);
    }
    return TaskManager.instance;
  }

  /**
   * Create a new task
   */
  public createTask(
    taskId: string,
    type: TaskInfo['type'],
    message: string = 'Task started',
    options: TaskOptions = { type: 'backup' as const }
  ): TaskInfo {
    // Check if task already exists
    if (this.tasks.has(taskId)) {
      throw new RestorepointError(
        ERROR_CODES.TASK_ALREADY_RUNNING,
        `Task with ID ${taskId} is already running`
      );
    }

    // Check concurrent task limit
    if (this.getRunningTaskCount() >= this.maxConcurrentTasks) {
      throw new RestorepointError(
        ERROR_CODES.TASK_LIMIT_EXCEEDED,
        `Maximum concurrent task limit (${this.maxConcurrentTasks}) exceeded`
      );
    }

    const now = new Date();
    const task: TaskInfo = {
      id: taskId,
      type,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      progress: 0,
      message,
      timeoutMs: options.timeoutMs || this.DEFAULT_TIMEOUT,
      onTimeout: options.onTimeout,
      onComplete: options.onComplete,
      onError: options.onError,
    };

    this.tasks.set(taskId, task);
    
    // Set timeout for the task
    this.scheduleTaskTimeout(taskId, task.timeoutMs);

    Logger.logWithContext('info', `Created ${type} task: ${taskId}`, 'TaskManager', {
      taskId,
      type,
      timeout: task.timeoutMs,
    });

    return task;
  }

  /**
   * Update task status
   */
  public updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    message?: string,
    progress?: number,
    details?: Record<string, unknown>
  ): TaskInfo | null {
    const task = this.tasks.get(taskId);
    if (!task) {
      Logger.logWithContext('warn', `Attempted to update non-existent task: ${taskId}`, 'TaskManager');
      return null;
    }

    task.status = status;
    task.updatedAt = new Date();
    
    if (message !== undefined) {
      task.message = message;
    }
    
    if (progress !== undefined) {
      task.progress = Math.max(0, Math.min(100, progress));
    }
    
    if (details) {
      task.details = { ...task.details, ...details };
    }

    Logger.logWithContext('debug', `Updated task ${taskId}: ${status}`, 'TaskManager', {
      taskId,
      status,
      progress,
    });

    // Handle completion
    if (status === 'completed') {
      this.handleTaskCompletion(taskId);
    } else if (status === 'failed' || status === 'cancelled') {
      this.handleTaskError(taskId, new Error(message || 'Task failed'));
    }

    return task;
  }

  /**
   * Get task information
   */
  public getTask(taskId: string): TaskInfo | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get all tasks (optionally filtered by status or type)
   */
  public getTasks(filter?: {
    status?: TaskStatus;
    type?: TaskInfo['type'];
    createdAfter?: Date;
    createdBefore?: Date;
  }): TaskInfo[] {
    const tasks = Array.from(this.tasks.values());

    return tasks.filter(task => {
      if (filter?.status && task.status !== filter.status) return false;
      if (filter?.type && task.type !== filter.type) return false;
      if (filter?.createdAfter && task.createdAt < filter.createdAfter) return false;
      if (filter?.createdBefore && task.createdAt > filter.createdBefore) return false;
      return true;
    });
  }

  /**
   * Get running tasks count
   */
  public getRunningTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Cancel a task
   */
  public cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return false;
    }

    this.updateTaskStatus(taskId, 'cancelled', 'Task was cancelled');
    return true;
  }

  /**
   * Delete a task (only if completed/failed/cancelled)
   */
  public deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === 'pending' || task.status === 'running') {
      throw new RestorepointError(
        ERROR_CODES.TASK_ALREADY_RUNNING,
        'Cannot delete a running task. Cancel it first.'
      );
    }

    this.tasks.delete(taskId);
    Logger.logWithContext('debug', `Deleted completed task: ${taskId}`, 'TaskManager');
    return true;
  }

  /**
   * Create async operation result
   */
  public createAsyncResult<T>(
    taskId: string,
    message: string,
    estimatedTime?: string,
    data?: T
  ): AsyncOperationResult<T> {
    return {
      success: true,
      taskId,
      message,
      estimatedTime,
      data,
    };
  }

  /**
   * Schedule timeout for a task
   */
  private scheduleTaskTimeout(taskId: string, timeoutMs: number): void {
    setTimeout(() => {
      const task = this.tasks.get(taskId);
      if (task && (task.status === 'pending' || task.status === 'running')) {
        Logger.logWithContext('warn', `Task ${taskId} timed out after ${timeoutMs}ms`, 'TaskManager');
        
        if (task.onTimeout) {
          task.onTimeout();
        }
        
        this.updateTaskStatus(taskId, 'timeout', `Task timed out after ${timeoutMs}ms`);
        this.handleTaskError(taskId, new Error(`Task timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
  }

  /**
   * Handle task completion
   */
  private handleTaskCompletion(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.onComplete) {
      try {
        task.onComplete(task.details);
      } catch (error) {
        Logger.logWithContext('error', 'Error in task completion callback', 'TaskManager', {
          taskId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Handle task error
   */
  private handleTaskError(taskId: string, error: Error): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.error = error;
      if (task.onError) {
        try {
          task.onError(error);
        } catch (callbackError) {
          Logger.logWithContext('error', 'Error in task error callback', 'TaskManager', {
            taskId,
            error: callbackError instanceof Error ? callbackError.message : 'Unknown error',
          });
        }
      }
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupCompletedTasks();
    }, 300000); // 5 minutes
  }

  /**
   * Clean up completed tasks older than 24 hours
   */
  private cleanupCompletedTasks(): void {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    for (const [taskId, task] of this.tasks.entries()) {
      const isCompleted = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled';
      const isOld = task.updatedAt < twentyFourHoursAgo;
      
      if (isCompleted && isOld) {
        this.tasks.delete(taskId);
        Logger.logWithContext('debug', `Cleaned up old task: ${taskId}`, 'TaskManager');
      }
    }
  }

  /**
   * Shutdown task manager
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Cancel all running tasks
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'pending' || task.status === 'running') {
        this.cancelTask(taskId);
      }
    }

    Logger.logWithContext('info', 'TaskManager shutdown complete', 'TaskManager');
  }
}

/**
 * Export singleton instance
 */
export const taskManager = TaskManager.getInstance();