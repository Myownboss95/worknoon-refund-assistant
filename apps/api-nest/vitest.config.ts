import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC (not the default transformer) so Nest's decorators get `emitDecoratorMetadata`.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/unit/**/*.spec.ts'],
    environment: 'node',
  },
});
