import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createAdminApiClient } from '../src/services/adminApiClient.js';

test('admin API client sends structured content and raw PDF requests', async () => {
  const requests = [];
  const client = createAdminApiClient(async (path, options = {}) => {
    requests.push({ path, options });
    return {
      ok: true,
      status: options.method === 'PUT' ? 201 : 200,
      async json() { return { items: [], item: { id: 'content-1' } }; },
    };
  });

  await client.fetchContent({ courseCode: 'BIO2110F', type: 'paper', status: 'draft' });
  await client.createContent({ courseCode: 'BIO2110F', type: 'paper', title: '试卷' });
  await client.uploadPdf('content-1', new File(['%PDF-test'], '期中卷.pdf', { type: 'application/pdf' }));
  await client.fetchSubmissions({ status: 'pending', query: '复习' });
  await client.fetchAuditLogs({ action: 'submission.approve' });
  await client.fetchActivities({ programId: 'laboratory-open-day' });
  await client.createActivity({ title: '实验室开放日回顾', externalUrl: 'https://mp.weixin.qq.com/s/demo' });
  await client.updateActivity('activity-1', { title: '实验室开放日纪实' });
  await client.publishActivity('activity-1');
  await client.archiveActivity('activity-1');

  assert.match(requests[0].path, /courseCode=BIO2110F/);
  assert.equal(requests[1].options.method, 'POST');
  assert.match(requests[1].options.body, /"title":"试卷"/);
  assert.equal(requests[2].options.method, 'PUT');
  assert.equal(requests[2].options.headers['x-admin-upload'], 'course-content');
  assert.equal(requests[2].options.headers['x-file-name'], encodeURIComponent('期中卷.pdf'));
  assert.equal(requests[2].options.body instanceof File, true);
  assert.match(requests[3].path, /api\/admin\/submissions/);
  assert.match(requests[4].path, /api\/admin\/audit-logs/);
  assert.match(requests[5].path, /api\/admin\/activities\?programId=laboratory-open-day/);
  assert.equal(requests[6].options.method, 'POST');
  assert.equal(requests[7].options.method, 'PATCH');
  assert.match(requests[8].path, /activity-1\/publish/);
  assert.match(requests[9].path, /activity-1\/archive/);
});

test('admin API client reports an unavailable backend without throwing', async () => {
  const client = createAdminApiClient(async () => {
    throw new Error('offline');
  });
  const result = await client.fetchContent({ courseCode: 'BIO2110F' });
  assert.equal(result.ok, false);
  assert.match(result.message, /管理服务/);
});

test('admin page uses the shared header, green sidebar, dense table, and explicit editor states', () => {
  const app = readFileSync('src/App.vue', 'utf8');
  const component = readFileSync('src/components/admin/AdminPage.vue', 'utf8');
  const css = readFileSync('src/styles/admin.css', 'utf8');

  assert.match(app, /AdminPage/);
  assert.match(app, /activePage === 'admin'/);
  assert.match(component, /admin-page__nav/);
  assert.match(component, /admin-content-table/);
  assert.match(component, /管理员登录/);
  assert.match(component, /首次注册/);
  assert.match(component, /保存草稿/);
  assert.match(component, /发布|下架/);
  assert.match(component, /管理服务暂时无法连接/);
  assert.match(component, /投稿审核/);
  assert.match(component, /initialUser/);
  assert.match(component, /activeApiClient/);
  assert.match(component, /演示数据仅保存在当前浏览器/);
  assert.match(component, /操作日志/);
  assert.match(component, /内容搜索/);
  assert.match(component, /活动管理/);
  assert.match(component, /新增推文/);
  assert.match(component, /推文链接/);
  assert.match(component, /添加到目录/);
  assert.match(component, /activityPrograms/);
  assert.match(component, /activityImageOptions/);
  assert.doesNotMatch(component, /推荐到首页“近期活动”/);
  assert.match(component, /activeApiClient\.value\.fetchActivities/);
  assert.match(css, /grid-template-columns:\s*188px\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /var\(--demo-primary\)/);
  assert.match(css, /@media\s*\(max-width:\s*860px\)/);
});
