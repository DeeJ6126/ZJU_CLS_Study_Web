import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNoticeDate, formatNoticeFileSize, noticeAttachmentType, noticeAudienceLabel,
  noticeCohortOptions, noticeDeadlineState, noticeDeadlineTimestamp, noticeDetailHref, safeNoticeUrl,
} from '../src/services/noticeViewService.js';

test('notice dates and exact deadlines use Shanghai instead of the machine timezone', () => {
  assert.equal(formatNoticeDate('2026-09-30T16:30:00Z', true), '2026-10-01 00:30');
  assert.equal(formatNoticeDate('2026-10-01'), '2026-10-01');
  const notice = { deadline: '2026-09-30T16:30:00Z' };
  assert.equal(noticeDeadlineState(notice, '2026-09-30T16:29:59Z').id, 'active');
  assert.equal(noticeDeadlineState(notice, '2026-09-30T16:30:00Z').id, 'expired');
  assert.equal(noticeDeadlineState(notice, '2026-09-30T16:30:00.001Z').id, 'expired');
  assert.equal(noticeDeadlineState(notice, '2026-10-01T00:00:00Z').date, '2026-10-01 00:30');
});

test('date-only deadlines remain active through the final Shanghai millisecond', () => {
  const notice = { deadline: '2026-10-01' };
  assert.equal(noticeDeadlineState(notice, '2026-10-01T15:59:59.999Z').id, 'active');
  assert.equal(noticeDeadlineState(notice, '2026-10-01T16:00:00Z').id, 'expired');
  assert.equal(noticeDeadlineTimestamp('2026-02-30'), null);
  assert.equal(noticeDeadlineTimestamp('bad date'), null);
  assert.equal(noticeDeadlineState({ deadline: '' }).id, 'none');
});

test('audience labels preserve audience prose and major/cohort targeting', () => {
  assert.equal(noticeAudienceLabel({ audience: '本科生', majorIds: ['biology'], cohortYears: [2024, 2025] }), '本科生 · 生物科学 · 2024级、2025级');
  assert.equal(noticeAudienceLabel({}), '全体学生');
  assert.equal(noticeDetailHref('notice/id ?'), '#notices/notice%2Fid%20%3F');
});

test('original links reject dangerous schemes while attachments allow same-origin paths', () => {
  assert.equal(safeNoticeUrl('https://www.zju.edu.cn/notice/1'), 'https://www.zju.edu.cn/notice/1');
  assert.equal(safeNoticeUrl('/zjubio/api/notices/1/attachments/2', { attachment: true }), '/zjubio/api/notices/1/attachments/2');
  for (const link of ['javascript:alert(1)', 'data:text/html,test', '//evil.example/file', '/\\evil.example/file', 'https://name:pass@example.com', 'https://example.com/\nfile']) {
    assert.equal(safeNoticeUrl(link, { attachment: true }), '');
  }
  assert.equal(safeNoticeUrl('/relative-source'), '');
  assert.equal(safeNoticeUrl('/resource/notice.pdf', { attachment: true }), '');
  assert.equal(safeNoticeUrl('https://example.com/notice.pdf', { attachment: true }), '');
});

test('attachments show supported document formats and readable sizes', () => {
  assert.equal(noticeAttachmentType({ fileName: 'notice.PDF' }), 'PDF');
  assert.equal(noticeAttachmentType({ fileName: 'form.docx' }), 'Word');
  assert.equal(noticeAttachmentType({ fileName: 'table.xls' }), 'Excel');
  assert.equal(formatNoticeFileSize(1024 * 1024), '1.0 MB');
  assert.equal(formatNoticeFileSize(10), '1 KB');
  assert.equal(formatNoticeFileSize(-1), '');
});

test('cohort choices update at Shanghai new year and retain older profile years', () => {
  const choices = noticeCohortOptions('2025-12-31T16:00:00Z', 2017);
  assert.equal(choices[0], '2027');
  assert.ok(choices.includes('2017'));
  assert.equal(new Set(choices).size, choices.length);
});
