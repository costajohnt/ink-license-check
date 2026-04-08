import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { extractTgz } from '../lib/tar.js';

/**
 * Build a minimal valid tar entry (512-byte header + padded data).
 */
function createTarEntry(name, content) {
  const data = Buffer.from(content, 'utf8');
  const header = Buffer.alloc(512);

  // Filename (0-99)
  header.write(name, 0, Math.min(name.length, 100), 'utf8');
  // Mode (100-107)
  header.write('0000644\0', 100, 8, 'utf8');
  // UID (108-115)
  header.write('0000000\0', 108, 8, 'utf8');
  // GID (116-123)
  header.write('0000000\0', 116, 8, 'utf8');
  // Size (124-135) - octal, 11 digits + null
  header.write(data.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf8');
  // Mtime (136-147)
  header.write('00000000000\0', 136, 12, 'utf8');
  // Type flag (156) - '0' = regular file
  header[156] = 0x30;
  // UStar magic (257-262)
  header.write('ustar\0', 257, 6, 'utf8');
  // Version (263-264)
  header.write('00', 263, 2, 'utf8');

  // Calculate checksum: sum of all header bytes, treating checksum field (148-155) as spaces
  header.fill(0x20, 148, 156);
  let checksum = 0;
  for (let i = 0; i < 512; i++) checksum += header[i];
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8');

  // Pad data to 512-byte boundary
  const paddingSize = data.length % 512 === 0 ? 0 : 512 - (data.length % 512);
  const padding = Buffer.alloc(paddingSize);

  return Buffer.concat([header, data, padding]);
}

function createTar(entries) {
  const parts = entries.map(([name, content]) => createTarEntry(name, content));
  // End-of-archive marker: two 512-byte zero blocks
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}

function createTgz(entries) {
  return gzipSync(createTar(entries));
}

describe('extractTgz', () => {
  it('extracts a single file', () => {
    const tgz = createTgz([['package/hello.txt', 'Hello World']]);
    const entries = extractTgz(tgz);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, 'hello.txt');
    assert.equal(entries[0].data.toString(), 'Hello World');
  });

  it('extracts multiple files', () => {
    const tgz = createTgz([
      ['package/a.js', 'const a = 1;'],
      ['package/b.js', 'const b = 2;'],
      ['package/lib/c.js', 'const c = 3;'],
    ]);
    const entries = extractTgz(tgz);

    assert.equal(entries.length, 3);
    assert.equal(entries[0].name, 'a.js');
    assert.equal(entries[1].name, 'b.js');
    assert.equal(entries[2].name, 'lib/c.js');
  });

  it('strips the package/ prefix', () => {
    const tgz = createTgz([['package/src/index.js', 'export default 42;']]);
    const entries = extractTgz(tgz);

    assert.equal(entries[0].name, 'src/index.js');
  });

  it('handles files with content exactly 512 bytes', () => {
    const content = 'x'.repeat(512);
    const tgz = createTgz([['package/exact.txt', content]]);
    const entries = extractTgz(tgz);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].data.toString(), content);
  });

  it('handles files with content larger than 512 bytes', () => {
    const content = 'y'.repeat(1500);
    const tgz = createTgz([['package/large.txt', content]]);
    const entries = extractTgz(tgz);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].data.toString(), content);
  });

  it('handles empty tar gracefully', () => {
    const tgz = gzipSync(Buffer.alloc(1024)); // just end-of-archive
    const entries = extractTgz(tgz);

    assert.equal(entries.length, 0);
  });

  it('preserves binary data correctly', () => {
    const binary = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80, 0x7f]);
    const header = Buffer.alloc(512);
    header.write('package/bin.dat', 0, 100, 'utf8');
    header.write('0000644\0', 100, 8, 'utf8');
    header.write('0000000\0', 108, 8, 'utf8');
    header.write('0000000\0', 116, 8, 'utf8');
    header.write(binary.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf8');
    header.write('00000000000\0', 136, 12, 'utf8');
    header[156] = 0x30;
    header.write('ustar\0', 257, 6, 'utf8');
    header.write('00', 263, 2, 'utf8');
    header.fill(0x20, 148, 156);
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += header[i];
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8');

    const padding = Buffer.alloc(512 - binary.length);
    const tar = Buffer.concat([header, binary, padding, Buffer.alloc(1024)]);
    const tgz = gzipSync(tar);

    const entries = extractTgz(tgz);
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0].data, binary);
  });
});
