import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

export const maxPdfBytes = 25 * 1024 * 1024;

function safeOriginalName(fileName) {
  const leaf = String(fileName ?? '').split(/[\\/]/).pop() || 'document.pdf';
  const cleaned = leaf.replace(/[\u0000-\u001f<>:"|?*]/g, '_').trim();
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned || 'document'}.pdf`;
}

export function savePdfFile({
  buffer,
  fileName,
  mimeType,
  uploadDirectory,
  maxBytes = maxPdfBytes,
}) {
  if (mimeType !== 'application/pdf') {
    return { ok: false, status: 400, message: '只能上传 PDF 文件。' };
  }
  if (!Buffer.isBuffer(buffer) || buffer.length > maxBytes) {
    return { ok: false, status: 413, message: 'PDF 文件不能超过 25 MB。' };
  }
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return { ok: false, status: 400, message: '文件内容不是有效的 PDF。' };
  }

  mkdirSync(uploadDirectory, { recursive: true });
  const storedName = `${randomUUID()}.pdf`;
  writeFileSync(join(uploadDirectory, storedName), buffer, { flag: 'wx' });
  return {
    ok: true,
    status: 201,
    file: {
      fileName: safeOriginalName(fileName),
      storedName,
      mimeType: 'application/pdf',
      size: buffer.length,
      url: '',
    },
  };
}

export function removeStoredFile(uploadDirectory, storedName) {
  const safeName = basename(String(storedName ?? ''));
  if (!safeName || safeName !== storedName || extname(safeName).toLowerCase() !== '.pdf') {
    return false;
  }
  const target = join(uploadDirectory, safeName);
  if (!existsSync(target)) {
    return false;
  }
  rmSync(target);
  return true;
}
