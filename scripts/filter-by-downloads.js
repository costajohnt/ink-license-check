import https from 'node:https';
import { readFileSync } from 'node:fs';

const packages = readFileSync('/tmp/ink-candidate-pkgs.txt', 'utf8')
  .split('\n').filter(Boolean);

const BATCH_SIZE = 128; // npm bulk API accepts up to 128
const MIN_DOWNLOADS = 10000;

function fetchDownloads(names) {
  const param = names.map(n => n.startsWith('@') ? `@${encodeURIComponent(n.slice(1))}` : encodeURIComponent(n)).join(',');
  const url = `https://api.npmjs.org/downloads/point/last-month/${param}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          resolve(data);
        } catch {
          resolve({});
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

const highDownload = [];
let checked = 0;

for (let i = 0; i < packages.length; i += BATCH_SIZE) {
  const batch = packages.slice(i, i + BATCH_SIZE);
  checked += batch.length;
  
  try {
    const data = await fetchDownloads(batch);
    
    // Handle both single-package (object) and multi-package (keyed object) responses
    if (data && typeof data === 'object') {
      for (const [name, info] of Object.entries(data)) {
        if (info && info.downloads >= MIN_DOWNLOADS) {
          highDownload.push({ name, downloads: info.downloads });
        }
      }
    }
  } catch (e) {
    process.stderr.write(`Batch error at ${i}: ${e.message}\n`);
  }
  
  if (checked % 1000 === 0) process.stderr.write(`Checked ${checked}/${packages.length}...\n`);
  
  // Rate limit: ~1 req per 100ms
  await new Promise(r => setTimeout(r, 100));
}

highDownload.sort((a, b) => b.downloads - a.downloads);
highDownload.forEach(p => console.log(`${p.downloads}\t${p.name}`));
process.stderr.write(`\nDone: ${highDownload.length} packages with ${MIN_DOWNLOADS}+ downloads/month out of ${checked} checked\n`);
