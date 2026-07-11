import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const defaultRootDir = path.resolve(new URL('../..', import.meta.url).pathname);

export function normalizeRoot(rootDir = defaultRootDir) {
  return path.resolve(rootDir);
}

export function resolveFromRoot(rootDir, relativePath) {
  return path.resolve(normalizeRoot(rootDir), relativePath);
}

export async function readText(rootDir, relativePath) {
  return readFile(resolveFromRoot(rootDir, relativePath), 'utf8');
}

export async function readJson(rootDir, relativePath) {
  return JSON.parse((await readText(rootDir, relativePath)).replace(/^\uFEFF/, ''));
}

export async function listFiles(rootDir, relativePath, predicate = () => true) {
  const root = normalizeRoot(rootDir);
  const start = resolveFromRoot(root, relativePath);
  const found = [];

  async function walk(currentPath) {
    const currentStat = await stat(currentPath);

    if (currentStat.isFile()) {
      const relativeFile = path.relative(root, currentPath).replaceAll(path.sep, '/');
      if (predicate(relativeFile)) {
        found.push(relativeFile);
      }
      return;
    }

    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (['.git', 'node_modules', 'dist'].includes(entry.name)) {
        continue;
      }

      await walk(path.join(currentPath, entry.name));
    }
  }

  await walk(start);
  return found.sort();
}

export function createResult({ name, command = '', ok, checked = {}, failures = [], suggestions = [] }) {
  return {
    name,
    command,
    ok: failures.length === 0 && Boolean(ok),
    checked,
    failures,
    suggestions,
  };
}

export function isDirectRun(metaUrl) {
  return process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href;
}

export function printCliResult(result) {
  const json = JSON.stringify(result, null, 2);
  if (result.ok) {
    console.log(json);
  } else {
    console.error(json);
  }
  process.exitCode = result.ok ? 0 : 1;
}

export function truncateText(value, maxLength = 4000) {
  const text = String(value ?? '');
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
}

