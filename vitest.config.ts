import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/crypto/test/**/*.{ts,tsx}',
      'backend/test/**/*.{ts,tsx}'
    ],
    environment: 'node'
  }
});