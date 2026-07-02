import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkAttribution } from '../lib/attribution.js';

function entry(name, content) {
  return { name, data: Buffer.from(content, 'utf8') };
}

// Ink's LICENSE names BOTH holders, so a compliant attribution credits both.
const BOTH = 'Copyright (c) Vadym Demedes\nCopyright (c) Sindre Sorhus';

describe('checkAttribution', () => {
  describe('license file scanning', () => {
    it('passes on Vadym alone (the only holder named in Ink <= 6)', () => {
      const result = checkAttribution([
        entry('LICENSE', 'MIT License\n\nCopyright (c) Vadym Demedes'),
      ]);
      assert.equal(result.vadymFound, true);
      assert.equal(result.sindreFound, false);
      assert.equal(result.hasAttribution, true);
      assert.deepEqual(result.missingCopyrightHolders, []);
      assert.ok(result.notes.some((n) => n.includes('Sindre')));
      assert.ok(result.foundIn.includes('LICENSE'));
    });

    it('finds Vadim Demedes (alternative spelling) in LICENSE', () => {
      const result = checkAttribution([
        entry('LICENSE', 'Copyright (c) Vadim Demedes'),
      ]);
      assert.equal(result.vadymFound, true);
    });

    it('finds vadimdemedes (username) in LICENSE', () => {
      const result = checkAttribution([
        entry('LICENSE.md', 'Copyright (c) vadimdemedes@hey.com'),
      ]);
      assert.equal(result.vadymFound, true);
    });

    it('passes with both holders present and adds no Sindre note', () => {
      const result = checkAttribution([
        entry('LICENSE', BOTH),
      ]);
      assert.equal(result.vadymFound, true);
      assert.equal(result.sindreFound, true);
      assert.equal(result.hasAttribution, true);
      assert.deepEqual(result.missingCopyrightHolders, []);
      assert.deepEqual(result.notes, []);
    });

    it('does NOT fail a package that names only Vadym (e.g. vendored ink@4)', () => {
      const result = checkAttribution([
        entry('LICENSE', 'Copyright (c) Vadym Demedes'),
      ]);
      assert.equal(result.hasAttribution, true);
      assert.deepEqual(result.missingCopyrightHolders, []);
    });

    it('fails when the always-present holder Vadym is missing', () => {
      const result = checkAttribution([
        entry('LICENSE', 'Copyright (c) Sindre Sorhus'),
      ]);
      assert.equal(result.hasAttribution, false);
      assert.equal(result.sindreFound, true);
      assert.deepEqual(result.missingCopyrightHolders, ['Vadym Demedes']);
    });

    it('checks NOTICE files', () => {
      const result = checkAttribution([
        entry('NOTICE', 'This product includes software by Vadym Demedes and Sindre Sorhus'),
      ]);
      assert.equal(result.hasAttribution, true);
    });

    it('checks THIRD_PARTY files', () => {
      const result = checkAttribution([
        entry('THIRD_PARTY_NOTICES.txt', 'ink - MIT - Vadym Demedes, Sindre Sorhus'),
      ]);
      assert.equal(result.hasAttribution, true);
    });

    it('checks licence (British spelling)', () => {
      const result = checkAttribution([
        entry('LICENCE', 'Vadym Demedes\nSindre Sorhus'),
      ]);
      assert.equal(result.hasAttribution, true);
    });

    it('is case-insensitive for content matching', () => {
      const result = checkAttribution([
        entry('LICENSE', 'copyright (c) VADYM DEMEDES and SINDRE SORHUS'),
      ]);
      assert.equal(result.hasAttribution, true);
    });

    it('fails when no attribution in license files', () => {
      const result = checkAttribution([
        entry('LICENSE', 'MIT License\n\nCopyright (c) Some Company'),
      ]);
      assert.equal(result.hasAttribution, false);
      assert.deepEqual(result.missingCopyrightHolders, ['Vadym Demedes']);
    });

    it('fails when no license files exist', () => {
      const result = checkAttribution([
        entry('index.js', 'console.log("hello")'),
        entry('package.json', '{}'),
      ]);
      assert.equal(result.hasAttribution, false);
    });
  });

  describe('JS full-file scanning', () => {
    it('finds attribution in a block comment header', () => {
      const result = checkAttribution([
        entry('dist/index.js', '/*!\n * ink v5.0.0\n * Copyright (c) Vadym Demedes and Sindre Sorhus\n * MIT License\n */\nconst x = 1;'),
      ]);
      assert.equal(result.hasAttribution, true);
      assert.ok(result.foundIn.some((f) => f.includes('dist/index.js')));
    });

    it('finds end-of-file legal comments (esbuild --legal-comments=eof)', () => {
      // The false positive that motivated the fix: attribution lives at the END
      // of a bundle, not the top header.
      const bundle = [
        '"use strict";',
        'var x = 1;'.repeat(500),
        'console.log(x);',
        '/*! Bundled licenses:',
        ' * ink: MIT License, Copyright (c) Vadym Demedes and Sindre Sorhus',
        ' */',
      ].join('\n');
      const result = checkAttribution([entry('dist/chunk-ABC123.js', bundle)]);
      assert.equal(result.hasAttribution, true);
      assert.ok(result.foundIn.some((f) => f.includes('dist/chunk-ABC123.js')));
    });

    it('scans beyond the header for names appearing after code', () => {
      // Header-only scanning missed this; full-file scanning finds it.
      const result = checkAttribution([
        entry('dist/index.js', 'const x = 1;\n// Vadym Demedes\n// Sindre Sorhus\nconst y = 2;'),
      ]);
      assert.equal(result.vadymFound, true);
      assert.equal(result.sindreFound, true);
      assert.equal(result.hasAttribution, true);
    });

    it('skips binary files', () => {
      const buf = Buffer.alloc(100);
      buf[0] = 0x00; // null byte signals binary
      buf.write('Vadym Demedes Sindre Sorhus', 10);
      const result = checkAttribution([
        { name: 'dist/index.js', data: buf },
      ]);
      assert.equal(result.hasAttribution, false);
    });
  });
});
