import { defineConfig } from '@playwright/test';

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ??
      process.env.VERCEL_PREVIEW_URL ??
      'http://localhost:3000',
    ...(bypass
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': bypass,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
  },
});
