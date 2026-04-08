import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;

const c = {
  reset: supportsColor ? '\x1b[0m' : '',
  bold: supportsColor ? '\x1b[1m' : '',
  dim: supportsColor ? '\x1b[2m' : '',
  red: supportsColor ? '\x1b[31m' : '',
  green: supportsColor ? '\x1b[32m' : '',
  yellow: supportsColor ? '\x1b[33m' : '',
};

function getVersion() {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(dir, '..', 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

export function formatText(results) {
  const lines = [`\n${c.bold}ink-license-check v${getVersion()}${c.reset}\n`];

  for (const r of results) {
    if (r.error) {
      lines.push(`  ${c.yellow}${c.bold}SKIP${c.reset}  ${c.bold}${r.package}${c.reset}`);
      lines.push(`  ${c.dim}      ${r.error}${c.reset}`);
    } else if (!r.usesInk) {
      lines.push(`  ${c.green}${c.bold}PASS${c.reset}  ${c.bold}${r.package}@${r.version}${c.reset}`);
      lines.push(`  ${c.dim}      Does not use ink${c.reset}`);
    } else if (r.attribution.found) {
      const dl = r.downloads != null ? `  ${c.dim}(${formatNumber(r.downloads)} monthly downloads)${c.reset}` : '';
      lines.push(`  ${c.green}${c.bold}PASS${c.reset}  ${c.bold}${r.package}@${r.version}${c.reset}${dl}`);
      const type = r.inkDetection.dependencyType === 'bundled' ? 'bundled' : 'dependency';
      lines.push(`  ${c.dim}      Uses ink (${type}), attribution found in ${r.attribution.locations.join(', ')}${c.reset}`);
    } else {
      const dl = r.downloads != null ? `  ${c.dim}(${formatNumber(r.downloads)} monthly downloads)${c.reset}` : '';
      lines.push(`  ${c.red}${c.bold}FAIL${c.reset}  ${c.bold}${r.package}@${r.version}${c.reset}${dl}`);
      const type = r.inkDetection.dependencyType === 'bundled' ? 'bundled' : 'dependency';
      lines.push(`  ${c.dim}      Uses ink (${type}), missing attribution${c.reset}`);
      for (const ev of r.inkDetection.evidence) {
        lines.push(`  ${c.dim}      Evidence: ${ev}${c.reset}`);
      }
      if (r.attribution.missingCopyrightHolders.length > 0) {
        lines.push(`  ${c.dim}      Missing: ${r.attribution.missingCopyrightHolders.join(', ')}${c.reset}`);
      }
    }
    lines.push('');
  }

  const violations = results.filter((r) => r.status === 'fail').length;
  const total = results.length;

  if (violations > 0) {
    lines.push(`${c.red}${c.bold}${violations} violation${violations === 1 ? '' : 's'} found in ${total} package${total === 1 ? '' : 's'}${c.reset}\n`);
  } else {
    lines.push(`${c.green}${c.bold}No violations found in ${total} package${total === 1 ? '' : 's'}${c.reset}\n`);
  }

  return lines.join('\n');
}

export function formatJson(results) {
  const summary = {
    total: results.length,
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    skip: results.filter((r) => r.status === 'skip').length,
  };

  return JSON.stringify({ results, summary }, null, 2);
}

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
