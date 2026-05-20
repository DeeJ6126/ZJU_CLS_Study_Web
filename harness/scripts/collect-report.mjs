import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createResult, isDirectRun, normalizeRoot, printCliResult } from './lib.mjs';

function timestampForFile(date = new Date()) {
  return date.toISOString().slice(0, 16).replace('T', '_').replace(':', '');
}

export function buildReport({
  rootDir = process.cwd(),
  startedAt = new Date().toISOString(),
  endedAt = new Date().toISOString(),
  gitCommit = '',
  results = [],
  artifacts = [],
} = {}) {
  const ok = results.every((result) => result.ok);
  const failed = results.filter((result) => !result.ok);

  return {
    project: 'life-science-study-platform',
    rootDir: normalizeRoot(rootDir),
    ok,
    status: ok ? 'passed' : 'failed',
    startedAt,
    endedAt,
    gitCommit,
    results,
    artifacts,
    nextSteps: ok
      ? ['Harness checks passed. Continue with implementation or CI handoff.']
      : failed.map((result) => `Fix ${result.name}: ${result.failures[0]?.suggestion ?? 'inspect failures'}`),
  };
}

export function formatMarkdownReport(report) {
  const resultLines = report.results.map((result) => {
    const icon = result.ok ? 'PASS' : 'FAIL';
    const failures = result.failures.length
      ? result.failures.map((failure) => `  - ${failure.file ? `${failure.file}: ` : ''}${failure.message}`).join('\n')
      : '  - No failures';
    return `### ${icon} ${result.name}\n\nCommand: \`${result.command || 'n/a'}\`\n\n${failures}`;
  }).join('\n\n');

  return `# Harness Report\n\n- Status: ${report.status}\n- Git commit: ${report.gitCommit || 'unknown'}\n- Started: ${report.startedAt}\n- Ended: ${report.endedAt}\n\n## Results\n\n${resultLines}\n\n## Next Steps\n\n${report.nextSteps.map((step) => `- ${step}`).join('\n')}\n`;
}

export async function writeReport(report, { rootDir = process.cwd(), reportsDir = 'harness/reports' } = {}) {
  const timestamp = timestampForFile(new Date(report.endedAt));
  const dir = path.resolve(normalizeRoot(rootDir), reportsDir);
  await mkdir(dir, { recursive: true });

  const jsonPath = path.join(dir, `${timestamp}.json`);
  const mdPath = path.join(dir, `${timestamp}.md`);

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(mdPath, formatMarkdownReport(report), 'utf8');

  return { jsonPath, mdPath };
}

if (isDirectRun(import.meta.url)) {
  const report = buildReport({
    results: [
      createResult({
        name: 'manual-report',
        command: 'npm run harness:report',
        ok: true,
        checked: { note: 'Use npm run harness to collect real checks.' },
      }),
    ],
  });

  writeReport(report).then((paths) => {
    printCliResult(createResult({
      name: 'report',
      command: 'npm run harness:report',
      ok: true,
      checked: paths,
    }));
  }).catch((error) => {
    printCliResult(createResult({
      name: 'report',
      command: 'npm run harness:report',
      ok: false,
      failures: [{ message: error.message }],
    }));
  });
}
