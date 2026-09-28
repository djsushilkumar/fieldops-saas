import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@fieldops/types': path.resolve(__dirname, './packages/types/src/index.ts'),
      '@fieldops/validation': path.resolve(__dirname, './packages/validation/src/index.ts'),
      '@fieldops/config': path.resolve(__dirname, './packages/config/src/index.ts'),
      '@fieldops/api': path.resolve(__dirname, './packages/api/src/index.ts'),
      '@fieldops/design-tokens': path.resolve(__dirname, './packages/design-tokens/src/index.ts'),
    },
  },
});
