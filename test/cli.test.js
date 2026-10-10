import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'ink-license-check.js');
const MOCK_DOWNLOADS = join(__dirname, 'fixtures', 'mock-downloads-api.js');

// `mockDownloads` stubs api.npmjs.org (a count, or 'fail') so download-count
// tests do not depend on that live service. The registry is still queried.
function run(args, { timeout = 30_000, mockDownloads } = {}) {
  const nodeArgs = mockDownloads == null ? [CLI, ...args] : ['--import', MOCK_DOWNLOADS, CLI, ...args];
  const env = mockDownloads == null ? process.env : { ...process.env, MOCK_DOWNLOADS: String(mockDownloads) };
  return new Promise((resolve) => {
    execFile('node', nodeArgs, { timeout, env }, (err, stdout, stderr) => {
      resolve({
        exitCode: err ? (err.killed ? 'KILLED' : (err.code ?? 1)) : 0,
        stdout,
        stderr,
      });
    });
  });
}

describe('CLI', () => {
  it('shows usage and exits 2 with no arguments', async () => {
    const { exitCode, stderr } = await run([]);
    assert.equal(exitCode, 2);
    assert.ok(stderr.includes('Usage:'));
  });

  it('shows help with --help', async () => {
    const { exitCode, stdout } = await run(['--help']);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes('Usage:'));
    assert.ok(stdout.includes('--json'));
  });

  it('shows version with --version', async () => {
    const { exitCode, stdout } = await run(['--version']);
    assert.equal(exitCode, 0);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
  });

  it('rejects unknown flags', async () => {
    const { exitCode, stderr } = await run(['--unknown']);
    assert.equal(exitCode, 2);
    assert.ok(stderr.includes('Unknown option'));
  });

  it('checks a package that uses ink (ink itself) and passes', async () => {
    const { exitCode, stdout } = await run(['ink'], { timeout: 60_000 });
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes('PASS'));
    assert.ok(stdout.includes('ink'));
  });

  it('outputs valid JSON with --json flag', async () => {
    const { stdout } = await run(['ink', '--json'], { timeout: 60_000 });
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.results);
    assert.ok(parsed.summary);
    assert.equal(parsed.results.length, 1);
    assert.equal(parsed.results[0].package, 'ink');
  });

  it('includes download counts with -d flag', async () => {
    const { stdout } = await run(['ink', '--json', '-d'], { timeout: 60_000, mockDownloads: 5000 });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.results[0].downloads, 5000);
  });

  it('handles non-existent packages gracefully', async () => {
    const { exitCode, stdout } = await run(['this-package-definitely-does-not-exist-xyz-123'], { timeout: 30_000 });
    assert.equal(exitCode, 0); // skip doesn't count as violation
    assert.ok(stdout.includes('SKIP'));
  });

  it('checks multiple packages', async () => {
    const { stdout } = await run(['ink', '--json', 'this-package-definitely-does-not-exist-xyz-123'], { timeout: 60_000 });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.results.length, 2);
    assert.equal(parsed.summary.total, 2);
  });

  it('filters by --min-downloads', async () => {
    // ink has millions of downloads, so a very high threshold should still include it
    const { stdout } = await run(['ink', '--json', '--min-downloads', '1000'], { timeout: 60_000, mockDownloads: 5000 });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.results.length, 1);
    assert.equal(parsed.results[0].package, 'ink');
    assert.ok(parsed.results[0].downloads >= 1000);
  });

  it('--min-downloads filters out low-download packages', async () => {
    // Use a threshold higher than ink's downloads — should return empty results
    const { stdout } = await run(['ink', '--json', '--min-downloads', '999999999999'], { timeout: 60_000, mockDownloads: 5000 });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.results.length, 0);
  });

  it('generates markdown report with --report', async () => {
    const { exitCode, stdout } = await run(['ink', '--report', '-d'], { timeout: 60_000, mockDownloads: 5000 });
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes('# Ink License Attribution Report'));
    assert.ok(stdout.includes('## Summary'));
    assert.ok(stdout.includes('Packages checked'));
    assert.ok(stdout.includes('ink'));
  });

  it('--min-downloads=N syntax works', async () => {
    const { stdout } = await run(['ink', '--json', '--min-downloads=1000'], { timeout: 60_000, mockDownloads: 5000 });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.results.length, 1);
  });

  it('--min-downloads keeps a package whose download lookup failed and exits 2', async () => {
    const { exitCode, stdout, stderr } = await run(['ink', '--json', '--min-downloads', '1000'], { timeout: 60_000, mockDownloads: 'fail' });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.results.length, 1);
    assert.equal(parsed.results[0].package, 'ink');
    assert.equal(parsed.results[0].downloads, null);
    assert.match(parsed.results[0].downloadsError, /ENOTFOUND/);
    assert.equal(exitCode, 2);
    assert.ok(stderr.includes('could not fetch downloads for ink'));
  });

  it('--min-downloads without value exits 2', async () => {
    const { exitCode, stderr } = await run(['ink', '--min-downloads']);
    assert.equal(exitCode, 2);
    assert.ok(stderr.includes('requires a numeric value'));
  });
});
