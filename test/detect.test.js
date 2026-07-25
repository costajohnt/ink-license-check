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
        entry('dist/index.js', 'import { render } from \'ink\';'),
      ];
      const result = detectInk(entries);
      assert.equal(result.usesInk, true);
      assert.equal(result.bundlesInk, false);
    });

    it('detects inlined ink implementation (hook definitions) as bundled', () => {
      const entries = [
        pkgJson({}),
        entry('dist/app.js', `
          const React = require("react");
          function useInput(handler) { /* ink impl */ }
          const useApp = () => ({ exit() {} });
        `),
      ];
      const result = detectInk(entries);
      assert.equal(result.usesInk, true);
      assert.equal(result.bundlesInk, true);
      assert.equal(result.confidence, 'bundled');
      assert.equal(result.dependencyType, 'bundled');
      assert.deepEqual(result.definedInkIds.sort(), ['useApp', 'useInput']);
    });

    it('does NOT flag an ordinary consumer that imports and calls multiple hooks', () => {
      // The shape of every real Ink CLI: imports hooks and calls them. It ships
      // no Ink source, so it must be n/a, never a FAIL. (Reviewer-reproduced
      // false positive.)
      const entries = [
        pkgJson({}),
        entry('dist/cli.js', `
          import React from "react";
          import { useInput, useApp } from "ink";
          function App() {
            useInput((input) => {});
            const { exit } = useApp();
            return React.createElement("div");
          }
        `),
      ];
      const result = detectInk(entries);
      assert.equal(result.referencesInk, true);
      assert.equal(result.bundlesInk, false);
      assert.deepEqual(result.definedInkIds, []);
      assert.equal(result.dependencyType, 'direct');
    });

    it('definition-scans webpack bundles whose only import evidence is a module-map key', () => {
      // Regression for the module-map false negative: webpack inlines vendored
      // Ink source into the same file that carries the '"ink":' module-map key,
      // so that key must not exempt the file from definition scanning.
      const entries = [
        pkgJson({}),
        entry('dist/bundle.js', `
          var modules = { "ink": function(m, e, r) { /* inlined */ } };
          function useInput(handler) { /* ink impl */ }
          const useApp = () => ({ exit() {} });
        `),
      ];
      const result = detectInk(entries);
      assert.equal(result.bundlesInk, true);
      assert.deepEqual(result.definedInkIds.sort(), ['useApp', 'useInput']);
    });

    it('still treats a live external import as a reference, not a bundle', () => {
      const entries = [
        pkgJson({ ink: '^5.0.0' }),
        entry('dist/app.js', `
          import { useInput, useApp } from "ink";
          function useInput2() {}
        `),
      ];
      const result = detectInk(entries);
      assert.equal(result.bundlesInk, false);
    });

    it('does not treat a single hook definition as bundling', () => {
      const entries = [
        pkgJson({}),
        entry('dist/utils.js', 'function useInput(handler) { /* custom hook */ }'),
      ];
      const result = detectInk(entries);
      // Only 1 defined identifier — below the bundling threshold.
      assert.equal(result.bundlesInk, false);
      assert.equal(result.usesInk, false);
    });

    it('does not let one hook used across two files reach the threshold', () => {
      const entries = [
        pkgJson({}),
        entry('dist/a.js', 'import { useInput } from "ink"; useInput(() => {});'),
        entry('dist/b.js', 'import { useInput } from "ink"; useInput(() => {});'),
      ];
      const result = detectInk(entries);
      assert.equal(result.bundlesInk, false);
      assert.deepEqual(result.definedInkIds, []);
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

    it('does NOT flag a re-export wrapper as bundled', () => {
      // A wrapper that imports Ink's hooks and re-exports them under the same
      // names matches the `const useInput = ...` definition shape, but the file
      // resolves Ink externally, so it ships no Ink source and owes nothing.
      const entries = [
        pkgJson({}),
        entry('index.js', [
          'import { useInput as inkUseInput, useApp as inkUseApp } from \'ink\';',
          'export const useInput = inkUseInput;',
          'export const useApp = inkUseApp;',
        ].join('\n')),
      ];
      const result = detectInk(entries);
      assert.equal(result.referencesInk, true);
      assert.equal(result.bundlesInk, false);
      assert.deepEqual(result.definedInkIds, []);
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
