import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHrefActive, isNavigationItemActive } from '../src/lib/navigationMatching.ts';

test('dashboard does not stay selected on child pages', () => {
  assert.equal(isHrefActive('/admin/peserta', '', '/admin'), false);
  assert.equal(isHrefActive('/admin', '', '/admin'), true);
});
test('module matching respects path boundaries and nested records', () => {
  assert.equal(isHrefActive('/admin/program/123/kurikulum', '', '/admin/program'), true);
  assert.equal(isHrefActive('/admin/program-lama', '', '/admin/program'), false);
});
test('query navigation handles multiple params and selects the most specific child', () => {
  const children = ['/admin/peserta', '/admin/peserta?tab=directory', '/admin/peserta?tab=operations'];
  const active = children.filter((href) => isHrefActive('/admin/peserta', '?page=2&tab=operations', href, false)).sort((a, b) => b.length - a.length)[0];
  assert.equal(active, '/admin/peserta?tab=operations');
  assert.equal(isHrefActive('/admin/peserta', '?tab=directory', children[2], false), false);
});
test('alternate routes highlight their owning module', () => {
  assert.equal(isNavigationItemActive('/learner/lesson/123', '', { href: '/learner/program-saya', activePathPrefixes: ['/learner/lesson'] }), true);
});
