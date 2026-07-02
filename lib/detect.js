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
 *    MIT attribution obligation. It is detected by Ink's API implementation
 *    appearing inline (its hooks/functions) together with React.
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

// High-confidence import/require patterns
const IMPORT_PATTERNS = [
  /require\s*\(\s*["']ink["']\s*\)/,
  /require\s*\(\s*["']ink\//,
  /from\s+["']ink["']/,
  /from\s+["']ink\//,
  // Webpack/bundler module maps
  /["']ink["']\s*:/,
];

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

  // Prong 2: Scan shipped JS for Ink references and inlined Ink source.
  const scan = scanShippedJs(entries, evidence);

  // A live `import`/`require "ink"` is an EXTERNAL reference resolved at install
  // time — it does not mean Ink's source is present in this tarball. Bundling is
  // only indicated when Ink's API implementation appears inline (its hooks, with
  // React), which is what survives a vendored copy or a bundler inlining Ink.
  const referencesInk = scan.inkImportFound;
  const bundlesInk = scan.inkIdentifierCount >= 2 && scan.hasReactIndicator;

  if (bundlesInk) {
    evidence.push(`${scan.inkIdentifierCount} ink-specific identifiers found with React indicators`);
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
    evidence,
    confidence,
    dependencyType,
  };
}

// Scan the package's own shipped JS (excluding node_modules) for Ink import
// references and inlined Ink API identifiers. Appends import evidence as it
// goes. Returns the raw counts for the caller to interpret.
function scanShippedJs(entries, evidence) {
  const jsEntries = entries.filter((e) =>
    /\.(js|cjs|mjs)$/.test(e.name) && !e.name.includes('node_modules/'),
  );

  let inkImportFound = false;
  let inkIdentifierCount = 0;
  let hasReactIndicator = false;

  for (const entry of jsEntries) {
    // Skip likely binary files
    if (entry.data.length > 0 && entry.data.subarray(0, 512).includes(0)) continue;

    const content = entry.data.toString('utf8');

    for (const pattern of IMPORT_PATTERNS) {
      if (pattern.test(content)) {
        evidence.push(`${pattern.source} found in ${entry.name}`);
        inkImportFound = true;
        break;
      }
    }

    for (const id of INK_IDENTIFIERS) {
      if (content.includes(id)) inkIdentifierCount++;
    }

    if (/createElement|jsx|React/.test(content)) hasReactIndicator = true;
  }

  return { inkImportFound, inkIdentifierCount, hasReactIndicator };
}

function isInkPackage(name) {
  return INK_PACKAGES.has(name) || INK_PREFIXES.some((p) => name.startsWith(p));
}
