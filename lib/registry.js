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

export class VersionNotFoundError extends Error {
  constructor(name, spec) {
    super(`Version or tag "${spec}" not found for ${name}`);
    this.name = 'VersionNotFoundError';
    this.packageName = name;
    this.spec = spec;
  }
}

/**
 * Split a CLI argument into a package name and an optional version spec:
 * `ink` -> { name: 'ink', spec: null }, `ink@4.0.0` -> { name: 'ink',
 * spec: '4.0.0' }, `@org/pkg@next` -> { name: '@org/pkg', spec: 'next' }.
 * The leading `@` of a scoped name is not a separator.
 */
export function parsePackageSpec(arg) {
  const at = arg.indexOf('@', arg.startsWith('@') ? 1 : 0);
  if (at === -1) return { name: arg, spec: null };
  const spec = arg.slice(at + 1);
  return { name: arg.slice(0, at), spec: spec === '' ? null : spec };
}

/**
 * Fetch package metadata from the npm registry. `spec` is an exact version or
 * a dist-tag (the registry does not resolve semver ranges); it defaults to
 * the `latest` tag.
 */
export async function getPackageMetadata(packageName, spec = null) {
  const encoded = encodePackageName(packageName);
  const target = encodeURIComponent(spec ?? 'latest');
  const { statusCode, body } = await fetch(`${REGISTRY}/${encoded}/${target}`);

  if (statusCode === 404) {
    // The registry answers "version not found: <spec>" when the package
    // exists but the version or tag does not, and "Not Found" otherwise.
    if (spec != null && /version not found/i.test(body.toString('utf8'))) {
      throw new VersionNotFoundError(packageName, spec);
    }
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
