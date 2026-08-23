export const courseScheduleHeaders = [
  '课程代码',
  '课程名称',
  '教师姓名',
  '学期',
  '上课时间',
  '上课地点',
];

function clean(value) {
  return String(value ?? '').trim();
}

function splitSegments(value) {
  return clean(value).split(/[;；]/).map(clean).filter(Boolean);
}

function findHeader(rows) {
  const limit = Math.min(rows.length, 30);
  for (let index = 0; index < limit; index += 1) {
    const values = rows[index].map(clean);
    const columns = Object.fromEntries(courseScheduleHeaders.map((header) => [header, values.indexOf(header)]));
    if (courseScheduleHeaders.every((header) => columns[header] >= 0)) {
      return { rowIndex: index, columns };
    }
  }
  return null;
}

function mergeDistinctText(current, incoming, separator = '/') {
  const parts = [...clean(current).split(separator), ...clean(incoming).split(separator)]
    .map(clean)
    .filter(Boolean);
  return [...new Set(parts)].join(separator);
}

function meetingsFromRow(classTime, classLocation) {
  const times = splitSegments(classTime);
  const locations = splitSegments(classLocation);
  const length = Math.max(times.length, locations.length);
  return Array.from({ length }, (_, index) => ({
    time: times[index] ?? '',
    location: locations[index] ?? '',
  })).filter((meeting) => meeting.time || meeting.location);
}

function mergeMeetings(target, incoming) {
  for (const meeting of incoming) {
    if (target.some((item) => item.time === meeting.time && item.location === meeting.location)) continue;
    if (meeting.time && !meeting.location && target.some((item) => item.time === meeting.time && item.location)) continue;
    if (meeting.location && !meeting.time && target.some((item) => item.location === meeting.location && item.time)) continue;
    target.push(meeting);
  }
  return target.filter((meeting) => !target.some((other) => (
    other !== meeting
    && meeting.time === other.time
    && !meeting.location
    && other.location
  )));
}

export function normalizeCourseScheduleRows(rows, { catalogCodes = new Set() } = {}) {
  const header = findHeader(rows);
  if (!header) {
    return { ok: false, status: 400, message: `课表缺少必要表头：${courseScheduleHeaders.join('、')}。` };
  }
  const byCode = new Map();
  let duplicateGroupCount = 0;
  for (const row of rows.slice(header.rowIndex + 1)) {
    const read = (name) => clean(row[header.columns[name]]);
    const courseCode = read('课程代码').toUpperCase();
    const courseName = read('课程名称');
    if (!courseCode && !courseName) continue;
    if (!/^[A-Z0-9-]{3,24}$/.test(courseCode) || !courseName) continue;
    const incoming = {
      courseCode,
      courseName,
      teacherName: read('教师姓名'),
      term: read('学期'),
      meetings: meetingsFromRow(read('上课时间'), read('上课地点')),
    };
    const current = byCode.get(courseCode);
    if (!current) {
      byCode.set(courseCode, incoming);
      continue;
    }
    if (!current.duplicate) duplicateGroupCount += 1;
    current.duplicate = true;
    current.courseName ||= incoming.courseName;
    current.teacherName = mergeDistinctText(current.teacherName, incoming.teacherName);
    current.term = mergeDistinctText(current.term, incoming.term, '/');
    current.meetings = mergeMeetings(current.meetings, incoming.meetings);
  }
  const courses = [...byCode.values()].map((course) => ({
    courseCode: course.courseCode,
    courseName: course.courseName,
    teacherName: course.teacherName,
    term: course.term,
    classTime: course.meetings.map((meeting) => meeting.time).join(';'),
    classLocation: course.meetings.map((meeting) => meeting.location).join(';'),
    catalogMatched: catalogCodes.has(course.courseCode),
  }));
  if (!courses.length) {
    return { ok: false, status: 400, message: '课表中没有识别到课程记录。' };
  }
  return { ok: true, courses, duplicateGroupCount };
}
