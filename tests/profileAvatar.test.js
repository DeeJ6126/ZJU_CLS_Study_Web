import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

import {
  maxAvatarBytes,
  removeAvatarFile,
  saveAvatarFile,
} from '../server/profile/avatarService.js';

test('avatar service decodes an image and stores a randomized 512px WebP', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'zjubio-avatar-'));
  try {
    const onePixelPng = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#2d5f49' },
    }).png().toBuffer();
    const result = await saveAvatarFile({
      buffer: onePixelPng,
      mimeType: 'image/png',
      uploadDirectory: directory,
    });
    assert.equal(result.ok, true);
    assert.match(result.file.storedName, /^[0-9a-f-]+\.webp$/);
    assert.equal(result.file.mimeType, 'image/webp');
    const stored = readFileSync(join(directory, result.file.storedName));
    assert.equal(stored.subarray(0, 4).toString('ascii'), 'RIFF');

    const removedName = result.file.storedName;
    removeAvatarFile(directory, removedName);
    assert.equal(existsSync(join(directory, removedName)), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('avatar service rejects invalid images and oversized bodies', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'zjubio-avatar-invalid-'));
  try {
    const invalid = await saveAvatarFile({
      buffer: Buffer.from('not an image'),
      mimeType: 'image/png',
      uploadDirectory: directory,
    });
    assert.equal(invalid.status, 400);

    const oversized = await saveAvatarFile({
      buffer: Buffer.alloc(maxAvatarBytes + 1),
      mimeType: 'image/png',
      uploadDirectory: directory,
    });
    assert.equal(oversized.status, 413);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
