import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkAttribution } from '../lib/attribution.js';

function entry(name, content) {
  return { name, data: Buffer.from(content, 'utf8') };
}

describe('checkAttribution', () => {
  describe('license file scanning', () => {
    it('finds Vadym Demedes in LICENSE file', () => {
      const result = checkAttribution([
        entry('LICENSE', 'MIT License\n\nCopyright (c) Vadym Demedes'),
      ]);
      assert.equal(result.hasAttribution, true);
      assert.equal(result.vadymFound, true);
      assert.ok(result.foundIn.includes('LICENSE'));
    });

    it('finds Vadim Demedes (alternative spelling) in LICENSE', () => {
      const result = checkAttribution([
        entry('LICENSE', 'Copyright (c) Vadim Demedes'),
      ]);
      assert.equal(result.hasAttribution, true);
      assert.equal(result.vadymFound, true);
    });

    it('finds vadimdemedes (username) in LICENSE', () => {
      const result = checkAttribution([
        entry('LICENSE.md', 'Copyright (c) vadimdemedes@hey.com'),
      ]);
      assert.equal(result.hasAttribution, true);
    });

    it('finds both copyright holders', () => {
      const result = checkAttribution([
        entry('LICENSE', 'Copyright (c) Vadym Demedes\nCopyright (c) Sindre Sorhus'),
      ]);
      assert.equal(result.vadymFound, true);
      assert.equal(result.sindreFound, true);
      assert.deepEqual(result.missingCopyrightHolders, []);
    });

    it('reports missing Sindre Sorhus when only Vadym found', () => {
      const result = checkAttribution([
        entry('LICENSE', 'Copyright (c) Vadym Demedes'),
      ]);
      assert.equal(result.hasAttribution, true);
      assert.deepEqual(result.missingCopyrightHolders, ['Sindre Sorhus']);
    });

    it('reports missing Vadym when only Sindre found', () => {
      const result = checkAttribution([
        entry('LICENSE', 'Copyright (c) Sindre Sorhus'),
      ]);
      assert.equal(result.hasAttribution, false);
      assert.equal(result.sindreFound, true);
      assert.ok(result.missingCopyrightHolders.includes('Vadym Demedes'));
    });

    it('checks NOTICE files', () => {
      const result = checkAttribution([
        entry('NOTICE', 'This product includes software by Vadym Demedes'),
      ]);
      assert.equal(result.hasAttribution, true);
    });

    it('checks THIRD_PARTY files', () => {
      const result = checkAttribution([
        entry('THIRD_PARTY_NOTICES.txt', 'ink - MIT - Vadym Demedes'),
      ]);
      assert.equal(result.hasAttribution, true);
    });

    it('checks licence (British spelling)', () => {
      const result = checkAttribution([
        entry('LICENCE', 'Vadym Demedes'),
      ]);
      assert.equal(result.hasAttribution, true);
    });

    it('is case-insensitive for content matching', () => {
      const result = checkAttribution([
        entry('LICENSE', 'copyright (c) VADYM DEMEDES'),
      ]);
      assert.equal(result.hasAttribution, true);
    });

    it('fails when no attribution in license files', () => {
      const result = checkAttribution([
        entry('LICENSE', 'MIT License\n\nCopyright (c) Some Company'),
      ]);
      assert.equal(result.hasAttribution, false);
    });

    it('fails when no license files exist', () => {
      const result = checkAttribution([
        entry('index.js', 'console.log("hello")'),
        entry('package.json', '{}'),
      ]);
      assert.equal(result.hasAttribution, false);
    });
  });

  describe('JS license header scanning', () => {
    it('finds attribution in block comment header', () => {
      const result = checkAttribution([
        entry('dist/index.js', `/*!\n * ink v5.0.0\n * Copyright (c) Vadym Demedes\n * MIT License\n */\nconst x = 1;`),
      ]);
      assert.equal(result.hasAttribution, true);
      assert.ok(result.foundIn.some((f) => f.includes('license header')));
    });

    it('finds attribution in @license comment', () => {
      const result = checkAttribution([
        entry('dist/bundle.js', `/**\n * @license MIT\n * Copyright Vadym Demedes\n */\n"use strict";`),
      ]);
      assert.equal(result.hasAttribution, true);
    });

    it('finds attribution in single-line comment header', () => {
      const result = checkAttribution([
        entry('dist/cli.js', `#!/usr/bin/env node\n// Copyright (c) Vadym Demedes - MIT\nconst x = 1;`),
      ]);
      assert.equal(result.hasAttribution, true);
    });

    it('does not scan beyond comment headers', () => {
      const result = checkAttribution([
        entry('dist/index.js', `const x = 1;\n// Vadym Demedes\nconst y = 2;`),
      ]);
      // Vadym appears after code, not in a header
      assert.equal(result.hasAttribution, false);
    });

    it('skips binary files', () => {
      const buf = Buffer.alloc(100);
      buf[0] = 0x00; // null byte signals binary
      buf.write('Vadym Demedes', 10);
      const result = checkAttribution([
        { name: 'dist/index.js', data: buf },
      ]);
      assert.equal(result.hasAttribution, false);
    });
  });
});
