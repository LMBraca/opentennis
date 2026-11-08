/**
 * Demo imagery for screenshots.
 *
 * `next.config.ts` sets `remotePatterns: []` on purpose — no remote host gets
 * through the image optimiser, so there is no SSRF surface. That also means a
 * placeholder-service URL renders as a broken image, and every demo picture
 * has to be a real local file under `public/`.
 *
 * Rather than ship stock photos the club does not own, these are drawn: court
 * geometry in the palette from app/tokens.css.
 *
 * No dependencies. sharp is in the pnpm store as one of Next's optional deps
 * but is not resolvable from the workspace root, and adding it to please a
 * demo script would put a native module in the lockfile for everyone. PNG is
 * a signature, three chunks and a CRC, and zlib is in Node — so the whole
 * rasteriser is below. Supersampling at 2x is what keeps the rotated court
 * lines from looking like staircases.
 *
 *   node scripts/make-demo-images.mjs
 *
 * Writes apps/web/public/demo/*.png. Deterministic; safe to re-run.
 */

import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'apps', 'web', 'public', 'demo');

/** app/tokens.css. Optic yellow is "live right now" in the product, so here it
 *  is only ever the ball — never decoration. */
const C = {
  line: [255, 255, 255],
  clay700: [0x3b, 0x4a, 0x21],
  clay500: [0x52, 0x64, 0x30],
  hard500: [0x26, 0x61, 0x8f],
  hard600: [0x1b, 0x46, 0x68],
  optic: [0xc8, 0xdd, 0x3f],
};

// --- PNG ---------------------------------------------------------------

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** rgb: Uint8Array of w*h*3. */
function encodePng(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  // Filter byte 0 per scanline; deflate does the work.
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y += 1) {
    const o = y * (w * 3 + 1);
    raw[o] = 0;
    rgb.copy ? rgb.copy(raw, o + 1, y * w * 3, (y + 1) * w * 3) : null;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- drawing -----------------------------------------------------------

/**
 * Render by asking a shading function for the colour at a point, 2x
 * supersampled. Slower than a real rasteriser and irrelevant at these sizes.
 */
function render(w, h, shade) {
  const SS = 2;
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const c = shade((x + (sx + 0.5) / SS) / w, (y + (sy + 0.5) / SS) / h, w / h);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = SS * SS;
      const o = (y * w + x) * 3;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
    }
  }
  return out;
}

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Distance from (px,py) to the segment, in normalised units. */
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Paint the ball at (bx,by). Distance is measured in PIXEL proportions, not
 * UV — on a 16:9 canvas a circle in UV space comes out an ellipse.
 */
function withBall(col, u, v, ar, bx, by) {
  const d = Math.hypot((u - bx) * ar, v - by);
  return mix(C.optic, col, Math.min(1, Math.max(0, (d - 0.038) / 0.006)));
}

/** A court seen from above, rotated so it reads as a photograph not a diagram. */
function courtFromAbove({ surface, rot = -8, ball = true, aspect = 1 }) {
  const a = (rot * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // Court half-extents in rotated space.
  const CW = 0.33;
  const CH = 0.33 * 0.46 * aspect;
  const ALLEY = CH * 0.78;
  const SERVICE = CW * 0.38;
  const LW = 0.0035;
  const segs = [
    [-CW, -CH, CW, -CH],
    [-CW, CH, CW, CH],
    [-CW, -CH, -CW, CH],
    [CW, -CH, CW, CH],
    [-CW, -ALLEY, CW, -ALLEY],
    [-CW, ALLEY, CW, ALLEY],
    [-SERVICE, -ALLEY, -SERVICE, ALLEY],
    [SERVICE, -ALLEY, SERVICE, ALLEY],
    [-SERVICE, 0, SERVICE, 0],
  ];
  return (u, v, ar) => {
    const x = u - 0.5;
    const y = v - 0.5;
    const rx = x * cos + y * sin;
    const ry = -x * sin + y * cos;
    let d = Infinity;
    for (const [x1, y1, x2, y2] of segs) {
      d = Math.min(d, distToSeg(rx, ry, x1, y1, x2, y2));
    }
    // The net is heavier than the painted lines.
    const net = distToSeg(rx, ry, 0, -CH, 0, CH);
    const ink = Math.min(d / LW, net / (LW * 1.7));
    let col = mix(C.line, surface, Math.min(1, Math.max(0, ink - 0.5)));
    if (ball) col = withBall(col, u, v, ar, 0.74, 0.27);
    return col;
  };
}

/** Baseline corner — one thick line and a lot of surface. For wide covers. */
function baselineCorner({ surface, ball = false }) {
  const LW = 0.006;
  return (u, v, ar) => {
    const d = Math.min(
      distToSeg(u, v, -0.1, 0.72, 1.1, 0.52),
      distToSeg(u, v, 0.68, 1.1, 0.42, -0.1),
    );
    const col = mix(C.line, surface, Math.min(1, Math.max(0, d / LW - 0.5)));
    return ball ? withBall(col, u, v, ar, 0.23, 0.37) : col;
  };
}

/** A fan of bracket connectors, for an article about draws. */
function drawLines({ surface }) {
  const LW = 0.0035;
  const segs = [];
  for (let i = 0; i < 8; i += 1) {
    const y = (i + 0.5) / 8;
    const mid = 0.5 + (y - 0.5) * 0.45;
    segs.push([0.1, y, 0.42, y], [0.42, y, 0.42, mid], [0.42, mid, 0.7, mid]);
  }
  return (u, v) => {
    let d = Infinity;
    for (const [x1, y1, x2, y2] of segs) d = Math.min(d, distToSeg(u, v, x1, y1, x2, y2));
    const win = distToSeg(u, v, 0.7, 0.5, 0.9, 0.5);
    const col = mix(mix(C.line, surface, 0.45), surface, Math.min(1, Math.max(0, d / LW - 0.5)));
    return mix(C.optic, col, Math.min(1, Math.max(0, win / (LW * 2) - 0.5)));
  };
}

const IMAGES = [
  // Update covers — wide.
  { name: 'cover-finals.png', w: 1280, h: 720, shade: courtFromAbove({ surface: C.clay700, rot: -6, aspect: 1.78 }) },
  { name: 'cover-entries-open.png', w: 1280, h: 720, shade: baselineCorner({ surface: C.clay500, ball: true }) },
  { name: 'cover-draws-posted.png', w: 1280, h: 720, shade: drawLines({ surface: C.clay700 }) },
  // Gallery — mixed orientation; the grid is more convincing uneven.
  { name: 'gallery-court-1.png', w: 1000, h: 750, shade: courtFromAbove({ surface: C.clay500, rot: 11, aspect: 1.33 }) },
  { name: 'gallery-court-2.png', w: 750, h: 1000, shade: courtFromAbove({ surface: C.clay700, rot: -14, ball: false, aspect: 0.75 }) },
  { name: 'gallery-court-3.png', w: 1000, h: 750, shade: courtFromAbove({ surface: C.hard500, rot: 4, ball: false, aspect: 1.33 }) },
  { name: 'gallery-baseline-2.png', w: 750, h: 1000, shade: baselineCorner({ surface: C.clay500 }) },
  { name: 'gallery-baseline.png', w: 1000, h: 750, shade: baselineCorner({ surface: C.hard600 }) },
  { name: 'gallery-surface.png', w: 900, h: 900, shade: baselineCorner({ surface: C.clay700, ball: true }) },
];

await mkdir(OUT, { recursive: true });
for (const { name, w, h, shade } of IMAGES) {
  const png = encodePng(w, h, render(w, h, shade));
  await writeFile(join(OUT, name), png);
  console.log(`${name.padEnd(26)} ${String(w).padStart(4)}x${String(h).padEnd(4)} ${(png.length / 1024).toFixed(0)} KB`);
}
console.log(`\n${IMAGES.length} images -> apps/web/public/demo/`);
