/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^openclaw/plugin-sdk$': '<rootDir>/node_modules/openclaw/dist/plugin-sdk/index',
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        moduleResolution: 'node',
        paths: {},
      },
    },
  },
};
