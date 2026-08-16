import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authDialogSource = readFileSync('src/components/account/AuthDialog.vue', 'utf8');
const profileSource = readFileSync('src/components/profile/ProfilePage.vue', 'utf8');
const homeSource = readFileSync('src/components/HomePage.vue', 'utf8');
const courseDetailSource = readFileSync('src/components/CourseDetailPage.vue', 'utf8');

test('email account forms use a numeric student id with a fixed ZJU suffix', () => {
  assert.match(authDialogSource, /pattern="\[0-9\]\+"/);
  assert.match(authDialogSource, /@zju\.edu\.cn/);
  assert.match(authDialogSource, /v-model\.trim="nickname"/);
  assert.doesNotMatch(authDialogSource, /学号或别名@zju\.edu\.cn/);
});

test('profile page separates public posts from owner management controls', () => {
  assert.match(profileSource, /发布的帖子/);
  assert.match(profileSource, /我的帖子/);
  assert.match(profileSource, /上传头像/);
  assert.match(profileSource, /提交修改/);
  assert.match(profileSource, /换绑 CC98/);
  assert.match(profileSource, /我的课程/);
  assert.match(profileSource, /导入课表/);
  assert.match(profileSource, /确认替换课程清单/);
  assert.match(profileSource, /我的收藏/);
  assert.match(profileSource, /我的评论/);
});

test('identified comments and notifications expose profile links and owner actions', () => {
  const comments = readFileSync('src/components/CommentSection.vue', 'utf8');
  const notifications = readFileSync('src/components/account/NotificationsPage.vue', 'utf8');
  assert.match(comments, /comment\.author\.publicId/);
  assert.match(comments, /回复/);
  assert.match(comments, /编辑/);
  assert.match(comments, /删除/);
  assert.match(notifications, /全部标为已读/);
  assert.match(notifications, /notification\.actor/);
});

test('the app wires account datasets, course import, comments, favorites, and notifications', () => {
  const app = readFileSync('src/App.vue', 'utf8');
  const overview = readFileSync('src/components/OverviewPage.vue', 'utf8');
  assert.match(app, /accountDataApiClient/);
  assert.match(app, /commentApiClient/);
  assert.match(app, /NotificationsPage/);
  assert.match(app, /preview-course-schedule/);
  assert.match(app, /toggle-favorite/);
  assert.match(app, /update-comment/);
  assert.match(app, /handleLogout[\s\S]*?quizProgressByCollection\.value = \{\}/);
  assert.match(overview, /add-course/);
  assert.match(overview, /我的课程/);
});

test('home search and course authors link to public profiles', () => {
  assert.match(homeSource, /searchProfiles/);
  assert.match(courseDetailSource, /getProfileHref/);
  assert.match(courseDetailSource, /item\.owner\.nickname/);
});
