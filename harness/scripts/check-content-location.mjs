import path from 'node:path';
import { createResult, isDirectRun, listFiles, printCliResult, readJson, readText } from './lib.mjs';

const cjkPattern = /[\u3400-\u9fff]/g;
const literalPattern = /(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g;

function countCjk(text) {
  return (text.match(cjkPattern) ?? []).length;
}

export async function checkContentLocation({ rootDir = process.cwd() } = {}) {
  const policy = await readJson(rootDir, 'harness/policies/content-location.json');
  const scanFiles = [];

  for (const scanRoot of policy.scanRoots) {
    if (path.extname(scanRoot)) {
      scanFiles.push(scanRoot);
    } else {
      const files = await listFiles(rootDir, scanRoot, (file) => file.endsWith('.vue') || file.endsWith('.js'));
      scanFiles.push(...files);
    }
  }

  const failures = [];

  for (const file of [...new Set(scanFiles)]) {
    const text = await readText(rootDir, file);
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (countCjk(line) > policy.maxCjkCharactersPerLine) {
        failures.push({
          file,
          line: index + 1,
          message: `Line contains ${countCjk(line)} CJK characters, which looks like long-form content.`,
          suggestion: policy.suggestion,
        });
      }
    });

    for (const match of text.matchAll(literalPattern)) {
      if (match[2].length > policy.maxLiteralCharacters) {
        failures.push({
          file,
          message: `String/template literal has ${match[2].length} characters.`,
          suggestion: policy.suggestion,
        });
      }
    }
  }

  for (const publicRoot of policy.publicContentRoots) {
    try {
      await listFiles(rootDir, publicRoot);
    } catch (error) {
      failures.push({
        file: publicRoot,
        message: 'Public content root is missing.',
        suggestion: 'Create the public content directory before adding user-facing materials.',
      });
    }
  }

  return createResult({
    name: 'content-location',
    command: 'npm run harness:content',
    ok: failures.length === 0,
    checked: {
      files: new Set(scanFiles).size,
      publicContentRoots: policy.publicContentRoots.length,
    },
    failures,
    suggestions: failures.length ? [policy.suggestion] : [],
  });
}

if (isDirectRun(import.meta.url)) {
  checkContentLocation().then(printCliResult).catch((error) => {
    printCliResult(createResult({
      name: 'content-location',
      command: 'npm run harness:content',
      ok: false,
      failures: [{ message: error.message }],
      suggestions: ['Check content-location policy and scanned paths.'],
    }));
  });
}
