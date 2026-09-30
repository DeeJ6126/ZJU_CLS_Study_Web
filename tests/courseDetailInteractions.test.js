import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const courseDetail = readFileSync(new URL('../src/components/CourseDetailPage.vue', import.meta.url), 'utf8');
const favoriteButton = readFileSync(new URL('../src/components/FavoriteButton.vue', import.meta.url), 'utf8');

test('experience and material details hide their comment sections while papers retain theirs', () => {
  const experience = courseDetail.split('activeTab.id === \'experiences\'')[1].split('activeTab.id === \'materials\'')[0];
  const material = courseDetail.split('activeTab.id === \'materials\'')[1].split('class="paper-detail"')[0];
  assert.doesNotMatch(experience, /<CommentSection/);
  assert.doesNotMatch(material, /<CommentSection/);
  assert.equal((courseDetail.match(/<CommentSection/g) ?? []).length, 1);
});

test('article details render Markdown or UBB and keep grades concealed by default', () => {
  assert.match(courseDetail, /renderCourseMarkdown\(body\)/);
  assert.match(courseDetail, /const gradeVisible = ref\(false\)/);
  assert.match(courseDetail, /:aria-expanded="gradeVisible"/);
  assert.match(courseDetail, /gradeVisible \? `成绩 \$\{activeItemGradeLabel\}` : '查看成绩'/);
});

test('resource lists and details distinguish teacher and applicable academic year', () => {
  assert.equal((courseDetail.match(/授课老师：\{\{ activeItem\.teacher \|\| '未注明' \}\}/g) ?? []).length, 3);
  assert.equal((courseDetail.match(/class="learning-card__metadata"/g) ?? []).length, 2);
  assert.match(courseDetail, /适用学年：\{\{ item\.year \|\| '未注明' \}\}/);
  assert.match(courseDetail, /学年：\{\{ paper\.year \|\| '未注明' \}\}/);
});

test('like and favorite icons expose pressed state and remain reversible', () => {
  assert.match(courseDetail, /:aria-pressed="Boolean\(activeItem\.viewerLiked\)"/);
  assert.match(courseDetail, /activeItem\.likeCount \|\| 0/);
  assert.match(courseDetail, /emit\('toggle-like', activeItem\.contentId\)/);
  assert.match(favoriteButton, /:aria-pressed="active"/);
  assert.match(favoriteButton, /active \? 'currentColor' : 'none'/);
  assert.match(favoriteButton, /emit\('toggle'\)/);
});
