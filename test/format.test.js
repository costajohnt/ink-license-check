import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatText, formatJson, formatReport } from '../lib/format.js';

// Synthetic results (no network) covering each status.
const passBundled = {
  package: 'good-cli', version: '1.0.0', usesInk: true,
  inkDetection: { confidence: 'bundled', dependencyType: 'bundled', evidence: ['ink hooks defined in bundled source: useInput, useApp'] },
  attribution: { found: true, locations: ['LICENSE'], missingCopyrightHolders: [] },
  downloads: 1234, status: 'pass', error: null,
};
const failBundled = {
  package: 'bad-cli', version: '2.0.0', usesInk: true,
  inkDetection: { confidence: 'bundled', dependencyType: 'bundled', evidence: ['ink hooks defined in bundled source: useInput, useApp'] },
  attribution: { found: false, vadymDemedes: false, sindreSorhus: false, locations: [], missingCopyrightHolders: ['Vadym Demedes'] },
  downloads: 5_000_000, status: 'fail', error: null,
};
const naDep = {
  package: 'dep-cli', version: '3.0.0', usesInk: true,
  inkDetection: { confidence: 'declared', dependencyType: 'direct', evidence: ['"ink" in dependencies'] },
  attribution: { found: null, locations: [], missingCopyrightHolders: [] },
  downloads: 42_000, status: 'na', error: null,
};

describe('formatText', () => {
  it('renders n/a for a dependency-only package (not FAIL)', () => {
    const out = formatText([naDep], { version: '1.1.0' });
    assert.match(out, /n\/a/);
    assert.match(out, /via dependency \(not bundled\)/);
    assert.doesNotMatch(out, /FAIL/);
    assert.match(out, /No violations found/);
  });

  it('renders FAIL with the missing holder', () => {
    const out = formatText([failBundled], { version: '1.1.0' });
    assert.match(out, /FAIL/);
    assert.match(out, /Missing: Vadym Demedes/);
    assert.match(out, /1 violation found/);
  });

  it('renders PASS for an attributed bundle', () => {
    const out = formatText([passBundled], { version: '1.1.0' });
    assert.match(out, /PASS/);
    assert.match(out, /attribution found in LICENSE/);
  });
});

describe('formatJson', () => {
  it('emits results and a summary counting na', () => {
    const parsed = JSON.parse(formatJson([passBundled, failBundled, naDep]));
    assert.equal(parsed.results.length, 3);
    assert.equal(parsed.summary.na, 1);
    assert.equal(parsed.summary.fail, 1);
    assert.equal(parsed.summary.pass, 1);
  });
});

describe('formatReport', () => {
  it('uses a "Bundles Ink" metric and a dependency-only table', () => {
    const out = formatReport([passBundled, failBundled, naDep], { version: '1.1.0' });
    assert.match(out, /\| Bundles Ink \|/);
    assert.match(out, /Uses Ink via dependency \(not bundled/);
    assert.match(out, /## Violations/);
    assert.match(out, /## Uses Ink via dependency \(not bundled\)/);
    // The n/a package appears in the dependency-only table, not as a violation.
    assert.match(out, /\| dep-cli \|/);
  });
});
