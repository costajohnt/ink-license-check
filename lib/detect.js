/**
 * Detect whether a package uses Ink by examining its tarball entries.
 *
 * Two-pronged approach:
 * 1. Check package.json dependencies for ink-related packages
 * 2. Scan bundled JS for ink imports/requires and ink-specific identifiers
 */

// Packages that indicate ink usage
const INK_PACKAGES = ['ink', 'pastel'];
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
  let confidence = 'none';
  let dependencyType = null;

  // Prong 1: Check package.json dependencies
  const pkgEntry = entries.find((e) => e.name === 'package.json');
  if (pkgEntry) {
    try {
      const pkg = JSON.parse(pkgEntry.data.toString('utf8'));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };

      for (const dep of Object.keys(allDeps)) {
        if (isInkPackage(dep)) {
          evidence.push(`"${dep}" in dependencies`);
          confidence = 'high';
          dependencyType = 'direct';
        }
      }
    } catch (err) {
      console.error(`Warning: failed to parse package.json in tarball: ${err.message}`);
    }
  }

  // Prong 2: Scan bundled JS files
  if (confidence !== 'high') {
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

      // Check for direct ink imports/requires
      for (const pattern of IMPORT_PATTERNS) {
        if (pattern.test(content)) {
          evidence.push(`${pattern.source} found in ${entry.name}`);
          inkImportFound = true;
          break;
        }
      }

      // Check for ink-specific identifiers
      for (const id of INK_IDENTIFIERS) {
        if (content.includes(id)) {
          inkIdentifierCount++;
        }
      }

      // Check for React indicators (needed for medium confidence)
      if (/createElement|jsx|React/.test(content)) {
        hasReactIndicator = true;
      }
    }

    if (inkImportFound) {
      confidence = 'high';
      dependencyType = 'bundled';
    } else if (inkIdentifierCount >= 2 && hasReactIndicator) {
      confidence = 'medium';
      dependencyType = 'bundled';
      evidence.push(`${inkIdentifierCount} ink-specific identifiers found with React indicators`);
    }
  }

  return {
    usesInk: confidence !== 'none',
    evidence,
    confidence,
    dependencyType,
  };
}

function isInkPackage(name) {
  return INK_PACKAGES.includes(name) || INK_PREFIXES.some((p) => name.startsWith(p));
}
