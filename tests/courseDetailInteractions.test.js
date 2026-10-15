import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const courseDetail = readFileSync(new URL('../src/components/CourseDetailPage.vue', import.meta.url), 'utf8');
const favoriteButton = readFileSync(new URL('../src/components/FavoriteButton.vue', import.meta.url), 'utf8');

test('all course resource details hide their comment sections', () => {
  const experience = courseDetail.split('activeTab.id === \'experiences\'')[1].split('activeTab.id === \'materials\'')[0];
  const material = courseDetail.split('activeTab.id === \'materials\'')[1].split('class="paper-detail article-detail-card"')[0];
  assert.doesNotMatch(experience, /<CommentSection/);
  assert.doesNotMatch(material, /<CommentSection/);
  assert.doesNotMatch(courseDetail, /CommentSection/);
});

test('article details render Markdown or UBB and keep grades concealed by default', () => {
  assert.match(courseDetail, /renderCourseMarkdown\(body\)/);
  assert.match(courseDetail, /const gradeVisible = ref\(false\)/);
  assert.match(courseDetail, /:aria-expanded="gradeVisible"/);
  assert.match(courseDetail, /gradeVisible \? `成绩 \$\{activeItemGradeLabel\}` : '查看成绩'/);
  assert.doesNotMatch(courseDetail, /暂无成绩/);
});

test('resource lists and details distinguish teacher and publication date', () => {
  assert.equal((courseDetail.match(/授课老师：\{\{ activeItem\.teacher \|\| '未注明' \}\}/g) ?? []).length, 2);
  assert.equal((courseDetail.match(/class="learning-card__metadata"/g) ?? []).length, 2);
  assert.match(courseDetail, /发布日期：\{\{ formatContentPublicationDate\(item\) \}\}/);
  assert.match(courseDetail, /class="paper-row-card__date">\{\{ formatContentPublicationDate\(paper\) \}\}/);
  assert.doesNotMatch(courseDetail, /适用学年/);
});

test('papers show compact authors, plain dates and optional teachers without list summaries or duplicate PDF actions', () => {
  const papers = courseDetail.slice(courseDetail.indexOf('<article class="paper-detail article-detail-card">'));
  assert.match(papers, /paper\.owner\?\.nickname \|\| paper\.author/);
  assert.match(papers, /v-if="paper.teacher" class="paper-row-card__teacher"/);
  assert.match(papers, /v-if="activeItem.teacher"/);
  assert.doesNotMatch(papers, /未注明|paper\.summary|<em>|返回历年试卷|>打开 PDF<|>下载 PDF</);
  assert.match(papers, /<object v-if="activeItem.file" class="pdf-viewer"/);
  assert.match(papers, /class="article-cc98-badge"/);
});

test('paper notes reuse safe full-width article formatting below the embedded PDF', () => {
  const papers = courseDetail.slice(courseDetail.indexOf('<article class="paper-detail article-detail-card">'));
  assert.doesNotMatch(papers, /activeItem\.paragraphs/);
  assert.match(papers, /class="article-body"/);
  assert.match(papers, /v-html="activeItemBody.html"/);
  assert.ok(papers.indexOf('</object>') < papers.indexOf('class="article-body"'));
});

test('like and favorite icons expose pressed state and remain reversible', () => {
  assert.match(courseDetail, /:aria-pressed="Boolean\(activeItem\.viewerLiked\)"/);
  assert.match(courseDetail, /activeItem\.likeCount \|\| 0/);
  assert.match(courseDetail, /emit\('toggle-like', activeItem\.contentId\)/);
  assert.match(favoriteButton, /:aria-pressed="active"/);
  assert.match(favoriteButton, /active \? 'currentColor' : 'none'/);
  assert.match(favoriteButton, /emit\('toggle'\)/);
});
