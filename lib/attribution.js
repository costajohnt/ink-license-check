/**
 * Scan tarball entries for Ink license attribution.
 *
 * Ink is MIT licensed and its LICENSE names BOTH copyright holders
 * (Vadym Demedes AND Sindre Sorhus), so a compliant attribution must credit
 * both.
 *
 * Checks:
 * 1. License-like files (LICENSE, NOTICE, THIRD_PARTY, etc.)
 * 2. The ENTIRE contents of JS files — not just the top header. Bundlers place
 *    legal comments at the end of the file (esbuild's default
 *    `--legal-comments=eof`, webpack license plugins), so a header-only scan
 *    misses valid attribution.
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

  const record = (name, vadymHere, sindreHere) => {
    if (vadymHere || sindreHere) {
      foundIn.push(name);
      if (vadymHere) vadymFound = true;
      if (sindreHere) sindreFound = true;
    }
  };

  // 1. License-like files — scan the whole file.
  for (const entry of entries) {
    if (!isLicenseFile(entry.name.toLowerCase())) continue;
    const content = entry.data.toString('utf8').toLowerCase();
    record(entry.name, matchesAny(content, VADYM_PATTERNS), matchesAny(content, SINDRE_PATTERNS));
  }

  // 2. JS/bundle files — scan the ENTIRE file so end-of-file legal comments
  //    are found. A plain string search is efficient enough for large bundles.
  const jsEntries = entries.filter((e) =>
    /\.(js|cjs|mjs)$/.test(e.name) && !e.name.includes('node_modules/'),
  );

  for (const entry of jsEntries) {
    if (entry.data.length === 0) continue;
    if (entry.data.subarray(0, 512).includes(0)) continue;

    const content = entry.data.toString('utf8').toLowerCase();
    record(entry.name, matchesAny(content, VADYM_PATTERNS), matchesAny(content, SINDRE_PATTERNS));
  }

  const missingCopyrightHolders = [];
  if (!vadymFound) missingCopyrightHolders.push('Vadym Demedes');
  if (!sindreFound) missingCopyrightHolders.push('Sindre Sorhus');

  // Ink's LICENSE names both holders, so both are required for a pass.
  const hasAttribution = vadymFound && sindreFound;

  return {
    hasAttribution,
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
