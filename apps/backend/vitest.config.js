const { defineConfig } = require('vitest/config');
const { resolve } = require('path');

// Load .env so tests pick up DATABASE_URL, REDIS_URL, etc.
// from the same .env file the app uses in production.
require('dotenv').config({ path: resolve(__dirname, '.env') });

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.{test,spec}.{js,mjs}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        'src/**/*.test.js',
        'src/**/*.spec.js',
        'src/**/*.test.mjs',
        'src/**/*.spec.mjs',
        'src/__tests__/**',
      ],
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
