import https from 'node:https';
import http from 'node:http';

/**
 * Zero-dep HTTP(S) fetcher with redirect following.
 * Returns { statusCode, headers, body: Buffer }.
 */
export function fetch(url, { maxRedirects = 5, maxSize = 50 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (maxRedirects <= 0) {
          return reject(new Error(`Too many redirects for ${url}`));
        }
        const target = new URL(res.headers.location, url).href;
        return fetch(target, { maxRedirects: maxRedirects - 1, maxSize }).then(resolve, reject);
      }

      const contentLength = parseInt(res.headers['content-length'], 10);
      if (contentLength > maxSize) {
        res.resume();
        return reject(new Error(`Response too large: ${contentLength} bytes (limit ${maxSize})`));
      }

      const chunks = [];
      let totalSize = 0;

      res.on('data', (chunk) => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          res.destroy();
          return reject(new Error(`Response exceeded size limit of ${maxSize} bytes`));
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });

      res.on('error', reject);
    }).on('error', reject);
  });
}
