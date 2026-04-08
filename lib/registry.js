import { fetch } from './fetch.js';

const REGISTRY = 'https://registry.npmjs.org';
const DOWNLOADS_API = 'https://api.npmjs.org/downloads/point/last-month';

export class PackageNotFoundError extends Error {
  constructor(name) {
    super(`Package not found: ${name}`);
    this.name = 'PackageNotFoundError';
    this.packageName = name;
  }
}

/**
 * Fetch package metadata from the npm registry.
 */
export async function getPackageMetadata(packageName) {
  const encoded = encodePackageName(packageName);
  const { statusCode, body } = await fetch(`${REGISTRY}/${encoded}/latest`);

  if (statusCode === 404) {
    throw new PackageNotFoundError(packageName);
  }
  if (statusCode !== 200) {
    throw new Error(`Registry returned ${statusCode} for ${packageName}`);
  }

  try {
    return JSON.parse(body.toString('utf8'));
  } catch (err) {
    throw new Error(`Failed to parse registry response for ${packageName}: ${err.message}`);
  }
}

/**
 * Download a tarball and return the raw Buffer.
 */
export async function downloadTarball(tarballUrl) {
  const { statusCode, body } = await fetch(tarballUrl);

  if (statusCode !== 200) {
    throw new Error(`Tarball download failed with status ${statusCode}: ${tarballUrl}`);
  }

  return body;
}

/**
 * Fetch monthly download count for a package.
 * Returns null if the package has no download data (404).
 * Throws on other errors so callers can handle them.
 */
export async function getDownloadCount(packageName) {
  const encoded = encodePackageName(packageName);
  const { statusCode, body } = await fetch(`${DOWNLOADS_API}/${encoded}`);

  if (statusCode === 404) return null;
  if (statusCode !== 200) {
    throw new Error(`Downloads API returned ${statusCode} for ${packageName}`);
  }

  try {
    const data = JSON.parse(body.toString('utf8'));
    return data.downloads ?? null;
  } catch (err) {
    throw new Error(`Failed to parse downloads response for ${packageName}: ${err.message}`);
  }
}

function encodePackageName(name) {
  // Scoped packages: @org/pkg -> %40org%2Fpkg
  if (name.startsWith('@')) {
    return `@${encodeURIComponent(name.slice(1))}`;
  }
  return encodeURIComponent(name);
}
