import readExcelFile from 'read-excel-file/node';
import {
  courseScheduleHeaders,
  normalizeCourseScheduleRows,
} from '../../src/services/courseScheduleService.js';

export { courseScheduleHeaders, normalizeCourseScheduleRows };

export const maxCourseScheduleBytes = 5 * 1024 * 1024;
const maxSheetRows = 1000;

function clean(value) {
  return String(value ?? '').trim();
}


export function validateCourseScheduleUpload(buffer, fileName = '') {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    return { ok: false, status: 400, message: '请选择 XLSX 课表文件。' };
  }
  if (buffer.length > maxCourseScheduleBytes) {
    return { ok: false, status: 413, message: '课表文件不能超过 5 MB。' };
  }
  if (!clean(fileName).toLowerCase().endsWith('.xlsx')) {
    return { ok: false, status: 400, message: '课表仅支持 XLSX 文件。' };
  }
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
    return { ok: false, status: 400, message: '课表文件内容不是有效的 XLSX。' };
  }
  return { ok: true };
}

export async function parseCourseScheduleWorkbook(buffer, options = {}) {
  const validation = validateCourseScheduleUpload(buffer, options.fileName);
  if (!validation.ok) return validation;
  try {
    const sheets = await readExcelFile(buffer);
    for (const sheet of sheets) {
      if (sheet.data.length > maxSheetRows) {
        return { ok: false, status: 400, message: '课表行数过多，无法导入。' };
      }
      const normalized = normalizeCourseScheduleRows(sheet.data, options);
      if (normalized.ok) return { ...normalized, sheetName: sheet.sheet };
    }
    return { ok: false, status: 400, message: `课表缺少必要表头：${courseScheduleHeaders.join('、')}。` };
  } catch {
    return { ok: false, status: 400, message: '课表文件无法解析，请重新从教务系统导出。' };
  }
}
