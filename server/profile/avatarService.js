import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import sharp from 'sharp';

export const maxAvatarBytes = 2 * 1024 * 1024;

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedFormats = new Set(['jpeg', 'png', 'webp']);

export async function saveAvatarFile({ buffer, mimeType, uploadDirectory }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, status: 400, message: '请选择头像图片。' };
  }
  if (buffer.length > maxAvatarBytes) {
    return { ok: false, status: 413, message: '头像不能超过 2 MB。' };
  }
  if (!allowedMimeTypes.has(String(mimeType ?? '').toLowerCase())) {
    return { ok: false, status: 415, message: '头像仅支持 JPG、PNG 或 WebP。' };
  }
  try {
    const image = sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (!allowedFormats.has(metadata.format)) {
      return { ok: false, status: 400, message: '头像文件内容无效。' };
    }
    const output = await image
      .rotate()
      .resize(512, 512, { fit: 'cover', position: 'centre' })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
    mkdirSync(uploadDirectory, { recursive: true });
    const storedName = `${randomUUID()}.webp`;
    writeFileSync(join(uploadDirectory, storedName), output, { flag: 'wx' });
    return {
      ok: true,
      status: 201,
      file: {
        storedName,
        mimeType: 'image/webp',
        size: output.length,
      },
    };
  } catch {
    return { ok: false, status: 400, message: '头像文件内容无效。' };
  }
}

export function removeAvatarFile(uploadDirectory, storedName) {
  const safeName = basename(String(storedName ?? ''));
  if (!safeName || safeName !== storedName) return;
  try {
    unlinkSync(join(uploadDirectory, safeName));
  } catch {
    // Missing old avatars do not block a replacement.
  }
}

export function readAvatarFile(uploadDirectory, storedName) {
  const safeName = basename(String(storedName ?? ''));
  if (!safeName || safeName !== storedName || !/^[0-9a-f-]+\.webp$/.test(safeName)) return null;
  try {
    return readFileSync(join(uploadDirectory, safeName));
  } catch {
    return null;
  }
}
