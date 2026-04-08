import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectInk } from '../lib/detect.js';

function entry(name, content) {
  return { name, data: Buffer.from(content, 'utf8') };
}

function pkgJson(deps = {}, devDeps = {}, peerDeps = {}) {
  return entry('package.json', JSON.stringify({
    name: 'test-pkg',
    version: '1.0.0',
    dependencies: deps,
    devDependencies: devDeps,
    peerDependencies: peerDeps,
  }));
}

describe('detectInk', () => {
  describe('dependency detection', () => {
    it('detects ink in dependencies', () => {
      const result = detectInk([pkgJson({ ink: '^5.0.0' })]);
      assert.equal(result.usesInk, true);
      assert.equal(result.confidence, 'high');
      assert.equal(result.dependencyType, 'direct');
      assert.ok(result.evidence.some((e) => e.includes('"ink"')));
    });

    it('detects ink in devDependencies', () => {
      const result = detectInk([pkgJson({}, { ink: '^5.0.0' })]);
      assert.equal(result.usesInk, true);
      assert.equal(result.confidence, 'high');
    });

    it('detects ink in peerDependencies', () => {
      const result = detectInk([pkgJson({}, {}, { ink: '>=4.0.0' })]);
      assert.equal(result.usesInk, true);
      assert.equal(result.confidence, 'high');
    });

    it('detects ink-* packages', () => {
      const result = detectInk([pkgJson({ 'ink-spinner': '^1.0.0' })]);
      assert.equal(result.usesInk, true);
      assert.ok(result.evidence.some((e) => e.includes('ink-spinner')));
    });

    it('detects @inkjs/* packages', () => {
      const result = detectInk([pkgJson({ '@inkjs/ui': '^2.0.0' })]);
      assert.equal(result.usesInk, true);
    });

    it('detects pastel as ink-related', () => {
      const result = detectInk([pkgJson({ pastel: '^3.0.0' })]);
      assert.equal(result.usesInk, true);
    });

    it('does not flag unrelated packages', () => {
      const result = detectInk([pkgJson({ react: '^18.0.0', chalk: '^5.0.0' })]);
      assert.equal(result.usesInk, false);
      assert.equal(result.confidence, 'none');
    });
  });

  describe('bundled code detection', () => {
    it('detects require("ink") in JS files', () => {
      const entries = [
        pkgJson({}),
        entry('dist/cli.js', 'const ink = require("ink");'),
      ];
      const result = detectInk(entries);
      assert.equal(result.usesInk, true);
      assert.equal(result.confidence, 'high');
      assert.equal(result.dependencyType, 'bundled');
    });

    it('detects from "ink" import in JS files', () => {
      const entries = [
        pkgJson({}),
        entry('dist/index.js', 'import { render } from "ink";'),
      ];
      const result = detectInk(entries);
      assert.equal(result.usesInk, true);
      assert.equal(result.confidence, 'high');
    });

    it('detects from \'ink\' with single quotes', () => {
      const entries = [
        pkgJson({}),
        entry('dist/index.js', "import { render } from 'ink';"),
      ];
      const result = detectInk(entries);
      assert.equal(result.usesInk, true);
    });

    it('detects ink-specific hooks with React as medium confidence', () => {
      const entries = [
        pkgJson({}),
        entry('dist/app.js', `
          const React = require("react");
          function App() {
            useInput((input) => {});
            const { exit } = useApp();
            return createElement("div");
          }
        `),
      ];
      const result = detectInk(entries);
      assert.equal(result.usesInk, true);
      assert.equal(result.confidence, 'medium');
    });

    it('does not flag ink hooks without React indicators', () => {
      const entries = [
        pkgJson({}),
        entry('dist/utils.js', 'function useInput(handler) { /* custom hook */ }'),
      ];
      const result = detectInk(entries);
      // Only 1 identifier and no React — not enough
      assert.equal(result.usesInk, false);
    });

    it('skips files in node_modules', () => {
      const entries = [
        pkgJson({}),
        entry('node_modules/ink/index.js', 'from "ink"'),
      ];
      const result = detectInk(entries);
      assert.equal(result.usesInk, false);
    });

    it('handles package with no package.json gracefully', () => {
      const entries = [entry('dist/index.js', 'console.log("hello")')];
      const result = detectInk(entries);
      assert.equal(result.usesInk, false);
    });
  });
});
