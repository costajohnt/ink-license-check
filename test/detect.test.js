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
    it('detects ink in dependencies as a declaration, not a bundle', () => {
      const result = detectInk([pkgJson({ ink: '^5.0.0' })]);
      assert.equal(result.usesInk, true);
      assert.equal(result.declaresInk, true);
      assert.equal(result.bundlesInk, false);
      assert.equal(result.confidence, 'declared');
      assert.equal(result.dependencyType, 'direct');
      assert.ok(result.evidence.some((e) => e.includes('"ink"')));
    });

    it('ignores ink in devDependencies (never shipped)', () => {
      const result = detectInk([pkgJson({}, { ink: '^5.0.0' })]);
      assert.equal(result.usesInk, false);
      assert.equal(result.declaresInk, false);
      assert.equal(result.confidence, 'none');
    });

    it('ignores ink in peerDependencies (supplied by consumer)', () => {
      const result = detectInk([pkgJson({}, {}, { ink: '>=4.0.0' })]);
      assert.equal(result.usesInk, false);
      assert.equal(result.declaresInk, false);
      assert.equal(result.confidence, 'none');
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

  describe('code scanning', () => {
    it('treats require("ink") as an external reference, not bundling', () => {
      const entries = [
        pkgJson({}),
        entry('dist/cli.js', 'const ink = require("ink");'),
      ];
      const result = detectInk(entries);
      assert.equal(result.usesInk, true);
      assert.equal(result.referencesInk, true);
      assert.equal(result.bundlesInk, false);
      assert.equal(result.dependencyType, 'direct');
    });

    it('treats from "ink" import as an external reference, not bundling', () => {
      const entries = [
        pkgJson({}),
        entry('dist/index.js', 'import { render } from "ink";'),
      ];
      const result = detectInk(entries);
      assert.equal(result.usesInk, true);
      assert.equal(result.referencesInk, true);
      assert.equal(result.bundlesInk, false);
    });

    it('handles from \'ink\' with single quotes', () => {
      const entries = [
        pkgJson({}),
        entry('dist/index.js', "import { render } from 'ink';"),
      ];
      const result = detectInk(entries);
      assert.equal(result.usesInk, true);
      assert.equal(result.bundlesInk, false);
    });

    it('detects inlined ink implementation (hooks + React) as bundled', () => {
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
      assert.equal(result.bundlesInk, true);
      assert.equal(result.confidence, 'bundled');
      assert.equal(result.dependencyType, 'bundled');
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

  describe('declared / referenced vs bundled', () => {
    it('does not flag a package that declares ink and imports it (ordinary consumer)', () => {
      // e.g. gatsby-cli / ink-spinner: reference ink, ship no ink source.
      const entries = [
        pkgJson({ ink: '^5.0.0', 'ink-spinner': '^5.0.0' }),
        entry('lib/reporter.js', 'const ink = require("ink");'),
      ];
      const result = detectInk(entries);
      assert.equal(result.usesInk, true);
      assert.equal(result.declaresInk, true);
      assert.equal(result.referencesInk, true);
      assert.equal(result.bundlesInk, false);
      assert.equal(result.dependencyType, 'direct');
    });

    it('flags a package that inlines ink source with no dependency', () => {
      // Ink's implementation vendored/inlined: its hooks appear in the source.
      const entries = [
        pkgJson({}),
        entry('dist/bundle.js', `
          const React = require("react");
          export function useInput(handler) { /* ink impl */ }
          export function useApp() { return { exit() {} }; }
          export function useStdout() {}
          function render() { return createElement("div"); }
        `),
      ];
      const result = detectInk(entries);
      assert.equal(result.declaresInk, false);
      assert.equal(result.bundlesInk, true);
      assert.equal(result.dependencyType, 'bundled');
    });
  });
});
