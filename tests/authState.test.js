import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultUserId, getTestUserById, testUsers } from '../src/data/config/testUsers.js';
import {
  canComment,
  canFavorite,
  canSubmitResource,
  createCommentMessage,
  createSubmissionMessage,
  getAccountState,
  getVerificationBadges,
  isAdministrator,
} from '../src/services/authService.js';
import { mergeUserAuthOverride } from '../src/services/accountStateService.js';
import { getNextAvatarColor } from '../src/services/avatarService.js';
import { createFavoriteKey, isFavorited, toggleFavorite } from '../src/services/favoriteService.js';

test('account states expose only guest and student labels to ordinary users', () => {
  assert.equal(defaultUserId, 'guest');
  assert.deepEqual(
    testUsers.map((user) => user.id),
    ['guest', 'student', 'admin'],
  );

  assert.equal(getAccountState(getTestUserById('guest')).label, '游客');
  assert.equal(getAccountState(getTestUserById('student')).label, '学号认证学生');
  assert.equal(getAccountState(getTestUserById('admin')).label, '管理员');
});

test('backend administrator role has a dedicated account label and verified permissions', () => {
  const admin = {
    id: 'cc98-99', role: 'admin', nickname: '管理员',
    verifications: { cc98: false, email: true },
  };
  assert.equal(getAccountState(admin).label, '管理员');
  assert.deepEqual(getVerificationBadges(admin), ['管理员', '学号认证']);
  assert.equal(canSubmitResource(admin), true);
  assert.equal(canComment(admin), true);
  assert.equal(isAdministrator(admin), true);
});

test('resource permissions allow verified users to submit and comment while guests are blocked', () => {
  const guest = getTestUserById('guest');
  const cc98User = {
    ...guest,
    id: 'legacy-cc98-user',
    role: 'student',
    verifications: { cc98: true, email: false },
  };
  const emailUser = getTestUserById('student');

  assert.equal(canSubmitResource(guest), false);
  assert.equal(canComment(guest), false);
  assert.equal(canFavorite(guest), false);

  assert.equal(canSubmitResource(cc98User), false);
  assert.equal(canComment(cc98User), false);
  assert.equal(canFavorite(cc98User), false);

  assert.equal(canSubmitResource(emailUser), true);
  assert.equal(canComment(emailUser), true);
  assert.equal(canFavorite(emailUser), true);
});

test('verification badges stay compatible with future backend auth providers', () => {
  assert.deepEqual(getVerificationBadges(getTestUserById('guest')), ['未登录']);
  assert.deepEqual(getVerificationBadges(getTestUserById('student')), ['学号认证']);
  assert.deepEqual(getVerificationBadges(getTestUserById('admin')), ['管理员', '学号认证']);
});

test('a legacy CC98-only override cannot enable persistent-write permissions', () => {
  const prototypeUser = mergeUserAuthOverride(getTestUserById('guest'), {
    guest: {
      verifications: { cc98: true },
      cc98Nickname: 'cc98_bio_visitor',
    },
  });

  assert.equal(getAccountState(prototypeUser).label, '游客');
  assert.deepEqual(getVerificationBadges(prototypeUser), ['未登录']);
  assert.equal(canSubmitResource(prototypeUser), false);
  assert.equal(canComment(prototypeUser), false);
  assert.equal(canFavorite(prototypeUser), false);
});

test('favorite helpers keep favorites keyed by content type and item id', () => {
  const key = createFavoriteKey('BIO2110F', 'materials', '1');
  const afterAdd = toggleFavorite([], key);
  const afterRemove = toggleFavorite(afterAdd, key);

  assert.equal(key, 'BIO2110F:materials:1');
  assert.equal(isFavorited(afterAdd, key), true);
  assert.equal(isFavorited(afterRemove, key), false);
});

test('message factories route submissions to administrators and comments to content owners', () => {
  const submitter = getTestUserById('student');
  const submission = createSubmissionMessage({
    fromUser: submitter,
    courseCode: 'BIO2110F',
    tabId: 'materials',
    title: '补充一份复习资料',
  });
  const comment = createCommentMessage({
    fromUser: submitter,
    toUserId: 'student',
    courseCode: 'BIO2110F',
    tabId: 'experiences',
    itemTitle: '先画结构图，再处理零碎记忆',
  });

  assert.equal(submission.toRole, 'admin');
  assert.match(submission.title, /投稿申请/);
  assert.equal(comment.toUserId, 'student');
  assert.match(comment.title, /新评论/);
});

test('avatar helper cycles through stable front-end placeholder colors', () => {
  assert.equal(getNextAvatarColor('#708090'), '#2d4a2b');
  assert.equal(getNextAvatarColor('#0066ff'), '#708090');
  assert.equal(getNextAvatarColor('#unknown'), '#708090');
});
