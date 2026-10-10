#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPackageMetadata, downloadTarball, getDownloadCount, parsePackageSpec, PackageNotFoundError, VersionNotFoundError } from '../lib/registry.js';
import { extractTgz } from '../lib/tar.js';
import { detectInk } from '../lib/detect.js';
import { applyDownloadThreshold, classify, errorResult, exitCode, mapWithConcurrency } from '../lib/check.js';
import { formatText, formatJson, formatReport } from '../lib/format.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const USAGE = `
Usage: ink-license-check <package[@version|@tag]...> [options]

Check npm packages for missing Ink (MIT) license attribution.
Without a version the latest release is checked. A version must be exact
(ink@4.0.0) or a dist-tag (ink@next); ranges are not supported.

Options:
  --json                 Output results as JSON
  --report               Output a markdown report (for posting on GitHub)
  -d, --downloads        Include monthly npm download counts
  --min-downloads <n>    Only report on packages with at least n monthly downloads
                         (implies --downloads)
  -h, --help             Show this help message
  -v, --version          Show version number

Examples:
  ink-license-check my-cli-tool
  ink-license-check my-cli-tool@2.3.1 @org/cli@next
  ink-license-check @org/cli another-pkg --json -d
  ink-license-check pkg-a pkg-b --report --min-downloads 100000
`.trim();

function parseArgs(argv) {
  const args = argv.slice(2);
  const packages = [];
  const flags = { json: false, report: false, downloads: false, minDownloads: null };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--json':
        flags.json = true;
        break;
      case '--report':
        flags.report = true;
        break;
      case '-d':
      case '--downloads':
        flags.downloads = true;
        break;
      case '--min-downloads': {
        const val = args[++i];
        if (!val || Number.isNaN(Number(val))) {
          console.error(`--min-downloads requires a numeric value\n\n${USAGE}`);
          process.exit(2);
        }
        flags.minDownloads = Number(val);
        flags.downloads = true;
        break;
      }
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
        if (arg.startsWith('--min-downloads=')) {
          const val = arg.split('=')[1];
          if (Number.isNaN(Number(val))) {
            console.error(`--min-downloads requires a numeric value\n\n${USAGE}`);
            process.exit(2);
          }
          flags.minDownloads = Number(val);
          flags.downloads = true;
        } else if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}\n\n${USAGE}`);
          process.exit(2);
        } else {
          packages.push(arg);
        }
    }
  }

  if (packages.length === 0) {
    console.error(USAGE);
    process.exit(2);
  }

  return { packages, flags };
}

// Cap concurrent tarball fetches so a large package list does not open
// hundreds of registry connections at once.
const MAX_CONCURRENCY = 8;

async function checkPackage(arg, flags) {
  const { name: packageName, spec } = parsePackageSpec(arg);
  try {
    const meta = await getPackageMetadata(packageName, spec);
    const tarballBuffer = await downloadTarball(meta.dist.tarball);
    const entries = extractTgz(tarballBuffer);

    const detection = detectInk(entries);

    // Surface files that were skipped as non-text so a dropped file is visible.
    if (detection.skippedFiles > 0) {
      console.error(`Note: skipped ${detection.skippedFiles} non-text file(s) while scanning ${packageName}`);
    }

    let downloads = null;
    let downloadsError = null;
    if (flags.downloads) {
      try {
        downloads = await getDownloadCount(packageName);
      } catch (dlErr) {
        downloadsError = dlErr.message;
        const kept = flags.minDownloads != null ? ' (kept in results; --min-downloads could not be applied)' : '';
        console.error(`Warning: could not fetch downloads for ${packageName}: ${dlErr.message}${kept}`);
      }
    }

    const result = classify({ packageName, version: meta.version, detection, entries, downloads });
    if (downloadsError) result.downloadsError = downloadsError;
    return result;
  } catch (err) {
    // A missing package or version is an error, not a skip: a misspelled
    // name in CI must not read as a clean pass.
    if (err instanceof PackageNotFoundError) {
      return errorResult(arg, 'error', 'Package not found on npm');
    }
    if (err instanceof VersionNotFoundError) {
      return errorResult(arg, 'error', `Version or tag "${spec}" not found on npm (use an exact version or a dist-tag)`);
    }

    console.error(`Warning: failed to check ${arg}: ${err.message}`);
    return errorResult(arg, 'error', err.message);
  }
}

async function main() {
  const { packages, flags } = parseArgs(process.argv);

  const settled = await mapWithConcurrency(packages, MAX_CONCURRENCY, (p) =>
    checkPackage(p, flags).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason }),
    ),
  );

  let results = settled.map((s, i) =>
    s.status === 'fulfilled' ? s.value : errorResult(packages[i], 'error', s.reason?.message || 'Unknown error'),
  );

  // Apply download threshold filter
  results = applyDownloadThreshold(results, flags.minDownloads);

  const opts = { version: pkg.version, minDownloads: flags.minDownloads };
  if (flags.json) {
    console.log(formatJson(results));
  } else if (flags.report) {
    console.log(formatReport(results, opts));
  } else {
    console.log(formatText(results, opts));
  }

  process.exit(exitCode(results, { minDownloads: flags.minDownloads }));
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(2);
});
