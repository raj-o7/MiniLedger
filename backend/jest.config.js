/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/loadEnv.ts'],
  // Integration tests share one database, so run test files one at a time.
  maxWorkers: 1,
};
