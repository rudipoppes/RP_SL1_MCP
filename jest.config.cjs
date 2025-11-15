module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)\\.(js|ts)$': '<rootDir>/src/$1.ts',
    '^@/(.*)$': '<rootDir>/src/$1.ts',
    // Add mappings for relative imports that Jest can't resolve
    '^../constants/(.*)$': '<rootDir>/src/constants/$1.ts',
    '^../config/(.*)$': '<rootDir>/src/config/$1.ts',
    '^../utils/(.*)$': '<rootDir>/src/utils/$1.ts',
    '^../auth/(.*)$': '<rootDir>/src/auth/$1.ts',
    '^../tools/(.*)$': '<rootDir>/src/tools/$1.ts',
    '^../types/(.*)$': '<rootDir>/src/types/$1.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*)\\.mjs$)'
  ],
  testTimeout: 30000,
  verbose: true
};