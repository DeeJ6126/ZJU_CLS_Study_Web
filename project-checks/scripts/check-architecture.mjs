import { createResult, isDirectRun, listFiles, printCliResult, readJson, readText } from './lib.mjs';

export async function checkArchitecture({ rootDir = process.cwd() } = {}) {
  const policy = await readJson(rootDir, 'project-checks/policies/file-boundaries.json');
  const failures = [];
  let checkedRules = 0;

  for (const rule of policy.rules) {
    checkedRules += 1;
    const files = rule.path.endsWith('.js') || rule.path.endsWith('.vue')
      ? [rule.path]
      : await listFiles(rootDir, rule.path, (file) => file.endsWith('.js') || file.endsWith('.vue'));

    for (const file of files) {
      const text = await readText(rootDir, file);

      for (const token of rule.mustContain ?? []) {
        if (!text.includes(token)) {
          failures.push({
            file,
            message: `Missing required token: ${token}`,
            suggestion: rule.suggestion,
          });
        }
      }

      for (const token of rule.mustNotContain ?? []) {
        if (text.includes(token)) {
          failures.push({
            file,
            message: `Forbidden token found: ${token}`,
            suggestion: rule.suggestion,
          });
        }
      }
    }
  }

  const resourceData = await readText(rootDir, 'src/data/courses/resourceData.js');
  if (!resourceData.includes('publicAssetPath')) {
    failures.push({
      file: 'src/data/courses/resourceData.js',
      message: 'Resource data loading does not use publicAssetPath.',
      suggestion: 'Route public fetches through src/utils/publicPath.js for GitHub Pages compatibility.',
    });
  }

  return createResult({
    name: 'architecture',
    command: 'npm run check:architecture',
    ok: failures.length === 0,
    checked: {
      rules: checkedRules + 1,
    },
    failures,
    suggestions: failures.length ? ['Keep display components thin and move shared rules into services/data helpers.'] : [],
  });
}

if (isDirectRun(import.meta.url)) {
  checkArchitecture().then(printCliResult).catch((error) => {
    printCliResult(createResult({
      name: 'architecture',
      command: 'npm run check:architecture',
      ok: false,
      failures: [{ message: error.message }],
      suggestions: ['Check file-boundary policy and source paths.'],
    }));
  });
}

