import { defaultThemeId, themes } from '../../src/data/config/themes.js';
import { createResult, isDirectRun, printCliResult, readJson, readText } from './lib.mjs';

function getCssBlock(cssText, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  return cssText.match(pattern)?.[1] ?? '';
}

function hasToken(block, token) {
  return new RegExp(`${token}:\\s*[^;]+;`).test(block);
}

export async function checkThemes({ rootDir = process.cwd() } = {}) {
  const policy = await readJson(rootDir, 'harness/policies/theme-coverage.json');
  const expected = await readJson(rootDir, 'harness/datasets/theme-cases.json');
  const cssText = await readText(rootDir, 'src/styles/base.css');
  const themeIds = themes.map((theme) => theme.id);
  const failures = [];

  for (const expectedThemeId of expected.themeIds) {
    if (!themeIds.includes(expectedThemeId)) {
      failures.push({
        file: 'src/data/config/themes.js',
        message: `Missing configured theme: ${expectedThemeId}`,
        suggestion: 'Keep theme data, CSS selectors, and project-check theme dataset aligned.',
      });
    }
  }

  for (const theme of themes) {
    const selector = theme.id === defaultThemeId
      ? policy.defaultThemeSelector
      : policy.themeSelectorTemplate.replace('{themeId}', theme.id);
    const block = getCssBlock(cssText, selector);

    if (!block) {
      failures.push({
        file: 'src/styles/base.css',
        message: `Missing CSS block for ${selector}.`,
        suggestion: 'Add a theme CSS block with the required core tokens.',
      });
      continue;
    }

    for (const token of policy.requiredTokens) {
      if (!hasToken(block, token)) {
        failures.push({
          file: 'src/styles/base.css',
          message: `${selector} does not define ${token}.`,
          suggestion: 'Define core layout, resource, and detail tokens for every theme.',
        });
      }
    }
  }

  return createResult({
    name: 'themes',
    command: 'npm run check:themes',
    ok: failures.length === 0,
    checked: {
      themeIds,
      requiredTokens: policy.requiredTokens.length,
    },
    failures,
    suggestions: failures.length ? ['Keep src/data/config/themes.js, base.css, and the theme-check dataset synchronized.'] : [],
  });
}

if (isDirectRun(import.meta.url)) {
  checkThemes().then(printCliResult).catch((error) => {
    printCliResult(createResult({
      name: 'themes',
      command: 'npm run check:themes',
      ok: false,
      failures: [{ message: error.message }],
      suggestions: ['Check theme coverage policy and base.css.'],
    }));
  });
}

