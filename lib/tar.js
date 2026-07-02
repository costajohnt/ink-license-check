import { gunzipSync } from 'node:zlib';

/**
 * Extract files from a .tgz buffer using manual tar parsing.
 * Returns Array<{ name: string, data: Buffer }>.
 *
 * Tar format: 512-byte headers followed by file data padded to 512-byte boundaries.
 * npm tarballs wrap everything in a `package/` directory which we strip.
 */
export function extractTgz(tgzBuffer) {
  let tar;
  try {
    tar = gunzipSync(tgzBuffer);
  } catch (err) {
    throw new Error(`Failed to decompress tarball (${tgzBuffer.length} bytes): ${err.message}`);
  }
  const entries = [];
  let offset = 0;
  let longName = null;
  let paxName = null; // PAX 'x' path for the very next entry
  let globalPaxName = null; // PAX 'g' path default

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);

    // End-of-archive: all-zero block
    if (isZeroBlock(header)) break;

    const typeFlag = header[156];
    const size = readOctal(header, 124, 12);
    // Name precedence: PAX per-file 'x' path, then GNU long name, then PAX
    // global 'g' path, then the (possibly truncated) ustar header name.
    const name = paxName || longName || globalPaxName || readName(header);
    longName = null;
    paxName = null;

    offset += 512;

    // Validate size doesn't exceed remaining buffer
    if (offset + size > tar.length) {
      throw new Error('Corrupted tar: entry size exceeds archive bounds');
    }

    // GNU long name extension — next data block is the real filename
    if (typeFlag === 0x4c) { // 'L'
      longName = tar.subarray(offset, offset + size).toString('utf8').replace(/\0+$/, '');
      offset += padTo512(size);
      continue;
    }

    // PAX extended headers — 'x' applies to the next entry, 'g' is a global
    // default. Both carry a `path=` record that overrides the ustar name, which
    // is otherwise truncated to 100 chars and can drop the file extension.
    if (typeFlag === 0x78 || typeFlag === 0x67) { // 'x' / 'g'
      const records = parsePaxRecords(tar.subarray(offset, offset + size));
      if (records.path) {
        if (typeFlag === 0x78) {
          paxName = records.path;
        } else {
          globalPaxName = records.path;
        }
      }

      offset += padTo512(size);
      continue;
    }

    // Regular file: type '0' (0x30) or NUL (0x00)
    if ((typeFlag === 0x30 || typeFlag === 0x00) && size > 0) {
      const data = Buffer.from(tar.subarray(offset, offset + size));
      // Strip leading package/ prefix that npm adds
      const stripped = name.replace(/^[^/]+\//, '');
      entries.push({ name: stripped, data });
    }

    offset += padTo512(size);
  }

  return entries;
}

// Parse PAX extended-header records of the form "<length> key=value\n".
// `length` is the byte length of the whole record (digits, space, key, value,
// newline). Returns a plain object of the records found.
function parsePaxRecords(buf) {
  const records = {};
  let pos = 0;

  while (pos < buf.length) {
    let sp = pos;
    while (sp < buf.length && buf[sp] !== 0x20) sp++;
    if (sp >= buf.length) break;

    const len = Number.parseInt(buf.subarray(pos, sp).toString('ascii'), 10);
    if (!Number.isInteger(len) || len <= 0 || pos + len > buf.length) break;

    const record = buf.subarray(sp + 1, pos + len).toString('utf8').replace(/\n$/, '');
    const eq = record.indexOf('=');
    if (eq !== -1) {
      records[record.slice(0, eq)] = record.slice(eq + 1);
    }

    pos += len;
  }

  return records;
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
  const value = Number.parseInt(str, 8);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid octal value in tar header: "${str}"`);
  }
  return value;
}

function padTo512(size) {
  const remainder = size % 512;
  return remainder === 0 ? size : size + (512 - remainder);
}

function isZeroBlock(buf) {
  return buf.every((byte) => byte === 0);
}
