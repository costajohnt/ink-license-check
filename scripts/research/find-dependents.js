#!/usr/bin/env node

/**
 * Scrape GitHub's dependents page to find all npm packages that depend on ink.
 * Uses GitHub auth token from `gh auth token` for pagination.
 * Outputs one package name per line.
 */

import https from 'node:https';
import { execFileSync } from 'node:child_process';

const TOKEN = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
const BASE = 'https://github.com/vadimdemedes/ink/network/dependents?dependent_type=PACKAGE';
const MAX_PAGES = 30;

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'text/html',
        'User-Agent': 'ink-license-check',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function extractPackageNames(html) {
  const packages = new Set();

  // GitHub dependents page structure: each Box-row contains a repo
  // and lists dependent package names as links or spans
  // Package names appear in various patterns:

  // Pattern 1: data-test-id="dg-repo-pkg-dependent" links
  const depPattern = /data-test-id="dg-repo-pkg-dependent"[^>]*>([^<]+)/g;
  let m;
  while ((m = depPattern.exec(html)) !== null) {
    const name = m[1].trim();
    if (name) packages.add(name);
  }

  // Pattern 2: Package names in the row text (between repo link and stars)
  // These are typically in <a> tags or <span> tags within Box-row
  const rowHtmlPattern = /class="Box-row([\s\S]*?)(?=class="Box-row|<\/div>\s*<\/div>\s*<\/div>\s*<div class="paginate)/g;
  while ((m = rowHtmlPattern.exec(html)) !== null) {
    const rowHtml = m[1];
    // Find all potential package names (scoped and unscoped)
    // Look for text that looks like npm package names
    const namePattern = /(?:^|[\s>])(@[\w-]+\/[\w.-]+|[\w][\w.-]*[\w])(?=[\s<])/g;
    const text = rowHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    let nm;
    while ((nm = namePattern.exec(text)) !== null) {
      const candidate = nm[1];
      // Filter to likely npm package names
      if (candidate.startsWith('@') ||
          (candidate.length > 2 && !candidate.match(/^\d/) && candidate !== 'Stars' && candidate !== 'Forks')) {
        packages.add(candidate);
      }
    }
  }

  return packages;
}

function extractNextCursor(html) {
  const m = html.match(/dependents_after=([A-Za-z0-9=]+)/);
  return m ? m[1] : null;
}

async function main() {
  const allPackages = new Set();
  let url = BASE;
  let page = 0;

  while (url && page < MAX_PAGES) {
    page++;
    process.stderr.write(`Page ${page}...`);
    const html = await fetchPage(url);

    const packages = extractPackageNames(html);
    packages.forEach((p) => allPackages.add(p));
    process.stderr.write(` found ${packages.size} names (${allPackages.size} total)\n`);

    if (packages.size === 0) break;

    const cursor = extractNextCursor(html);
    if (!cursor) break;
    url = `${BASE}&dependents_after=${cursor}`;

    // Small delay to be polite
    await new Promise((r) => setTimeout(r, 500));
  }

  // Output all package names
  const sorted = [...allPackages].sort();
  sorted.forEach((p) => console.log(p));
  process.stderr.write(`\nDone: ${allPackages.size} unique package names from ${page} pages\n`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
