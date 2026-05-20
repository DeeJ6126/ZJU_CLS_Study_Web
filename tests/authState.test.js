import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultUserId, getTestUserById, testUsers } from '../src/data/config/testUsers.js';
import {
  canComment,
  canFavorite,
  canRequestCc98PrototypeVerification,
  canSubmitResource,
  createCommentMessage,
  createSubmissionMessage,
  getAccountState,
  getVerificationBadges,
} from '../src/services/authService.js';
import { mergeUserAuthOverride } from '../src/services/accountStateService.js';
import { getNextAvatarColor } from '../src/services/avatarService.js';
import { createFavoriteKey, isFavorited, toggleFavorite } from '../src/services/favoriteService.js';

test('test users cover guest, single verification, dual verification, and developer states', () => {
  assert.equal(defaultUserId, 'guest');
  assert.deepEqual(
    testUsers.map((user) => user.id),
    ['guest', 'cc98-user', 'email-user', 'dual-user', 'developer'],
  );

  assert.equal(getAccountState(getTestUserById('guest')).label, '游客');
  assert.equal(getAccountState(getTestUserById('cc98-user')).label, 'CC98认证');
  assert.equal(getAccountState(getTestUserById('email-user')).label, '邮箱认证');
  assert.equal(getAccountState(getTestUserById('dual-user')).label, 'CC98 + 邮箱认证');
  assert.equal(getAccountState(getTestUserById('developer')).label, '开发者');
});

test('resource permissions allow verified users to submit and comment while guests are blocked', () => {
  const guest = getTestUserById('guest');
  const cc98User = getTestUserById('cc98-user');
  const developer = getTestUserById('developer');

  assert.equal(canSubmitResource(guest), false);
  assert.equal(canComment(guest), false);
  assert.equal(canFavorite(guest), false);

  assert.equal(canSubmitResource(cc98User), true);
  assert.equal(canComment(cc98User), true);
  assert.equal(canFavorite(cc98User), true);

  assert.equal(canSubmitResource(developer), true);
  assert.equal(canComment(developer), true);
});

test('verification badges stay compatible with future backend auth providers', () => {
  assert.deepEqual(getVerificationBadges(getTestUserById('guest')), ['未登录']);
  assert.deepEqual(getVerificationBadges(getTestUserById('cc98-user')), ['CC98认证']);
  assert.deepEqual(getVerificationBadges(getTestUserById('email-user')), ['邮箱认证']);
  assert.deepEqual(getVerificationBadges(getTestUserById('dual-user')), ['CC98认证', '邮箱认证']);
});

test('cc98 front-end prototype override enables the existing verified-user model', () => {
  const prototypeUser = mergeUserAuthOverride(getTestUserById('guest'), {
    guest: {
      verifications: { cc98: true },
      cc98Nickname: 'cc98_bio_visitor',
    },
  });

  assert.equal(getAccountState(prototypeUser).label, 'CC98认证');
  assert.deepEqual(getVerificationBadges(prototypeUser), ['CC98认证']);
  assert.equal(canSubmitResource(prototypeUser), true);
  assert.equal(canComment(prototypeUser), true);
  assert.equal(canFavorite(prototypeUser), true);
  assert.equal(canRequestCc98PrototypeVerification(prototypeUser), false);
});

test('cc98 prototype form visibility stays in the auth service', () => {
  assert.equal(canRequestCc98PrototypeVerification(getTestUserById('guest')), true);
  assert.equal(canRequestCc98PrototypeVerification(getTestUserById('email-user')), true);
  assert.equal(canRequestCc98PrototypeVerification(getTestUserById('cc98-user')), false);
  assert.equal(canRequestCc98PrototypeVerification(getTestUserById('developer')), false);
});

test('favorite helpers keep favorites keyed by content type and item id', () => {
  const key = createFavoriteKey('BIO2110F', 'materials', '1');
  const afterAdd = toggleFavorite([], key);
  const afterRemove = toggleFavorite(afterAdd, key);

  assert.equal(key, 'BIO2110F:materials:1');
  assert.equal(isFavorited(afterAdd, key), true);
  assert.equal(isFavorited(afterRemove, key), false);
});

test('message factories route submissions to developers and comments to content owners', () => {
  const submitter = getTestUserById('dual-user');
  const submission = createSubmissionMessage({
    fromUser: submitter,
    courseCode: 'BIO2110F',
    tabId: 'materials',
    title: '补充一份复习资料',
  });
  const comment = createCommentMessage({
    fromUser: submitter,
    toUserId: 'cc98-user',
    courseCode: 'BIO2110F',
    tabId: 'experiences',
    itemTitle: '先画结构图，再处理零碎记忆',
  });

  assert.equal(submission.toRole, 'developer');
  assert.match(submission.title, /投稿申请/);
  assert.equal(comment.toUserId, 'cc98-user');
  assert.match(comment.title, /新评论/);
});

test('avatar helper cycles through stable front-end placeholder colors', () => {
  assert.equal(getNextAvatarColor('#708090'), '#2d4a2b');
  assert.equal(getNextAvatarColor('#0066ff'), '#708090');
  assert.equal(getNextAvatarColor('#unknown'), '#708090');
});
