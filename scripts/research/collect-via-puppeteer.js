// This script will be called repeatedly with a URL to scrape via puppeteer
// For now, let's use a different strategy: authenticated fetch page by page
// using gh auth token, with proper cursor tracking

import https from 'node:https';
import { execFileSync } from 'node:child_process';

const TOKEN = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
const BASE = 'https://github.com/vadimdemedes/ink/network/dependents?dependent_type=PACKAGE';

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Cookie: '', // No cookies needed with token auth
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchPage(new URL(res.headers.location, url).href).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function extract(html) {
  const packages = new Set();
  const boxMatch = html.match(/<div class="Box"[\s\S]*?<div class="paginate/);
  if (!boxMatch) return { packages: [], cursors: [] };
  
  const text = boxMatch[0]
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&[a-z]+;/g, ' ');
  
  for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
    if (/^@[\w.-]+\/[\w.-]+$/.test(line)) packages.add(line);
    else if (/^[a-z][\w.-]{2,}$/.test(line) && !/^\d/.test(line)) packages.add(line);
  }
  
  // Remove noise
  packages.delete('ink');
  packages.delete('ustar');
  
  // Get ALL cursors on the page (there may be multiple pagination links)
  const cursors = [];
  const cursorPattern = /dependents_after=([A-Za-z0-9=]+)/g;
  let m;
  while ((m = cursorPattern.exec(html)) !== null) {
    if (!cursors.includes(m[1])) cursors.push(m[1]);
  }
  
  return { packages: [...packages], cursors };
}

const allPackages = new Set();
let url = BASE;
const seenCursors = new Set();

for (let page = 1; page <= 200; page++) {
  process.stderr.write(`Page ${page}... `);
  
  let html;
  try {
    html = await fetchPage(url);
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    break;
  }
  
  const { packages, cursors } = extract(html);
  packages.forEach(p => allPackages.add(p));
  process.stderr.write(`${packages.length} pkgs (${allPackages.size} total)`);
  
  // Find a cursor we haven't used yet
  let nextCursor = null;
  for (const c of cursors) {
    if (!seenCursors.has(c)) {
      nextCursor = c;
      seenCursors.add(c);
      break;
    }
  }
  
  if (!nextCursor) {
    process.stderr.write(' [no new cursor, stopping]\n');
    break;
  }
  
  url = `${BASE}&dependents_after=${nextCursor}`;
  process.stderr.write('\n');
  
  await new Promise(r => setTimeout(r, 500));
}

[...allPackages].sort().forEach(p => console.log(p));
process.stderr.write(`\nDone: ${allPackages.size} packages\n`);
