import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContentSource, validateContentSource } from '../src/services/contentSourceService.js';

test('source metadata normalizes legacy CC98 records and generic original-post links', () => {
  assert.deepEqual(normalizeContentSource({ cc98Url: ' https://www.cc98.org/topic/1 ' }), {
    sourcePlatform: 'cc98', sourceUrl: 'https://www.cc98.org/topic/1', cc98Url: 'https://www.cc98.org/topic/1',
  });
  const other = { sourcePlatform: 'duoduo', sourceUrl: 'https://duoduo.example/topic/1', cc98Url: '' };
  assert.deepEqual(normalizeContentSource({ title: 'Changed' }, other), other);
  assert.deepEqual(normalizeContentSource({ cc98Url: '' }, other), other);
  assert.deepEqual(normalizeContentSource({ sourceUrl: '', sourcePlatform: 'other' }, other), {
    sourcePlatform: 'other', sourceUrl: '', cc98Url: '',
  });
  assert.deepEqual(normalizeContentSource({ cc98Url: '' }, { sourcePlatform: 'cc98', sourceUrl: 'https://www.cc98.org/topic/1' }), {
    sourcePlatform: 'cc98', sourceUrl: '', cc98Url: '',
  });
});

test('source validation only allows known platforms and safe HTTP URLs', () => {
  for (const sourceUrl of ['javascript:alert(1)', 'data:text/html,test', '//example.org/topic', 'https://user:pass@example.org', 'https://example.org/\nfoo', 'not a URL']) {
    assert.equal(validateContentSource({ sourcePlatform: 'other', sourceUrl }).ok, false, sourceUrl);
  }
  assert.equal(validateContentSource({ sourcePlatform: 'invented' }).ok, false);
  for (const sourcePlatform of ['cc98', 'duoduo', 'other']) {
    assert.equal(validateContentSource({ sourcePlatform, sourceUrl: 'https://example.org/topic' }).ok, true);
    assert.equal(validateContentSource({ sourcePlatform, sourceUrl: '' }).ok, true);
  }
});
