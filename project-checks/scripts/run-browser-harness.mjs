import { spawnSync } from 'node:child_process';
import http from 'node:http';
import { createResult, printCliResult } from './lib.mjs';

async function ensurePlaywrightInstalled() {
  try {
    await import('@playwright/test');
    return true;
  } catch (error) {
    return false;
  }
}

function isServerReady(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const installed = await ensurePlaywrightInstalled();

  if (!installed) {
    printCliResult(createResult({
      name: 'browser',
      command: 'npm run check:browser',
      ok: false,
      failures: [{
        message: '@playwright/test is not installed in this workspace.',
        suggestion: 'Run npm.cmd install -D @playwright/test, then npm.cmd run check:browser.',
      }],
      suggestions: [
        'Run npm.cmd install -D @playwright/test.',
        'If Chromium is missing afterward, run npx playwright install chromium.',
      ],
    }));
    return;
  }

  const url = 'http://127.0.0.1:5174/';
  const ready = await isServerReady(url);

  if (!ready) {
    printCliResult(createResult({
      name: 'browser',
      command: 'npm run check:browser',
      ok: false,
      failures: [{
        message: `No dev server is listening at ${url}.`,
        suggestion: 'Start npm.cmd run dev in another terminal, then run npm.cmd run check:browser.',
      }],
      suggestions: [
        'Terminal 1: npm.cmd run dev',
        'Terminal 2: npm.cmd run check:browser',
      ],
    }));
    return;
  }

  const completed = spawnSync('npx playwright test project-checks/evaluators/browser', {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      HARNESS_EXTERNAL_SERVER: 'true',
    },
  });

  process.exitCode = completed.status ?? 1;
}

main().catch((error) => {
  printCliResult(createResult({
    name: 'browser',
    command: 'npm run check:browser',
    ok: false,
    failures: [{ message: error.message }],
    suggestions: ['Check Playwright installation and browser artifacts.'],
  }));
});

