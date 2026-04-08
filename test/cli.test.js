import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'ink-license-check.js');

function run(args, { timeout = 30_000 } = {}) {
  return new Promise((resolve) => {
    execFile('node', [CLI, ...args], { timeout }, (err, stdout, stderr) => {
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
    const { stdout } = await run(['ink', '--json', '-d'], { timeout: 60_000 });
    const parsed = JSON.parse(stdout);
    assert.ok(typeof parsed.results[0].downloads === 'number');
    assert.ok(parsed.results[0].downloads > 0);
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
});
