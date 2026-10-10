import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePackageSpec } from '../lib/registry.js';

describe('parsePackageSpec', () => {
  it('returns a bare name with no spec', () => {
    assert.deepEqual(parsePackageSpec('ink'), { name: 'ink', spec: null });
  });

  it('splits an exact version', () => {
    assert.deepEqual(parsePackageSpec('ink@4.0.0'), { name: 'ink', spec: '4.0.0' });
  });

  it('splits a dist-tag', () => {
    assert.deepEqual(parsePackageSpec('ink@next'), { name: 'ink', spec: 'next' });
  });

  it('keeps the leading @ of a scoped name', () => {
    assert.deepEqual(parsePackageSpec('@org/cli'), { name: '@org/cli', spec: null });
    assert.deepEqual(parsePackageSpec('@org/cli@1.2.3'), { name: '@org/cli', spec: '1.2.3' });
  });

  it('treats a trailing @ as no spec', () => {
    assert.deepEqual(parsePackageSpec('ink@'), { name: 'ink', spec: null });
  });
});
