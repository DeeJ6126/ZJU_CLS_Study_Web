import { defineConfig, devices } from '@playwright/test';

const devCommand = process.platform === 'win32' ? 'npm.cmd run dev' : 'npm run dev';
const useExternalServer = process.env.HARNESS_EXTERNAL_SERVER === 'true';

export default defineConfig({
  testDir: './harness/evaluators/browser',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: 'harness/artifacts/playwright',
  webServer: useExternalServer ? undefined : {
    command: devCommand,
    url: 'http://127.0.0.1:5174/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
