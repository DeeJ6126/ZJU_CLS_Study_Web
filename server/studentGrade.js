// Map a ZJU numeric student ID prefix to the cohort year.
// Convention: student IDs starting with `32X0` (X = last digit of the year)
// identify students by the year they enter the university.
const STUDENT_ID_TO_GRADE = Object.freeze({
  '3240': 2024,
  '3250': 2025,
  '3260': 2026,
});

export const ALLOWED_GRADES = Object.freeze(Object.values(STUDENT_ID_TO_GRADE));

export function gradeFromStudentId(studentId) {
  if (typeof studentId !== 'string') return null;
  const cleaned = studentId.trim();
  if (cleaned.length < 4) return null;
  const prefix = cleaned.slice(0, 4);
  return STUDENT_ID_TO_GRADE[prefix] ?? null;
}

export function isAllowedGrade(value) {
  return typeof value === 'number' && ALLOWED_GRADES.includes(value);
}
