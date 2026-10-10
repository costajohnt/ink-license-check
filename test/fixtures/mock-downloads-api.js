// Preloaded into the CLI by test/cli.test.js (`node --import`) so tests that
// exercise download counts do not depend on the live api.npmjs.org service.
// Requests to the npm registry itself are passed through untouched.
//
// MOCK_DOWNLOADS=<n>    respond 200 with { downloads: n }
// MOCK_DOWNLOADS=fail   fail the request with a network error

import https from 'node:https';
import { PassThrough } from 'node:stream';

const mode = process.env.MOCK_DOWNLOADS;
const realGet = https.get;

https.get = function (url, options, callback) {
  if (!String(url).startsWith('https://api.npmjs.org/') || mode == null) {
    return realGet.call(this, url, options, callback);
  }

  // A stream stands in for the ClientRequest: it supports .on() and .destroy().
  const req = new PassThrough();

  setImmediate(() => {
    if (mode === 'fail') {
      req.emit('error', new Error('getaddrinfo ENOTFOUND api.npmjs.org'));
      return;
    }

    const res = new PassThrough();
    res.statusCode = 200;
    res.headers = { 'content-type': 'application/json' };
    callback(res);
    res.end(JSON.stringify({ downloads: Number(mode) }));
  });

  return req;
};
