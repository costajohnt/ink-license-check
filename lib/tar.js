import { gunzipSync } from 'node:zlib';

/**
 * Extract files from a .tgz buffer using manual tar parsing.
 * Returns Array<{ name: string, data: Buffer }>.
 *
 * Tar format: 512-byte headers followed by file data padded to 512-byte boundaries.
 * npm tarballs wrap everything in a `package/` directory which we strip.
 */
export function extractTgz(tgzBuffer) {
  const tar = gunzipSync(tgzBuffer);
  const entries = [];
  let offset = 0;
  let longName = null;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);

    // End-of-archive: all-zero block
    if (isZeroBlock(header)) break;

    const typeFlag = header[156];
    const size = readOctal(header, 124, 12);
    let name = longName || readName(header);
    longName = null;

    offset += 512;

    // GNU long name extension — next data block is the real filename
    if (typeFlag === 0x4c) { // 'L'
      longName = tar.subarray(offset, offset + size).toString('utf8').replace(/\0+$/, '');
      offset += padTo512(size);
      continue;
    }

    // Regular file: type '0' (0x30) or NUL (0x00)
    if (typeFlag === 0x30 || typeFlag === 0x00) {
      if (size > 0) {
        const data = Buffer.from(tar.subarray(offset, offset + size));
        // Strip leading package/ prefix that npm adds
        const stripped = name.replace(/^[^/]+\//, '');
        entries.push({ name: stripped, data });
      }
    }

    offset += padTo512(size);
  }

  return entries;
}

function readName(header) {
  const prefix = readString(header, 345, 155);
  const name = readString(header, 0, 100);
  return prefix ? `${prefix}/${name}` : name;
}

function readString(buf, offset, length) {
  const slice = buf.subarray(offset, offset + length);
  const nullIdx = slice.indexOf(0);
  return (nullIdx === -1 ? slice : slice.subarray(0, nullIdx)).toString('utf8');
}

function readOctal(buf, offset, length) {
  const str = readString(buf, offset, length).trim();
  if (!str) return 0;
  return parseInt(str, 8) || 0;
}

function padTo512(size) {
  const remainder = size % 512;
  return remainder === 0 ? size : size + (512 - remainder);
}

function isZeroBlock(buf) {
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== 0) return false;
  }
  return true;
}
