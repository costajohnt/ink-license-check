#!/usr/bin/env node

import https from 'node:https';
import { execFileSync } from 'node:child_process';

const TOKEN = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
const BASE_URL = 'https://github.com/vadimdemedes/ink/network/dependents?dependent_type=PACKAGE';

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 ink-license-check',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchPage(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Known GitHub usernames/org names to filter out
const GITHUB_NAMES = new Set([
  'danielthedm', 'happier-dev', 'hyperdxio', 'inevolin', 'krasnoperov',
  'makluganteng', 'stelee410', 'stoyan-koychev', 'tmoreton', 'zyzheal',
]);

function extractFromPage(html) {
  const packages = new Set();

  // Find the Box section containing dependents
  const boxMatch = html.match(/<div class="Box"[\s\S]*?<div class="paginate/);
  if (!boxMatch) return { packages: [], cursor: null };

  const boxHtml = boxMatch[0];
  const text = boxHtml
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&[a-z]+;/g, ' ');

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Scoped package
    const scoped = line.match(/^(@[\w.-]+\/[\w.-]+)$/);
    if (scoped) {
      packages.add(scoped[1]);
      continue;
    }
    // Unscoped package (lowercase, hyphens/dots, >2 chars, not a number)
    const unscoped = line.match(/^([a-z][\w.-]+)$/);
    if (unscoped && unscoped[1].length > 2 && !/^\d/.test(unscoped[1])) {
      const name = unscoped[1];
      if (!GITHUB_NAMES.has(name)) {
        packages.add(name);
      }
    }
  }

  // Remove known non-packages
  packages.delete('ink');
  for (const p of packages) {
    if (p.endsWith('/ink') || p.includes('/ink-')) {
      // Keep these — they're forks or ink ecosystem scoped packages
    }
  }

  const nextMatch = html.match(/dependents_after=([A-Za-z0-9=]+)/);
  return { packages: [...packages], cursor: nextMatch ? nextMatch[1] : null };
}

const allPackages = new Set();
let url = BASE_URL;
let page = 0;
let lastCursor = null;

while (url && page < 200) {
  page++;
  process.stderr.write(`Page ${page}...`);

  const html = await fetchPage(url);
  const { packages, cursor } = extractFromPage(html);

  packages.forEach((p) => allPackages.add(p));
  process.stderr.write(` ${packages.length} pkgs (${allPackages.size} total)\n`);

  if (!cursor || cursor === lastCursor || packages.length === 0) break;
  lastCursor = cursor;
  url = `${BASE_URL}&dependents_after=${cursor}`;

  await new Promise((r) => setTimeout(r, 300));
}

[...allPackages].sort().forEach((p) => console.log(p));
process.stderr.write(`\nDone: ${allPackages.size} packages from ${page} pages\n`);
