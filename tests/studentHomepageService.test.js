import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentHomepageStore } from '../server/studentHomepage/studentHomepageStore.js';
import {
  approveStudentHomepageApplication,
  createStudentHomepage,
  createStudentHomepageApplication,
  deleteStudentHomepage,
  rejectStudentHomepageApplication,
  updateStudentHomepage,
} from '../server/studentHomepage/studentHomepageService.js';

function setup() {
  const store = createStudentHomepageStore({ filename: ':memory:' });
  store.initialize();
  return {
    store,
    create: createStudentHomepage(store),
    update: updateStudentHomepage(store),
    remove: deleteStudentHomepage(store),
    submit: createStudentHomepageApplication(store),
    approve: approveStudentHomepageApplication(store),
    reject: rejectStudentHomepageApplication(store),
  };
}

test('student homepage service rejects empty name and invalid href', () => {
  const { create } = setup();
  assert.equal(create({ name: '', href: 'https://x.example' }).ok, false);
  assert.equal(create({ name: 'A', href: 'not a url' }).ok, false);
  assert.equal(create({ name: 'A', href: 'ftp://x.example' }).ok, false);
});

test('student homepage service creates a valid entry', () => {
  const { create, store } = setup();
  const result = create({ name: ' 同学A ', href: 'https://a.example', sortOrder: '2' });
  assert.equal(result.ok, true);
  assert.equal(result.homepage.name, '同学A');
  assert.equal(result.homepage.sortOrder, 2);
  assert.equal(store.listHomepages().length, 1);
});

test('student homepage service update validates against current values', () => {
  const { create, update, store } = setup();
  const created = create({ name: 'A', href: 'https://a.example' }).homepage;
  const bad = update(created.id, { href: '' });
  assert.equal(bad.ok, false);
  const ok = update(created.id, { href: 'https://b.example', sortOrder: '9' });
  assert.equal(ok.ok, true);
  assert.equal(ok.homepage.href, 'https://b.example');
  assert.equal(ok.homepage.sortOrder, 9);
  assert.equal(store.findHomepageById(created.id).href, 'https://b.example');
});

test('student homepage service rejects missing entries', () => {
  const { update, remove } = setup();
  assert.equal(update('missing', { name: 'x' }).ok, false);
  assert.equal(remove('missing').ok, false);
});

test('student homepage application service submits and decides an application', () => {
  const { submit, approve, store } = setup();
  const submitted = submit({
    name: 'New A', href: 'https://new.example', intro: '我是生科同学', contact: 'wechat: new-a',
    note: '请审核',
  }, { id: 7, nickname: '申请人' });
  assert.equal(submitted.ok, true);
  assert.equal(submitted.application.status, 'pending');
  assert.equal(submitted.application.applicantNickname, '申请人');
  assert.equal(submitted.application.intro, '我是生科同学');
  assert.equal(submitted.application.contact, 'wechat: new-a');
  assert.equal(store.listApplications().length, 1);

  const approved = approve(submitted.application.id, { adminId: 1, decisionNote: '通过' });
  assert.equal(approved.ok, true);
  assert.equal(approved.application.status, 'approved');
  assert.equal(approved.homepage.name, 'New A');
  assert.equal(approved.homepage.status, 'approved');
  assert.equal(store.listHomepages().length, 1);
  assert.equal(store.countPendingApplications(), 0);
});

test('student homepage application service rejects invalid input', () => {
  const { submit } = setup();
  assert.equal(submit({ name: '', href: 'https://x.example' }).ok, false);
  assert.equal(submit({ name: 'A', href: '' }).ok, false);
  assert.equal(submit({ name: 'A', href: 'https://x.example', note: 'x'.repeat(501) }).ok, false);
  assert.equal(submit({
    name: 'A', href: 'https://x.example', intro: '', contact: 'x', note: '',
  }, { id: 1 }).ok, false);
  assert.equal(submit({
    name: 'A', href: 'https://x.example', intro: 'x', contact: '', note: '',
  }, { id: 1 }).ok, false);
});

test('student homepage application service rejects anonymous submitter', () => {
  const { submit, store } = setup();
  assert.equal(submit({
    name: 'A', href: 'https://x.example', intro: 'intro', contact: 'contact', note: '',
  }).ok, false);
  assert.equal(store.listApplications().length, 0);
});

test('student homepage application service submits and admin can list it', () => {
  const { submit, approve, store } = setup();
  const submitted = submit({
    name: '张三', href: 'https://zhang.example', intro: '张三的个人主页', contact: 'email: zhang@x',
  }, { id: 'guest-1', nickname: '访客同学' });
  assert.equal(submitted.ok, true);
  assert.equal(store.listApplications({ status: 'pending' }).length, 1);
  const approved = approve(submitted.application.id, { adminId: 1, decisionNote: '同意' });
  assert.equal(approved.ok, true);
  assert.equal(store.listApplications({ status: 'pending' }).length, 0);
  assert.equal(store.listHomepages().some((item) => item.href === 'https://zhang.example' && item.status === 'approved'), true);
});

test('student homepage application service blocks approving duplicates or missing entries', () => {
  const { submit, approve, reject, store } = setup();
  const first = submit({
    name: 'A', href: 'https://a.example', intro: 'a 的介绍', contact: 'a',
  }, { id: 1, nickname: 'A' }).application;
  const second = submit({
    name: 'A2', href: 'https://a.example', intro: 'a2 的介绍', contact: 'a2',
  }, { id: 2, nickname: 'A2' }).application;
  assert.equal(approve(first.id, { adminId: 1 }).ok, true);
  assert.equal(approve(second.id, { adminId: 1 }).ok, false);
  assert.equal(approve('missing', { adminId: 1 }).ok, false);

  const third = submit({
    name: 'B', href: 'https://b.example', intro: 'b 的介绍', contact: 'b',
  }, { id: 3, nickname: 'B' }).application;
  assert.equal(reject(third.id, { adminId: 1, decisionNote: 'no' }).ok, true);
  assert.equal(approve(third.id, { adminId: 1 }).ok, false);
  assert.equal(store.listHomepages().length, 1);
});

