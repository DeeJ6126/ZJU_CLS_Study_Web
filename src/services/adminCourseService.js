export function courseOptionLabel(course) {
  if (!course) return '';
  return `${course.code} · ${course.name}`;
}

export function filterAdminCourses(courses, query) {
  const tokens = String(query ?? '')
    .trim()
    .toLocaleLowerCase('zh-CN')
    .split(/\s+/)
    .filter(Boolean);

  if (!tokens.length) return courses;

  return courses.filter((course) => {
    const searchable = `${course.code ?? ''} ${course.name ?? ''}`.toLocaleLowerCase('zh-CN');
    return tokens.every((token) => searchable.includes(token));
  });
}

export function countPendingSubmissionsByCourse(submissions) {
  return submissions.reduce((counts, submission) => {
    if (submission.status !== 'pending' || !submission.courseCode) return counts;
    counts[submission.courseCode] = (counts[submission.courseCode] ?? 0) + 1;
    return counts;
  }, {});
}
