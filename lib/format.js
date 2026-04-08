const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;

const c = {
  reset: supportsColor ? '\x1b[0m' : '',
  bold: supportsColor ? '\x1b[1m' : '',
  dim: supportsColor ? '\x1b[2m' : '',
  red: supportsColor ? '\x1b[31m' : '',
  green: supportsColor ? '\x1b[32m' : '',
  yellow: supportsColor ? '\x1b[33m' : '',
};

export function formatText(results, { version = 'unknown' } = {}) {
  const lines = [`\n${c.bold}ink-license-check v${version}${c.reset}\n`];

  for (const r of results) {
    if (r.error) {
      const label = r.status === 'error' ? `${c.red}${c.bold}ERR!` : `${c.yellow}${c.bold}SKIP`;
      lines.push(`  ${label}${c.reset}  ${c.bold}${r.package}${c.reset}`);
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

  const summary = countStatuses(results);

  if (summary.fail > 0) {
    lines.push(`${c.red}${c.bold}${summary.fail} violation${summary.fail === 1 ? '' : 's'} found in ${summary.total} package${summary.total === 1 ? '' : 's'}${c.reset}\n`);
  } else {
    lines.push(`${c.green}${c.bold}No violations found in ${summary.total} package${summary.total === 1 ? '' : 's'}${c.reset}\n`);
  }

  return lines.join('\n');
}

export function formatJson(results) {
  const summary = countStatuses(results);
  return JSON.stringify({ results, summary }, null, 2);
}

export function formatReport(results, { version = 'unknown', minDownloads = null } = {}) {
  const lines = [];
  const today = new Date().toISOString().split('T')[0];

  lines.push('# Ink License Attribution Report');
  lines.push('');
  lines.push(`**Generated:** ${today}`);
  lines.push(`**Tool:** [ink-license-check](https://github.com/costajohnt/ink-license-check) v${version}`);
  if (minDownloads != null) {
    lines.push(`**Threshold:** ${formatNumber(minDownloads)}+ monthly downloads`);
  }
  lines.push('');

  // Split results by category
  const violations = results.filter((r) => r.status === 'fail');
  const passing = results.filter((r) => r.status === 'pass' && r.usesInk);
  const noInk = results.filter((r) => r.status === 'pass' && !r.usesInk);
  const skipped = results.filter((r) => r.status === 'skip' || r.status === 'error');
  const summary = countStatuses(results);

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Packages checked | ${summary.total} |`);
  lines.push(`| Uses Ink | ${violations.length + passing.length} |`);
  lines.push(`| **Violations** | **${violations.length}** |`);
  lines.push(`| Properly attributed | ${passing.length} |`);
  if (noInk.length > 0) lines.push(`| Does not use Ink | ${noInk.length} |`);
  if (skipped.length > 0) lines.push(`| Skipped/errors | ${skipped.length} |`);
  lines.push('');

  // Violations detail
  if (violations.length > 0) {
    lines.push('## Violations');
    lines.push('');
    lines.push('The following packages use Ink but do not include the required MIT license attribution:');
    lines.push('');

    // Sort violations by downloads (highest first)
    const sorted = [...violations].sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));

    for (const r of sorted) {
      const dl = r.downloads != null ? ` (${formatNumber(r.downloads)} monthly downloads)` : '';
      lines.push(`### ${r.package}@${r.version}${dl}`);
      lines.push('');
      const type = r.inkDetection.dependencyType === 'bundled' ? 'Bundled' : 'Direct dependency';
      lines.push(`- **Detection:** ${type} (${r.inkDetection.evidence.join('; ')})`);
      lines.push(`- **Missing:** ${r.attribution.missingCopyrightHolders.join(', ')}`);
      lines.push('');
    }
  }

  // Passing table
  if (passing.length > 0) {
    lines.push('## Properly Attributed');
    lines.push('');
    lines.push('| Package | Version | Downloads | Attribution In |');
    lines.push('|---------|---------|-----------|----------------|');
    for (const r of passing) {
      const dl = r.downloads != null ? formatNumber(r.downloads) : '-';
      lines.push(`| ${r.package} | ${r.version} | ${dl} | ${r.attribution.locations.join(', ')} |`);
    }
    lines.push('');
  }

  // Context section
  lines.push('---');
  lines.push('');
  lines.push('[Ink](https://github.com/vadimdemedes/ink) is MIT licensed by Vadym Demedes and Sindre Sorhus. The MIT license requires that the copyright notice be included in all copies or substantial portions of the software.');

  return lines.join('\n');
}

function countStatuses(results) {
  const summary = { total: results.length, pass: 0, fail: 0, skip: 0, error: 0 };
  for (const r of results) summary[r.status]++;
  return summary;
}

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
