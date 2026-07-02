import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectInk } from '../lib/detect.js';
import { classify, errorResult, exitCode, mapWithConcurrency } from '../lib/check.js';

function entry(name, content) {
  return { name, data: Buffer.from(content, 'utf8') };
}

function pkg(fields = {}) {
  return entry('package.json', JSON.stringify({ name: 'p', version: '1.0.0', ...fields }));
}

// Two hook definitions => detected as bundled.
const BUNDLED_SRC = 'function useInput(h){} const useApp = () => ({exit(){}});';

function classifyEntries(entries, downloads = null) {
  const detection = detectInk(entries);
  return classify({ packageName: 'p', version: '1.0.0', detection, entries, downloads });
}

describe('classify', () => {
  it('pass: does not use ink', () => {
    const r = classifyEntries([pkg(), entry('index.js', 'console.log(1);')]);
    assert.equal(r.status, 'pass');
    assert.equal(r.usesInk, false);
    assert.equal(r.error, null);
  });

  it('na: declares/references ink but does not bundle it', () => {
    const r = classifyEntries([pkg({ dependencies: { ink: '^5' } }), entry('cli.js', 'require("ink");')]);
    assert.equal(r.status, 'na');
    assert.equal(r.usesInk, true);
    assert.equal(r.attribution.found, null);
  });

  it('pass: bundles ink and attributes it (Vadym present)', () => {
    const r = classifyEntries([
      pkg(),
      entry('LICENSE', 'MIT License\nCopyright (c) Vadym Demedes'),
      entry('dist/bundle.js', BUNDLED_SRC),
    ]);
    assert.equal(r.status, 'pass');
    assert.equal(r.inkDetection.dependencyType, 'bundled');
    assert.equal(r.attribution.found, true);
  });

  it('fail: bundles ink with no attribution (true-bundler FAIL path)', () => {
    const r = classifyEntries([pkg(), entry('dist/bundle.js', BUNDLED_SRC)]);
    assert.equal(r.status, 'fail');
    assert.equal(r.inkDetection.dependencyType, 'bundled');
    assert.equal(r.attribution.found, false);
    assert.deepEqual(r.attribution.missingCopyrightHolders, ['Vadym Demedes']);
  });

  it('passes down monthly downloads', () => {
    const r = classifyEntries([pkg(), entry('index.js', '0;')], 4242);
    assert.equal(r.downloads, 4242);
  });
});

describe('exitCode', () => {
  it('returns 1 when any result is a violation', () => {
    assert.equal(exitCode([{ status: 'pass' }, { status: 'fail' }, { status: 'na' }]), 1);
  });

  it('returns 2 when there is an error but no violation', () => {
    assert.equal(exitCode([{ status: 'pass' }, { status: 'error' }]), 2);
  });

  it('returns 0 for only pass / na / skip', () => {
    assert.equal(exitCode([{ status: 'pass' }, { status: 'na' }, { status: 'skip' }]), 0);
  });

  it('prioritizes a violation over an error (exit 1)', () => {
    assert.equal(exitCode([{ status: 'error' }, { status: 'fail' }]), 1);
  });
});

describe('errorResult', () => {
  it('builds a skip/error result shape', () => {
    const r = errorResult('nope', 'skip', 'Package not found on npm');
    assert.equal(r.status, 'skip');
    assert.equal(r.error, 'Package not found on npm');
    assert.equal(r.usesInk, false);
    assert.equal(r.version, null);
  });
});

describe('mapWithConcurrency', () => {
  it('preserves input order and caps concurrency', async () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    let active = 0;
    let maxActive = 0;

    const out = await mapWithConcurrency(items, 3, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      active--;
      return n * 10;
    });

    assert.deepEqual(out, items.map((n) => n * 10));
    assert.ok(maxActive <= 3, `max concurrency ${maxActive} exceeded 3`);
    assert.ok(maxActive > 1, 'should run some tasks in parallel');
  });

  it('handles an empty list', async () => {
    const out = await mapWithConcurrency([], 4, async () => 1);
    assert.deepEqual(out, []);
  });
});
