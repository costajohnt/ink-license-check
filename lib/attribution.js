/**
 * Scan tarball entries for Ink license attribution.
 *
 * Checks:
 * 1. License-like files (LICENSE, NOTICE, THIRD_PARTY, etc.)
 * 2. License comment headers in JS files (first 100 lines, @license tags, banner comments)
 */

// Attribution strings (lowercase for case-insensitive matching)
const VADYM_PATTERNS = ['vadym demedes', 'vadim demedes', 'vadimdemedes'];
const SINDRE_PATTERNS = ['sindre sorhus', 'sindresorhus'];

// License file name patterns (matched against lowercased entry names)
const LICENSE_FILE_PATTERNS = [
  /^licen[sc]e(\.md|\.txt)?$/,
  /^notice(\.md|\.txt)?$/,
  /^third[_-]?party[_-]?(notices|licenses)?(\.md|\.txt)?$/,
  /^licen[sc]es\//,
  /^notices?\//,
];

export function checkAttribution(entries) {
  const foundIn = [];
  let vadymFound = false;
  let sindreFound = false;

  // Check license-like files
  for (const entry of entries) {
    const lowerName = entry.name.toLowerCase();

    if (isLicenseFile(lowerName)) {
      const content = entry.data.toString('utf8').toLowerCase();
      const vadymHere = matchesAny(content, VADYM_PATTERNS);
      const sindreHere = matchesAny(content, SINDRE_PATTERNS);

      if (vadymHere || sindreHere) {
        foundIn.push(entry.name);
        if (vadymHere) vadymFound = true;
        if (sindreHere) sindreFound = true;
      }
    }
  }

  // Check JS file license headers
  const jsEntries = entries.filter((e) =>
    /\.(js|cjs|mjs)$/.test(e.name) && !e.name.includes('node_modules/'),
  );

  for (const entry of jsEntries) {
    if (entry.data.length === 0) continue;
    if (entry.data.subarray(0, 512).includes(0)) continue;

    const content = entry.data.toString('utf8');
    const header = extractLicenseHeader(content);
    if (!header) continue;

    const lower = header.toLowerCase();
    const vadymHere = matchesAny(lower, VADYM_PATTERNS);
    const sindreHere = matchesAny(lower, SINDRE_PATTERNS);

    if (vadymHere || sindreHere) {
      foundIn.push(`${entry.name} (license header)`);
      if (vadymHere) vadymFound = true;
      if (sindreHere) sindreFound = true;
    }
  }

  const missingCopyrightHolders = [];
  if (!vadymFound) missingCopyrightHolders.push('Vadym Demedes');
  if (!sindreFound) missingCopyrightHolders.push('Sindre Sorhus');

  return {
    hasAttribution: vadymFound,
    foundIn,
    missingCopyrightHolders,
    vadymFound,
    sindreFound,
  };
}

function isLicenseFile(lowerName) {
  return LICENSE_FILE_PATTERNS.some((pattern) => pattern.test(lowerName));
}

function matchesAny(content, patterns) {
  return patterns.some((p) => content.includes(p));
}

/**
 * Extract license comment text from the beginning of a JS file.
 * Looks for block comments (/* ... * /), @license tags, and banner comments.
 */
function extractLicenseHeader(content) {
  const parts = [];

  // Check first 100 lines for license-related comments
  const lines = content.split('\n').slice(0, 100);
  let inBlock = false;
  let blockText = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Block comment start
    if (!inBlock && trimmed.startsWith('/*')) {
      inBlock = true;
      blockText = trimmed;
      if (trimmed.includes('*/')) {
        inBlock = false;
        parts.push(blockText);
        blockText = '';
      }
      continue;
    }

    // Inside block comment
    if (inBlock) {
      blockText += '\n' + trimmed;
      if (trimmed.includes('*/')) {
        inBlock = false;
        parts.push(blockText);
        blockText = '';
      }
      continue;
    }

    // Single-line comments at the top
    if (trimmed.startsWith('//')) {
      parts.push(trimmed);
      continue;
    }

    // Stop at first non-comment, non-empty line (allow shebang and empty lines)
    if (trimmed && !trimmed.startsWith('#!')) break;
  }

  const combined = parts.join('\n');
  return combined || null;
}
