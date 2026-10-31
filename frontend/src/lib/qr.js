/**
 * Self-contained QR Code Generator (Byte mode, standard QR Model 2).
 * Zero dependencies, produces an array of booleans (matrix) or an SVG string.
 */

// Galois field tables
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);
for (let i = 0, x = 1; i < 256; i++) {
  EXP_TABLE[i] = x;
  LOG_TABLE[x] = i;
  x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
}

function glog(n) {
  if (n < 1) throw new Error('glog(' + n + ')');
  return LOG_TABLE[n];
}
function gexp(n) {
  while (n < 0) n += 255;
  while (n >= 255) n -= 255;
  return EXP_TABLE[n];
}

class Polynomial {
  constructor(num, shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Uint8Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[offset + i];
  }
  get(index) { return this.num[index]; }
  getLength() { return this.num.length; }
  multiply(e) {
    const num = new Uint8Array(this.getLength() + e.getLength() - 1);
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
      }
    }
    return new Polynomial(num);
  }
  mod(e) {
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = glog(this.get(0)) - glog(e.get(0));
    const num = new Uint8Array(this.getLength());
    for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
    for (let i = 0; i < e.getLength(); i++) {
      num[i] ^= gexp(glog(e.get(i)) + ratio);
    }
    return new Polynomial(num).mod(e);
  }
}

function getErrorCorrectPolynomial(errorCorrectLength) {
  let a = new Polynomial([1], 0);
  for (let i = 0; i < errorCorrectLength; i++) {
    a = a.multiply(new Polynomial([1, gexp(i)], 0));
  }
  return a;
}

// RS Block definitions: [totalCount, dataCount]
const RS_BLOCK_TABLE = {
  // [totalCodewords, dataCodewords] for Level M (approx 15% recovery)
  1: [[1, 26, 16]],
  2: [[1, 44, 28]],
  3: [[1, 70, 44]],
  4: [[2, 50, 32]],
  5: [[2, 67, 43]],
  6: [[4, 43, 27]],
  7: [[4, 72, 31]],
  8: [[2, 68, 38], [2, 69, 39]],
  9: [[3, 68, 36], [2, 69, 37]],
  10: [[4, 67, 43], [1, 68, 44]],
};

const PATTERN_POSITION_TABLE = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

export function createQRCodeMatrix(text) {
  // UTF-8 encode
  const utf8Bytes = [];
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c < 128) utf8Bytes.push(c);
    else if (c < 2048) {
      utf8Bytes.push(192 | (c >> 6), 128 | (c & 63));
    } else if (c < 55296 || c >= 57344) {
      utf8Bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    } else {
      i++;
      c = 65536 + (((c & 1023) << 10) | (text.charCodeAt(i) & 1023));
      utf8Bytes.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
  }

  // Determine minimum version
  let typeNumber = 1;
  while (typeNumber <= 10) {
    const blocks = RS_BLOCK_TABLE[typeNumber];
    const totalDataCount = blocks.reduce((acc, b) => acc + b[0] * b[2], 0);
    // 4 bits mode + (typeNumber < 10 ? 8 : 16) bits length + data*8
    const requiredBits = 4 + (typeNumber < 10 ? 8 : 16) + utf8Bytes.length * 8;
    if (requiredBits <= totalDataCount * 8) break;
    typeNumber++;
  }
  if (typeNumber > 10) typeNumber = 10;

  // Build bit buffer
  const buffer = [];
  function putBits(num, length) {
    for (let i = 0; i < length; i++) buffer.push(((num >>> (length - i - 1)) & 1) === 1);
  }

  // Mode: 0100 = 8-bit byte
  putBits(4, 4);
  // Length
  putBits(utf8Bytes.length, typeNumber < 10 ? 8 : 16);
  // Data
  for (let b of utf8Bytes) putBits(b, 8);

  const blocks = RS_BLOCK_TABLE[typeNumber];
  const totalDataBytes = blocks.reduce((acc, b) => acc + b[0] * b[2], 0);
  const totalDataBits = totalDataBytes * 8;

  // Terminator
  for (let i = 0; i < 4 && buffer.length < totalDataBits; i++) buffer.push(false);
  // Pad to byte boundary
  while (buffer.length % 8 !== 0) buffer.push(false);
  // Pad bytes 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (buffer.length < totalDataBits) {
    putBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Split into RS blocks and compute EC
  const rawBytes = [];
  for (let i = 0; i < buffer.length; i += 8) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) if (buffer[i + j]) byteVal |= 1 << (7 - j);
    rawBytes.push(byteVal);
  }

  let byteOffset = 0;
  const rsBlocks = [];
  for (let b of blocks) {
    const count = b[0];
    const totalCodewords = b[1];
    const dataCodewords = b[2];
    const ecCodewords = totalCodewords - dataCodewords;
    for (let i = 0; i < count; i++) {
      const data = rawBytes.slice(byteOffset, byteOffset + dataCodewords);
      byteOffset += dataCodewords;
      const poly = new Polynomial(data, ecCodewords);
      const ecPoly = getErrorCorrectPolynomial(ecCodewords);
      const mod = poly.mod(ecPoly);
      const ec = new Uint8Array(ecCodewords);
      const offset = ecCodewords - mod.getLength();
      for (let j = 0; j < mod.getLength(); j++) ec[j + offset] = mod.get(j);
      rsBlocks.push({ data, ec });
    }
  }

  // Interleave codewords
  const interleaved = [];
  let maxData = 0;
  for (let b of rsBlocks) if (b.data.length > maxData) maxData = b.data.length;
  for (let i = 0; i < maxData; i++) {
    for (let b of rsBlocks) if (i < b.data.length) interleaved.push(b.data[i]);
  }
  let maxEc = 0;
  for (let b of rsBlocks) if (b.ec.length > maxEc) maxEc = b.ec.length;
  for (let i = 0; i < maxEc; i++) {
    for (let b of rsBlocks) if (i < b.ec.length) interleaved.push(b.ec[i]);
  }

  // Setup Module Matrix
  const moduleCount = typeNumber * 4 + 17;
  const modules = Array.from({ length: moduleCount }, () => Array(moduleCount).fill(null));

  // Finder Patterns
  function placeFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        if (row + r < 0 || moduleCount <= row + r || col + c < 0 || moduleCount <= col + c) continue;
        if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
          modules[row + r][col + c] = true;
        } else {
          modules[row + r][col + c] = false;
        }
      }
    }
  }
  placeFinder(0, 0);
  placeFinder(moduleCount - 7, 0);
  placeFinder(0, moduleCount - 7);

  // Timing patterns
  for (let r = 8; r < moduleCount - 8; r++) {
    if (modules[r][6] === null) modules[r][6] = r % 2 === 0;
  }
  for (let c = 8; c < moduleCount - 8; c++) {
    if (modules[6][c] === null) modules[6][c] = c % 2 === 0;
  }

  // Alignment patterns
  if (typeNumber >= 2) {
    const pos = PATTERN_POSITION_TABLE[typeNumber - 1];
    for (let r of pos) {
      for (let c of pos) {
        if (modules[r][c] !== null) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            modules[r + dr][c + dc] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
          }
        }
      }
    }
  }

  // Dark module
  modules[4 * typeNumber + 9][8] = true;

  // Format info area reserved (set to false placeholder)
  for (let i = 0; i < 9; i++) {
    if (modules[8][i] === null) modules[8][i] = false;
    if (modules[i][8] === null) modules[i][8] = false;
  }
  for (let i = moduleCount - 8; i < moduleCount; i++) {
    if (modules[8][i] === null) modules[8][i] = false;
    if (modules[i][8] === null) modules[i][8] = false;
  }

  // Place interleaved data bits
  const finalBits = [];
  for (let byte of interleaved) {
    for (let bit = 7; bit >= 0; bit--) finalBits.push(((byte >>> bit) & 1) === 1);
  }

  let bitIdx = 0;
  for (let right = moduleCount - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    for (let vert = 0; vert < moduleCount; vert++) {
      for (let c = 0; c < 2; c++) {
        const col = right - c;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? (moduleCount - 1 - vert) : vert;
        if (modules[row][col] === null) {
          let dark = false;
          if (bitIdx < finalBits.length) dark = finalBits[bitIdx++];
          // Mask 0: (row + col) % 2 === 0
          if ((row + col) % 2 === 0) dark = !dark;
          modules[row][col] = dark;
        }
      }
    }
  }

  // Apply format info (Mask 0, Level M => 0x5412)
  const formatInfo = 0x5412;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatInfo >>> i) & 1) === 1;
    if (i < 6) modules[i][8] = bit;
    else if (i < 8) modules[i + 1][8] = bit;
    else modules[moduleCount - 15 + i][8] = bit;

    if (i < 8) modules[8][moduleCount - i - 1] = bit;
    else if (i < 9) modules[8][15 - i - 1 + 1] = bit;
    else modules[8][15 - i - 1] = bit;
  }

  return modules;
}

export function generateQRCodeSVG(text, size = 180) {
  const matrix = createQRCodeMatrix(text);
  const n = matrix.length;
  const cellSize = size / (n + 4); // 2 cells quiet zone
  let paths = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = (c + 2) * cellSize;
        const y = (r + 2) * cellSize;
        paths += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z `;
      }
    }
  }
  return {
    size,
    cellSize,
    n,
    paths,
    matrix,
  };
}
