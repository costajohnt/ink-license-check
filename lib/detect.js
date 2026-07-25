/**
 * Detect whether a package uses Ink, and — critically — whether it actually
 * BUNDLES Ink's source code (the only case that creates an MIT attribution
 * obligation).
 *
 * Three distinct signals, in increasing significance:
 * 1. DECLARES ink/ink-* in runtime `dependencies`. npm does NOT copy a
 *    dependency's source into this package's tarball, so a declaration alone
 *    distributes no Ink code. Informational only.
 * 2. REFERENCES Ink via a live `import`/`require "ink"` in shipped JS. This is
 *    still an EXTERNAL module reference that npm resolves from node_modules at
 *    install time — the Ink source is not present in this tarball. Also
 *    informational (this is how every ordinary Ink consumer looks).
 * 3. BUNDLES Ink's source into the published files — vendored, or inlined by a
 *    bundler such as esbuild/webpack. This is the only case where Ink's actual
 *    source is present in the tarball, so it is the only case that creates an
 *    MIT attribution obligation. It is detected by finding Ink's hooks in
 *    DEFINITION form (e.g. `function useInput(`), which only appears where Ink's
 *    implementation is present — a consumer merely IMPORTS and calls the hooks,
 *    it never defines them, so `import {useInput, useApp} from 'ink'; useInput()`
 *    (the shape of every ordinary Ink CLI) is not treated as bundling.
 *
 * devDependencies and peerDependencies are excluded entirely: dev deps are
 * never shipped, and peer deps are supplied by the consumer at install time.
 */

// Packages that indicate ink usage
const INK_PACKAGES = new Set(['ink', 'pastel']);
const INK_PREFIXES = ['ink-', '@inkjs/'];

// Ink-specific React hooks and functions (not found in vanilla React)
const INK_IDENTIFIERS = [
  'useInput', 'useApp', 'useFocus', 'useStdin', 'useStdout',
  'useFocusManager', 'measureElement',
];

// Definition-shaped patterns for each Ink identifier. These match where an
// identifier is DEFINED (declared/assigned/exported), not merely referenced or
// called. A consumer that imports and calls the hooks matches none of these;
// only Ink's own source (vendored or inlined by a bundler) does.
const INK_DEFINITION_PATTERNS = INK_IDENTIFIERS.map((id) => ({
  id,
  patterns: [
    new RegExp(`(?:function|const|let|var)\\s+${id}\\b`),
    new RegExp(`\\b${id}\\s*=\\s*(?:function|\\(|async|React|memo|forwardRef)`),
    new RegExp(`exports\\.${id}\\s*=`),
  ],
}));

// Minimum number of DISTINCT Ink hooks that must appear in definition form for
// a package to be considered as bundling Ink's source.
const BUNDLE_DEFINITION_THRESHOLD = 2;

// High-confidence import/require patterns (external references to Ink)
const IMPORT_PATTERNS = [
  /require\s*\(\s*["']ink["']\s*\)/,
  /require\s*\(\s*["']ink\//,
  /from\s+["']ink["']/,
  /from\s+["']ink\//,
];

// Webpack/bundler module-map keys ("ink": ...) are import EVIDENCE but not
// proof the file resolves Ink externally — webpack inlines vendored source
// into the same bundle, so these files must still be definition-scanned.
const WEAK_IMPORT_PATTERNS = [/["']ink["']\s*:/];

export function detectInk(entries) {
  const evidence = [];
  let declaresInk = false;
  let confidence = 'none';

  // Prong 1: Check package.json runtime dependencies only.
  const pkgEntry = entries.find((e) => e.name === 'package.json');
  if (pkgEntry) {
    try {
      const pkg = JSON.parse(pkgEntry.data.toString('utf8'));
      // Only `dependencies` — dev/peer deps are never shipped in the tarball.
      const deps = pkg.dependencies || {};
      for (const dep of Object.keys(deps)) {
        if (isInkPackage(dep)) {
          evidence.push(`"${dep}" in dependencies`);
          declaresInk = true;
        }
      }
    } catch (err) {
      console.error(`Warning: failed to parse package.json in tarball: ${err.message}`);
    }
  }

  // Prong 2: Scan shipped JS for Ink references and inlined/vendored Ink source.
  const scan = scanShippedJs(entries, evidence);

  // A live `import`/`require "ink"` is an EXTERNAL reference resolved at install
  // time — it does not mean Ink's source is present in this tarball. Bundling is
  // only indicated when Ink's hooks appear in DEFINITION form, which a consumer
  // (who imports and calls them) never produces.
  const referencesInk = scan.inkImportFound;
  const bundlesInk = scan.definedInkIds.length >= BUNDLE_DEFINITION_THRESHOLD;

  if (bundlesInk) {
    evidence.push(`ink hooks defined in bundled source: ${scan.definedInkIds.join(', ')}`);
    confidence = 'bundled';
  } else if (declaresInk || referencesInk) {
    confidence = 'declared';
  }

  const dependencyType = bundlesInk ? 'bundled' : ((declaresInk || referencesInk) ? 'direct' : null);

  return {
    usesInk: declaresInk || referencesInk || bundlesInk,
    declaresInk,
    referencesInk,
    bundlesInk,
    definedInkIds: scan.definedInkIds,
    skippedFiles: scan.skippedFiles,
    evidence,
    confidence,
    dependencyType,
  };
}

// Scan the package's own shipped JS (excluding node_modules) for external Ink
// import references and for Ink hooks in definition form. Appends import
// evidence as it goes. Returns the distinct defined identifiers, whether an
// import was seen, and the count of files skipped as non-text.
function scanShippedJs(entries, evidence) {
  const jsEntries = entries.filter((e) =>
    /\.(js|cjs|mjs)$/.test(e.name) && !e.name.includes('node_modules/'),
  );

  let inkImportFound = false;
  let skippedFiles = 0;
  const definedInkIds = new Set();

  for (const entry of jsEntries) {
    // Skip likely binary files (counted so the skip is visible, not silent)
    if (entry.data.length > 0 && entry.data.subarray(0, 512).includes(0)) {
      skippedFiles++;
      continue;
    }

    const content = entry.data.toString('utf8');

    // A file with a live external `import`/`require "ink"` resolves Ink from
    // node_modules — it is a CONSUMER of Ink, not a copy of its source. A
    // bundler that vendored Ink would inline it INSTEAD of keeping the external
    // import. So such a file is only a reference; do not count its hook names as
    // definitions (this is what makes a re-export wrapper like
    // `import {useInput as u} from 'ink'; export const useInput = u` a reference,
    // not a false bundle).
    let fileImportsInk = false;
    for (const pattern of IMPORT_PATTERNS) {
      if (pattern.test(content)) {
        evidence.push(`${pattern.source} found in ${entry.name}`);
        inkImportFound = true;
        fileImportsInk = true;
        break;
      }
    }

    if (!fileImportsInk) {
      for (const pattern of WEAK_IMPORT_PATTERNS) {
        if (pattern.test(content)) {
          evidence.push(`${pattern.source} found in ${entry.name}`);
          inkImportFound = true;
          // No `continue`: a module-map hit may be a webpack bundle with
          // Ink's source inlined, so definition scanning still runs.
          break;
        }
      }
    }

    if (fileImportsInk) continue;

    for (const { id, patterns } of INK_DEFINITION_PATTERNS) {
      if (!definedInkIds.has(id) && patterns.some((r) => r.test(content))) {
        definedInkIds.add(id);
      }
    }
  }

  return { inkImportFound, definedInkIds: [...definedInkIds], skippedFiles };
}

function isInkPackage(name) {
  return INK_PACKAGES.has(name) || INK_PREFIXES.some((p) => name.startsWith(p));
}
