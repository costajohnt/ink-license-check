/**
 * Scan tarball entries for Ink license attribution.
 *
 * Ink is MIT licensed. Vadym (Vadim) Demedes is the copyright holder named in
 * EVERY version of Ink's LICENSE; Sindre Sorhus was added only in Ink 7.x
 * (2.x-6.x name Vadym alone). So a package vendoring, say, ink@4 and reproducing
 * its LICENSE verbatim and correctly names only Vadym. To avoid falsely
 * accusing such a package, a pass requires Vadym; the absence of Sindre is
 * surfaced as an informational note, never as a violation. The direction of
 * error is always false-negative (miss), never false-accusation.
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

  let skippedFiles = 0;
  for (const entry of jsEntries) {
    if (entry.data.length === 0) continue;
    if (entry.data.subarray(0, 512).includes(0)) {
      skippedFiles++;
      continue;
    }

    const content = entry.data.toString('utf8').toLowerCase();
    record(entry.name, matchesAny(content, VADYM_PATTERNS), matchesAny(content, SINDRE_PATTERNS));
  }

  // Only the always-present holder (Vadym) is required for a pass. A missing
  // Sindre is informational (relevant only when Ink >= 7 is the version bundled).
  const hasAttribution = vadymFound;
  const missingCopyrightHolders = vadymFound ? [] : ['Vadym Demedes'];
  const notes = [];
  if (vadymFound && !sindreFound) {
    notes.push('Sindre Sorhus not found (required only if Ink >= 7 is bundled)');
  }

  return {
    hasAttribution,
    foundIn,
    missingCopyrightHolders,
    notes,
    vadymFound,
    sindreFound,
    skippedFiles,
  };
}

function isLicenseFile(lowerName) {
  return LICENSE_FILE_PATTERNS.some((pattern) => pattern.test(lowerName));
}

function matchesAny(content, patterns) {
  return patterns.some((p) => content.includes(p));
}
