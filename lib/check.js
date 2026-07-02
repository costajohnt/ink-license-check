/**
 * Pure decision logic, extracted so the pass / fail / n/a outcomes can be unit
 * tested without any network access. Given the Ink detection result and the
 * tarball entries, produce the final per-package result object.
 */

import { checkAttribution } from './attribution.js';

/**
 * Turn a detection result (+ entries for attribution) into a result object.
 * Never touches the network. Status is one of: pass | na | fail.
 */
export function classify({ packageName, version, detection, entries, downloads = null }) {
  if (!detection.usesInk) {
    return baseResult(packageName, version, {
      usesInk: false,
      inkDetection: detection,
      attribution: { found: false, locations: [], missingCopyrightHolders: [] },
      downloads,
      status: 'pass',
    });
  }

  const inkDetection = {
    confidence: detection.confidence,
    dependencyType: detection.dependencyType,
    evidence: detection.evidence,
  };

  // Declares or merely references Ink but does not bundle its source: npm
  // resolves the dependency at install time, so this tarball ships no Ink code
  // and carries no attribution obligation. Informational, never a FAIL.
  if (!detection.bundlesInk) {
    return baseResult(packageName, version, {
      usesInk: true,
      inkDetection,
      attribution: { found: null, locations: [], missingCopyrightHolders: [] },
      downloads,
      status: 'na',
    });
  }

  // Ink source is bundled/vendored here — attribution is required.
  const attr = checkAttribution(entries);

  return baseResult(packageName, version, {
    usesInk: true,
    inkDetection,
    attribution: {
      found: attr.hasAttribution,
      vadymDemedes: attr.vadymFound,
      sindreSorhus: attr.sindreFound,
      locations: attr.foundIn,
      missingCopyrightHolders: attr.missingCopyrightHolders,
      notes: attr.notes,
    },
    downloads,
    status: attr.hasAttribution ? 'pass' : 'fail',
  });
}

export function errorResult(packageName, status, message) {
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

/**
 * Process exit code for a set of results: 1 if any violation, else 2 if any
 * hard error, else 0. (`na` and `skip` do not affect the exit code.)
 */
export function exitCode(results) {
  if (results.some((r) => r.status === 'fail')) return 1;
  if (results.some((r) => r.status === 'error')) return 2;
  return 0;
}

/**
 * Map over items with a bounded number of concurrent in-flight calls. Preserves
 * input order in the returned array.
 */
export async function mapWithConcurrency(items, limit, fn) {
  const results = Array.from({ length: items.length });
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}

function baseResult(packageName, version, fields) {
  return { package: packageName, version, error: null, ...fields };
}
