import https from 'node:https';
import http from 'node:http';

/**
 * Zero-dep HTTP(S) fetcher with redirect following.
 * Returns { statusCode, headers, body: Buffer }.
 */
export function fetch(url, { maxRedirects = 5, maxSize = 50 * 1024 * 1024, timeout = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    let settled = false;

    const done = (fn, val) => {
      if (settled) return;
      settled = true;
      fn(val);
    };

    const req = protocol.get(url, { timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (maxRedirects <= 0) {
          return done(reject, new Error(`Too many redirects for ${url}`));
        }
        let target;
        try {
          target = new URL(res.headers.location, url);
        } catch {
          return done(reject, new Error(`Invalid redirect URL "${res.headers.location}" from ${url}`));
        }
        if (target.protocol !== 'https:' && target.protocol !== 'http:') {
          return done(reject, new Error(`Refusing non-HTTP redirect to ${target.href}`));
        }
        return fetch(target.href, { maxRedirects: maxRedirects - 1, maxSize, timeout }).then(
          (val) => done(resolve, val),
          (err) => done(reject, err),
        );
      }

      const contentLength = parseInt(res.headers['content-length'], 10);
      if (!Number.isNaN(contentLength) && contentLength > maxSize) {
        res.resume();
        return done(reject, new Error(`Response too large: ${contentLength} bytes (limit ${maxSize})`));
      }

      const chunks = [];
      let totalSize = 0;

      res.on('data', (chunk) => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          res.destroy();
          return done(reject, new Error(`Response exceeded size limit of ${maxSize} bytes`));
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        done(resolve, {
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });

      res.on('error', (err) => done(reject, err));
    });

    req.on('timeout', () => {
      req.destroy();
      done(reject, new Error(`Request timed out after ${timeout}ms: ${url}`));
    });

    req.on('error', (err) => done(reject, err));
  });
}
