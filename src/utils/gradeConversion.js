// Percentage (0-100) → CC98-style 5-point scale conversion, matching the
// 2024 生科学部 standard mapping. Each tier is 3 percentage points except
// the top (100-95 → 5.0, 6 values) and the bottom step (61-60 → 1.5, 2
// values); scores below 60 map to 0.

/**
 * @typedef {Object} GradeRow
 * @property {number} min
 * @property {number} max
 * @property {number} score
 */

/** @type {GradeRow[]} */
const GRADE_TABLE = [
  { min: 95, max: 100, score: 5.0 },
  { min: 92, max: 94, score: 4.8 },
  { min: 89, max: 91, score: 4.5 },
  { min: 86, max: 88, score: 4.2 },
  { min: 83, max: 85, score: 3.9 },
  { min: 80, max: 82, score: 3.6 },
  { min: 77, max: 79, score: 3.3 },
  { min: 74, max: 76, score: 3.0 },
  { min: 71, max: 73, score: 2.7 },
  { min: 68, max: 70, score: 2.4 },
  { min: 65, max: 67, score: 2.1 },
  { min: 62, max: 64, score: 1.8 },
  { min: 60, max: 61, score: 1.5 },
  { min: 0, max: 59, score: 0 },
];

/**
 * Convert a 0-100 percentage to the 5-point GPA scale.
 * @param {unknown} percentage
 * @returns {number|null} GPA in [0, 5.0] or null when input is not numeric.
 */
export function percentageToGPA(percentage) {
  if (percentage == null || percentage === '') return null;
  const num = Number(percentage);
  if (!Number.isFinite(num)) return null;
  const entry = GRADE_TABLE.find((row) => num >= row.min && num <= row.max);
  return entry ? entry.score : 0;
}

/**
 * Format a percentage as "5.0/95" — GPA on the left, raw percentage on the
 * right. Returns '' when the input is empty, non-numeric, or zero.
 * @param {unknown} percentage
 * @returns {string}
 */
export function formatGrade(percentage) {
  if (percentage == null || percentage === '') return '';
  const num = Number(percentage);
  if (!Number.isFinite(num) || num <= 0) return '';
  const gpa = percentageToGPA(num);
  if (gpa === null) return '';
  return `${gpa.toFixed(1)}/${Math.round(num)}`;
}

/**
 * @param {unknown} percentage
 * @returns {boolean} true when the value is a finite number in [0, 100].
 */
export function percentageIsValid(percentage) {
  if (percentage == null || percentage === '') return false;
  if (typeof percentage === 'string' && percentage.trim() === '') return false;
  const num = Number(percentage);
  return Number.isFinite(num) && num >= 0 && num <= 100;
}
