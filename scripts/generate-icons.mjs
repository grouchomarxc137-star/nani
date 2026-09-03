/**
 * Generates the PWA icons as PNGs with no image dependencies.
 * Placeholder art: a water drop on the warm background colour. Replace these
 * once the real Insieme branding and bird artwork exist.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'web',
  'public',
  'icons',
);
mkdirSync(outDir, { recursive: true });

const BG = [253, 244, 227]; // --bg
const DROP = [93, 156, 189]; // water blue
const DROP_DARK = [70, 128, 160];

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixel(x, y, size);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Signed distance to a teardrop: a circle for the lower body, tapering to a
 * point at the top. Positive inside.
 */
function dropCoverage(x, y, size) {
  const u = (x + 0.5) / size;
  const v = (y + 0.5) / size;

  const cx = 0.5;
  const cy = 0.62;
  const radius = 0.26;
  const tipY = 0.14;

  // Lower body: plain circle.
  const circle = radius - Math.hypot(u - cx, v - cy);

  // Upper body: width shrinks linearly from the circle's widest point to the tip.
  let cone = -1;
  if (v < cy && v >= tipY) {
    const t = (cy - v) / (cy - tipY);
    const halfWidth = radius * (1 - t * t);
    // Guard the tip: a zero-width cone would still register a hairline.
    if (halfWidth > 0) cone = halfWidth - Math.abs(u - cx);
  }

  return Math.max(circle, cone);
}

function pixel(x, y, size) {
  const distance = dropCoverage(x, y, size);
  const edge = 1.5 / size; // antialiasing band
  if (distance <= -edge) return BG;

  // Slight vertical shading so the drop is not a flat blob.
  const shade = 0.5 + (0.5 * y) / size;
  const colour = [
    Math.round(DROP[0] * (1 - shade) + DROP_DARK[0] * shade),
    Math.round(DROP[1] * (1 - shade) + DROP_DARK[1] * shade),
    Math.round(DROP[2] * (1 - shade) + DROP_DARK[2] * shade),
  ];

  if (distance >= edge) return colour;

  const blend = (distance + edge) / (2 * edge);
  return colour.map((channel, index) => Math.round(BG[index] * (1 - blend) + channel * blend));
}

for (const size of [180, 192, 512]) {
  const file = path.join(outDir, `icon-${size}.png`);
  writeFileSync(file, png(size, pixel));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
