import { spawnSync } from 'node:child_process';
import { checkArchitecture } from './check-architecture.mjs';
import { checkContentLocation } from './check-content-location.mjs';
import { checkRoutes } from './check-routes.mjs';
import { checkThemes } from './check-themes.mjs';
import { buildReport, writeReport } from './collect-report.mjs';
import { createResult, truncateText } from './lib.mjs';

function runCommand(command) {
  const executableCommand = process.platform === 'win32'
    ? command.replace(/^npm(?=\s)/, 'npm.cmd')
    : command;
  const completed = spawnSync(executableCommand, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
  });
  const output = `${completed.stdout ?? ''}${completed.stderr ?? ''}`;

  return createResult({
    name: command,
    command: executableCommand,
    ok: completed.status === 0,
    checked: { exitCode: completed.status },
    failures: completed.status === 0
      ? []
      : [{
        message: truncateText(output),
        suggestion: `Run ${command} locally and fix the reported failure.`,
      }],
    suggestions: completed.status === 0 ? [] : [`Run ${command} locally and fix the reported failure.`],
  });
}

function getGitCommit() {
  const completed = spawnSync('git rev-parse --short HEAD', {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
  });
  return completed.status === 0 ? completed.stdout.trim() : '';
}

async function main() {
  const startedAt = new Date().toISOString();
  const results = [
    runCommand('npm test'),
    runCommand('npm run build'),
    await checkArchitecture(),
    await checkRoutes(),
    await checkContentLocation(),
    await checkThemes(),
  ];
  const endedAt = new Date().toISOString();
  const report = buildReport({
    startedAt,
    endedAt,
    gitCommit: getGitCommit(),
    results,
  });
  const paths = await writeReport(report);

  console.log(JSON.stringify({
    ok: report.ok,
    status: report.status,
    report: paths,
    nextSteps: report.nextSteps,
  }, null, 2));

  process.exitCode = report.ok ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
