import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx']
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['test/setup.ts'],
          include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
          // The published @tightknitai/slack-block-kit-validator dist uses
          // extension-less ESM imports between its files. Node's ESM
          // resolver rejects those; Vite's does not. Inlining the package
          // routes its imports through Vite so the helper modules resolve.
          server: {
            deps: {
              inline: ['@tightknitai/slack-block-kit-validator']
            }
          }
        }
      },
      {
        plugins: [tailwindcss(), storybookTest({ configDir: `${dirname}.storybook` })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }]
          }
        }
      }
    ]
  }
});
