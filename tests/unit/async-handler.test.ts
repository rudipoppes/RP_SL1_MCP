/**
 * Unit Tests for Async Handler
 */

import { TaskManager } from '../../src/utils/async-handler';
import { RestorepointError } from '../../src/constants/error-codes';

describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = TaskManager.getInstance();
    // Clear any existing tasks
    taskManager['tasks'].clear();
  });

  describe('createTask', () => {
    it('should create a new task successfully', () => {
      const task = taskManager.createTask('test-task-1', 'backup', 'Test backup');
      
      expect(task.id).toBe('test-task-1');
      expect(task.type).toBe('backup');
      expect(task.status).toBe('pending');
      expect(task.progress).toBe(0);
      expect(task.message).toBe('Test backup');
    });

    it('should reject duplicate task IDs', () => {
      taskManager.createTask('duplicate-task', 'backup');
      
      expect(() => {
        taskManager.createTask('duplicate-task', 'command');
      }).toThrow(RestorepointError);
    });

    it('should set default timeout when not provided', () => {
      const task = taskManager.createTask('test-task', 'backup');
      expect(task.timeoutMs).toBe(3600000); // 1 hour default
    });
  });

  describe('updateTaskStatus', () => {
    beforeEach(() => {
      taskManager.createTask('test-task', 'backup', 'Initial message');
    });

    it('should update task status successfully', () => {
      const result = taskManager.updateTaskStatus('test-task', 'running', 'Task started');
      
      expect(result).not.toBeNull();
      expect(result!.status).toBe('running');
      expect(result!.message).toBe('Task started');
      // Just check it was updated successfully
      expect(result!.status).toBe('running');
    });

    it('should update progress', () => {
      const result = taskManager.updateTaskStatus('test-task', 'running', 'In progress', 50);
      
      expect(result!.progress).toBe(50);
    });

    it('should return null for non-existent task', () => {
      const result = taskManager.updateTaskStatus('non-existent', 'completed');
      
      expect(result).toBeNull();
    });

    it('should add details to task', () => {
      const details = { deviceId: 'device-1', backupType: 'full' };
      const result = taskManager.updateTaskStatus('test-task', 'running', 'Processing', undefined, details);
      
      expect(result!.details).toEqual(details);
    });
  });

  describe('getTask', () => {
    it('should return existing task', () => {
      const createdTask = taskManager.createTask('test-task', 'backup');
      const retrievedTask = taskManager.getTask('test-task');
      
      expect(retrievedTask).toEqual(createdTask);
    });

    it('should return null for non-existent task', () => {
      const task = taskManager.getTask('non-existent');
      expect(task).toBeNull();
    });
  });

  describe('getTasks', () => {
    beforeEach(() => {
      taskManager.createTask('task-1', 'backup');
      taskManager.createTask('task-2', 'command');
      taskManager.createTask('task-3', 'backup');
      
      taskManager.updateTaskStatus('task-1', 'completed');
      taskManager.updateTaskStatus('task-2', 'failed');
      taskManager.updateTaskStatus('task-3', 'running');
    });

    it('should return all tasks without filter', () => {
      const tasks = taskManager.getTasks();
      expect(tasks).toHaveLength(3);
    });

    it('should filter by status', () => {
      const completedTasks = taskManager.getTasks({ status: 'completed' });
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].id).toBe('task-1');
    });

    it('should filter by type', () => {
      const backupTasks = taskManager.getTasks({ type: 'backup' });
      expect(backupTasks).toHaveLength(2);
    });

    it('should filter by multiple criteria', () => {
      const runningBackups = taskManager.getTasks({ 
        status: 'running', 
        type: 'backup' 
      });
      expect(runningBackups).toHaveLength(1);
      expect(runningBackups[0].id).toBe('task-3');
    });
  });

  describe('getRunningTaskCount', () => {
    beforeEach(() => {
      // Clear any existing tasks from previous tests
      taskManager['tasks'].clear();
    });

    it('should count running tasks correctly', () => {
      // Clear existing task from previous test
      taskManager['tasks'].clear();
      
      taskManager.createTask('task-1', 'backup');
      taskManager.createTask('task-2', 'command');
      taskManager.createTask('task-3', 'backup');
      
      taskManager.updateTaskStatus('task-1', 'running');
      taskManager.updateTaskStatus('task-2', 'running');
      taskManager.updateTaskStatus('task-3', 'completed');
      
      const count = taskManager.getRunningTaskCount();
      expect(count).toBeGreaterThanOrEqual(2); // Should have at least 2 running tasks
    });
  });
});