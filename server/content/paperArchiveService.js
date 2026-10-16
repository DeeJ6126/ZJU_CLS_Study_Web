import { open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipFile } from 'yazl';
import { filterPapers } from '../../src/services/paperFilterService.js';
import { maxPdfBytes } from './contentFileService.js';

export const MAX_PAPER_ARCHIVE_FILES = 200;
export const MAX_PAPER_ARCHIVE_BYTES = 100 * 1024 * 1024;
const defaultPublicDirectory = fileURLToPath(new URL('../../public/', import.meta.url));

function leafName(value, fallback) {
  return String(value || fallback).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .replace(/^[. ]+|[. ]+$/g, '').slice(0, 140) || fallback;
}

function localFile(item, uploadDirectory, publicDirectory) {
  if (item.file?.storedName) {
    const name = item.file.storedName;
    if (/[\\/]/.test(name) || !name.toLowerCase().endsWith('.pdf')) throw new Error('Unsafe stored PDF');
    return { base: uploadDirectory, file: resolve(uploadDirectory, name) };
  }
  const url = String(item.file?.url || '').split(/[?#]/)[0];
  if (!/^\/(?:zjubio\/)?resource\//.test(url)) return null;
  const name = decodeURIComponent(url.replace(/^\/zjubio\//, '/').slice(1));
  if (!name.toLowerCase().endsWith('.pdf') || name.includes('\\')) throw new Error('Unsafe static PDF');
  return { base: publicDirectory, file: resolve(publicDirectory, name) };
}

export async function preparePaperArchive({ courseCode, year = '', teacher = '', contentStore,
  uploadDirectory, publicDirectory = defaultPublicDirectory }) {
  if (!/^[A-Z0-9-]{3,24}$/.test(courseCode) || year.length > 20 || teacher.length > 40) {
    return { ok: false, status: 400, message: '试卷筛选条件无效。' };
  }
  const papers = filterPapers(contentStore.listPublishedByCourse(courseCode)
    .filter(item => item.status === 'published' && item.type === 'paper' && item.courseCode === courseCode), { year, teacher });
  if (papers.length > MAX_PAPER_ARCHIVE_FILES) return { ok: false, status: 413, message: '试卷过多，请按年份或老师筛选后再下载。' };
  const files = [], names = new Set();
  let bytes = 0;
  try {
    for (const paper of papers) {
      const source = localFile(paper, uploadDirectory, publicDirectory);
      if (!source) continue;
      const [base, file] = await Promise.all([realpath(source.base), realpath(source.file)]);
      const rel = relative(base, file);
      if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('PDF outside storage');
      const handle = await open(file, 'r');
      let size;
      try {
        const stat = await handle.stat();
        size = stat.size;
        const header = Buffer.alloc(5);
        await handle.read(header, 0, 5, 0);
        if (!stat.isFile() || size > maxPdfBytes || header.toString() !== '%PDF-') throw new Error('Invalid PDF');
      } finally { await handle.close(); }
      bytes += size;
      if (bytes > MAX_PAPER_ARCHIVE_BYTES) return { ok: false, status: 413, message: '文件合计超过 100 MB，请缩小筛选范围后再下载。' };
      const stem = leafName(paper.title || paper.file.fileName.replace(/\.pdf$/i, ''), '试卷');
      let name = `${stem}.pdf`, index = 2;
      while (names.has(name.toLowerCase())) name = `${stem} (${index++}).pdf`;
      names.add(name.toLowerCase());
      files.push({ path: file, name, size });
    }
  } catch {
    return { ok: false, status: 409, message: '部分试卷文件暂时不可用，请稍后重试或联系管理员。' };
  }
  if (!files.length) return { ok: false, status: 404, message: '当前筛选结果中没有可下载的内置 PDF。' };
  const filename = `${courseCode}-历年试卷${year ? `-${leafName(year, '年份')}` : ''}${teacher ? `-${leafName(teacher, '老师')}` : ''}.zip`;
  return { ok: true, files, filename };
}

export function createPaperArchive(files) {
  const zip = new ZipFile();
  for (const file of files) zip.addFile(file.path, file.name, { compress: false });
  return zip;
}
