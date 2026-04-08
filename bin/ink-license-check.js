#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPackageMetadata, downloadTarball, getDownloadCount, PackageNotFoundError } from '../lib/registry.js';
import { extractTgz } from '../lib/tar.js';
import { detectInk } from '../lib/detect.js';
import { checkAttribution } from '../lib/attribution.js';
import { formatText, formatJson } from '../lib/format.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const USAGE = `
Usage: ink-license-check <package...> [options]

Check npm packages for missing Ink (MIT) license attribution.

Options:
  --json          Output results as JSON
  -d, --downloads Include monthly npm download counts
  -h, --help      Show this help message
  -v, --version   Show version number

Examples:
  ink-license-check my-cli-tool
  ink-license-check @org/cli another-pkg --json -d
`.trim();

function parseArgs(argv) {
  const args = argv.slice(2);
  const packages = [];
  const flags = { json: false, downloads: false };

  for (const arg of args) {
    switch (arg) {
      case '--json':
        flags.json = true;
        break;
      case '-d':
      case '--downloads':
        flags.downloads = true;
        break;
      case '-h':
      case '--help':
        console.log(USAGE);
        process.exit(0);
        break;
      case '-v':
      case '--version':
        console.log(pkg.version);
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}\n\n${USAGE}`);
          process.exit(2);
        }
        packages.push(arg);
    }
  }

  if (packages.length === 0) {
    console.error(USAGE);
    process.exit(2);
  }

  return { packages, flags };
}

function errorResult(packageName, status, message) {
  return {
    package: packageName,
    version: null,
    usesInk: false,
    inkDetection: null,
    attribution: null,
    downloads: null,
    status,
    error: message,
  };
}

async function checkPackage(packageName, flags) {
  try {
    const meta = await getPackageMetadata(packageName);
    const tarballBuffer = await downloadTarball(meta.dist.tarball);
    const entries = extractTgz(tarballBuffer);

    const detection = detectInk(entries);

    let downloads = null;
    if (flags.downloads) {
      try {
        downloads = await getDownloadCount(packageName);
      } catch (dlErr) {
        console.error(`Warning: could not fetch downloads for ${packageName}: ${dlErr.message}`);
      }
    }

    if (!detection.usesInk) {
      return {
        package: packageName,
        version: meta.version,
        usesInk: false,
        inkDetection: detection,
        attribution: { found: false, locations: [], missingCopyrightHolders: [] },
        downloads,
        status: 'pass',
        error: null,
      };
    }

    const attr = checkAttribution(entries);

    return {
      package: packageName,
      version: meta.version,
      usesInk: true,
      inkDetection: {
        confidence: detection.confidence,
        dependencyType: detection.dependencyType,
        evidence: detection.evidence,
      },
      attribution: {
        found: attr.hasAttribution,
        vadymDemedes: attr.vadymFound,
        sindreSorhus: attr.sindreFound,
        locations: attr.foundIn,
        missingCopyrightHolders: attr.missingCopyrightHolders,
      },
      downloads,
      status: attr.hasAttribution ? 'pass' : 'fail',
      error: null,
    };
  } catch (err) {
    if (err instanceof PackageNotFoundError) {
      return errorResult(packageName, 'skip', 'Package not found on npm');
    }

    console.error(`Warning: failed to check ${packageName}: ${err.message}`);
    return errorResult(packageName, 'error', err.message);
  }
}

async function main() {
  const { packages, flags } = parseArgs(process.argv);

  const settled = await Promise.allSettled(
    packages.map((p) => checkPackage(p, flags)),
  );

  const results = settled.map((s, i) =>
    s.status === 'fulfilled' ? s.value : errorResult(packages[i], 'error', s.reason?.message || 'Unknown error'),
  );

  const opts = { version: pkg.version };
  if (flags.json) {
    console.log(formatJson(results));
  } else {
    console.log(formatText(results, opts));
  }

  const hasViolations = results.some((r) => r.status === 'fail');
  const hasErrors = results.some((r) => r.status === 'error');
  process.exit(hasViolations ? 1 : hasErrors ? 2 : 0);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(2);
});
