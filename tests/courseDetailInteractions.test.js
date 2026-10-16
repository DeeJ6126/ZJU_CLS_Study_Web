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

test('papers show compact metadata with a return link and separate one-click PDF actions', () => {
  const papers = courseDetail.slice(courseDetail.indexOf('<article class="paper-detail article-detail-card">'));
  assert.match(papers, /paper\.owner\?\.nickname \|\| paper\.author/);
  assert.match(papers, /v-if="paper.teacher" class="paper-row-card__teacher"/);
  assert.match(papers, /v-if="activeItem.teacher"/);
  assert.doesNotMatch(papers, /paper\.summary|<em>|>打开 PDF<|>下载 PDF</);
  assert.match(courseDetail, /:href="tabHref\('papers'\)">返回历年试卷/);
  assert.match(papers, /<object v-if="paperPdfUrl" class="pdf-viewer"/);
  assert.match(papers, /class="paper-row-card__main-link" :href="paper.href"/);
  assert.match(papers, /:href="paper.download.url" :download="paper.download.fileName"/);
  assert.match(papers, /:href="activePaperDownload.url" :download="activePaperDownload.fileName"/);
  assert.match(papers, /class="article-cc98-badge"/);
});

test('paper filters use combined metadata choices and reset only when changing courses', () => {
  assert.match(courseDetail, /v-model="paperYear" aria-label="试卷年份"/);
  assert.match(courseDetail, /v-model="paperTeacher" aria-label="试卷授课老师"/);
  assert.match(courseDetail, /filterPapers\(props.course.papers \?\? \[\], \{ year: paperYear.value, teacher: paperTeacher.value \}\)/);
  assert.match(courseDetail, /watch\(\(\) => props.course.code, clearPaperFilters\)/);
  assert.match(courseDetail, /没有符合筛选条件的试卷/);
  assert.match(courseDetail, /@click="clearPaperFilters">清除筛选/);
  assert.match(courseDetail, /filteredPapers.length \}\} \/ \{\{ activeCollection.length/);
});

test('paper main and supplementary notes share safe article formatting around the embedded PDF', () => {
  const papers = courseDetail.slice(courseDetail.indexOf('<article class="paper-detail article-detail-card">'));
  assert.doesNotMatch(papers, /activeItem\.paragraphs/);
  assert.match(papers, /class="article-body"/);
  assert.match(papers, /v-html="activeItemBody.html"/);
  assert.ok(papers.indexOf('v-html="activeItemBody.html"') < papers.indexOf('<object'));
  assert.ok(papers.indexOf('</object>') < papers.indexOf('v-html="activeItemSupplementBody.html"'));
  assert.match(courseDetail, /renderItemBody\(activeItem.value, 'supplementBody'\)/);
  assert.match(papers, /:data="paperPdfUrl"/);
  assert.match(papers, /paper\.subtitle/);
  assert.match(papers, /activeItem\.subtitle/);
});

test('like and favorite icons expose pressed state and remain reversible', () => {
  assert.match(courseDetail, /:aria-pressed="Boolean\(activeItem\.viewerLiked\)"/);
  assert.match(courseDetail, /activeItem\.likeCount \|\| 0/);
  assert.match(courseDetail, /emit\('toggle-like', activeItem\.contentId\)/);
  assert.match(favoriteButton, /:aria-pressed="active"/);
  assert.match(favoriteButton, /active \? 'currentColor' : 'none'/);
  assert.match(favoriteButton, /emit\('toggle'\)/);
});
