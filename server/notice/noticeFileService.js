import { randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { Open } from 'unzipper-esm';

export const maxNoticeAttachmentBytes = 25 * 1024 * 1024;
const maxExpandedBytes = 100 * 1024 * 1024;
const types = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const fail = (message, status = 400) => ({ ok: false, status, message });

async function boundedXml(entry) {
  if (entry.uncompressedSize > 2 * 1024 * 1024) throw new Error('XML too large');
  const chunks = [];
  let size = 0;
  const stream = entry.stream();
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) { stream.destroy(); throw new Error('XML too large'); }
    chunks.push(chunk);
  }
  if (size !== entry.uncompressedSize) throw new Error('Invalid ZIP entry size');
  return Buffer.concat(chunks).toString('utf8');
}

async function validOfficePackage(buffer, extension) {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) return false;
  // Bound the container before asking the ZIP reader to allocate directory entries.
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > buffer.length || end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length
    || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) return false;
  const count = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  const directoryOffset = buffer.readUInt32LE(end + 16);
  if (!count || count > 2000 || buffer.readUInt16LE(end + 8) !== count
    || directoryOffset + directorySize !== end) return false;
  try {
    const directory = await Open.buffer(buffer, { tailSize: Math.min(buffer.length, 65557) });
    let total = 0;
    const paths = new Set();
    for (const file of directory.files) {
      total += file.uncompressedSize;
      if (file.flags & 1 || ![0, 8].includes(file.compressionMethod) || file.diskNumber
        || file.path.startsWith('/') || /[\\\u0000]/.test(file.path)
        || file.path.split('/').includes('..') || /^[a-z]:/i.test(file.path)
        || paths.has(file.path) || /vbaProject|macro|activeX|embeddings/i.test(file.path)
        || total > maxExpandedBytes || file.uncompressedSize > maxExpandedBytes
        || file.offsetToLocalFileHeader + 30 > directoryOffset
        || buffer.readUInt32LE(file.offsetToLocalFileHeader) !== 0x04034b50
        || buffer.readUInt16LE(file.offsetToLocalFileHeader + 6) & 1) return false;
      paths.add(file.path);
    }
    const mainPath = extension === '.docx' ? 'word/document.xml' : 'xl/workbook.xml';
    const mainMime = extension === '.docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
    const contentTypes = directory.files.find((file) => file.path === '[Content_Types].xml');
    const document = directory.files.find((file) => file.path === mainPath);
    if (!contentTypes || !document || !paths.has('_rels/.rels')) return false;
    const xml = await boundedXml(contentTypes);
    const main = await boundedXml(document);
    if (/<!DOCTYPE|<!ENTITY|macroEnabled|vbaProject/i.test(xml + main)) return false;
    return xml.includes(mainMime) && xml.includes(`/${mainPath}`)
      && (extension === '.docx' ? /<(?:\w+:)?document(?:\s|\/?>)/ : /<(?:\w+:)?workbook(?:\s|\/?>)/).test(main);
  } catch { return false; }
}

export async function validateNoticeAttachment({ buffer, fileName, mimeType }) {
  if (!Buffer.isBuffer(buffer) || buffer.length > maxNoticeAttachmentBytes) return fail('附件不能超过 25 MB。', 413);
  if (typeof fileName !== 'string' || !fileName || fileName.length > 180
    || /[\\/\u0000-\u001f\u007f<>:"|?*]/.test(fileName) || fileName !== fileName.trim()) return fail('附件文件名无效。');
  const extension = extname(fileName).toLowerCase();
  if (!types[extension] || mimeType !== types[extension]) return fail('只允许 PDF、DOCX 或 XLSX 附件，文件类型必须匹配。');
  const valid = extension === '.pdf' ? buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    : await validOfficePackage(buffer, extension);
  if (!valid) return fail('附件内容与文件类型不符或包含不支持的内容。');
  return { ok: true, extension };
}

function attachmentPath(uploadDirectory, storedName) {
  if (!/^[a-f0-9-]{36}\.(pdf|docx|xlsx)$/.test(String(storedName ?? ''))) return null;
  const directory = resolve(uploadDirectory, 'notice-attachments');
  return join(directory, storedName);
}

export async function saveNoticeAttachment(input) {
  const checked = await validateNoticeAttachment(input);
  if (!checked.ok) return checked;
  const storedName = `${randomUUID()}${checked.extension}`;
  mkdirSync(resolve(input.uploadDirectory, 'notice-attachments'), { recursive: true });
  writeFileSync(attachmentPath(input.uploadDirectory, storedName), input.buffer, { flag: 'wx' });
  return { ok: true, file: { id: randomUUID(), fileName: input.fileName, storedName,
    mimeType: input.mimeType, size: input.buffer.length } };
}

export function readNoticeAttachment(uploadDirectory, storedName) {
  const path = attachmentPath(uploadDirectory, storedName);
  if (!path) return null;
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxNoticeAttachmentBytes) return null;
    return readFileSync(path);
  } catch { return null; }
}

export function removeNoticeAttachment(uploadDirectory, storedName) {
  const path = attachmentPath(uploadDirectory, storedName);
  if (!path) return false;
  try {
    if (!lstatSync(path).isFile()) return false;
    unlinkSync(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    throw error;
  }
}
