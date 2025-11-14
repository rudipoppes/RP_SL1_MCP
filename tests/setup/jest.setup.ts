/**
 * Jest Setup Configuration
 * Global test configuration and mocks
 */

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to silence specific methods during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';

// Mock axios to prevent actual network calls
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
  isAxiosError: jest.fn(() => false),
}));

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    exceptions: {
      handle: jest.fn(),
    },
    rejections: {
      handle: jest.fn(),
    },
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Initialize Logger mock
beforeEach(() => {
  const { Logger } = require('../../src/utils/logger');
  Logger.initialize({
    mcp: {
      serverName: 'Test-Server',
      version: '1.0.0',
      logLevel: 'info',
      maxConcurrentTasks: 10,
    },
    restorepoint: {
      serverUrl: 'https://test.com',
      apiVersion: 'v2',
      token: 'test-token',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    },
    async: {
      maxConcurrentTasks: 10,
      taskTimeout: 3600000,
      cleanupInterval: 300000,
    }
  });
});

// Global test timeout
jest.setTimeout(30000);

// Cleanup after all tests
afterEach(() => {
  // Clear any running tasks to prevent hanging
  const { TaskManager } = require('../../src/utils/async-handler');
  try {
    const taskManager = TaskManager.getInstance();
    taskManager.shutdown();
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Force exit after tests complete
afterAll(() => {
  setTimeout(() => {
    process.exit(0);
  }, 100);
});