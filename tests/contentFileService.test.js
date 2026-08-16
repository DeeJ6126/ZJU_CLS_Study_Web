import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { removeStoredFile, savePdfFile } from '../server/content/contentFileService.js';

test('pdf storage rejects invalid mime, signature, and oversized uploads', () => {
  const uploadDirectory = mkdtempSync(join(tmpdir(), 'zjubio-file-validation-'));
  try {
    assert.equal(savePdfFile({
      buffer: Buffer.from('%PDF-test'),
      fileName: 'test.pdf',
      mimeType: 'text/plain',
      uploadDirectory,
    }).status, 400);
    assert.equal(savePdfFile({
      buffer: Buffer.from('not a pdf'),
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      uploadDirectory,
    }).status, 400);
    assert.equal(savePdfFile({
      buffer: Buffer.from('%PDF-too-long'),
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      uploadDirectory,
      maxBytes: 5,
    }).status, 413);
  } finally {
    rmSync(uploadDirectory, { recursive: true, force: true });
  }
});

test('pdf storage sanitizes names, uses a generated storage name, and removes files', () => {
  const uploadDirectory = mkdtempSync(join(tmpdir(), 'zjubio-file-storage-'));
  try {
    const saved = savePdfFile({
      buffer: Buffer.from('%PDF-1.7\ncontent'),
      fileName: '..\\unsafe/期中卷.pdf',
      mimeType: 'application/pdf',
      uploadDirectory,
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.file.fileName, '期中卷.pdf');
    assert.match(saved.file.storedName, /^[a-f0-9-]+\.pdf$/);
    assert.equal(existsSync(join(uploadDirectory, saved.file.storedName)), true);

    assert.equal(removeStoredFile(uploadDirectory, saved.file.storedName), true);
    assert.equal(existsSync(join(uploadDirectory, saved.file.storedName)), false);
    assert.equal(removeStoredFile(uploadDirectory, '../outside.pdf'), false);
  } finally {
    rmSync(uploadDirectory, { recursive: true, force: true });
  }
});
