#!/usr/bin/env node
/**
 * Automated detector for "vibe-coded" design tells.
 *
 * Two passes:
 *
 *   STATIC  — greps the CSS/TSX for signatures that are cheap to spot and
 *             have no false positives worth tolerating. Always runs.
 *   LIVE    — measures the RENDERED page. Some tells (how much of the page
 *             actually shouts in uppercase, whether anything overflows on a
 *             phone) cannot be seen in the source at all, because they are
 *             emergent properties of the whole page rather than properties
 *             of any one rule. Runs only if a server answers.
 *
 * Exit code is the number of failures, so this can gate a commit.
 *
 *   node .claude/skills/design-review/audit.mjs [baseUrl]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const BASE = process.argv[2] ?? 'http://localhost:3000';
const WEB = join(ROOT, 'apps/web');

const findings = [];
const pass = [];
const fail = (rule, detail, where) => findings.push({ rule, detail, where });
const ok = (rule, detail) => pass.push(`${rule} — ${detail}`);

/* ------------------------------------------------------------------ */
/* File walking                                                        */
/* ------------------------------------------------------------------ */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(css|tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(WEB).map((f) => ({ path: f, rel: relative(ROOT, f), text: readFileSync(f, 'utf8') }));
const css = files.filter((f) => f.rel.endsWith('.css'));

function scan(label, regex, detail, exclude = () => false) {
  const hits = [];
  for (const f of files) {
    if (exclude(f)) continue;
    const lines = f.text.split('\n');
    lines.forEach((line, i) => {
      if (regex.test(line)) hits.push(`${f.rel}:${i + 1}`);
    });
  }
  if (hits.length) fail(label, `${detail} (${hits.length})`, hits.slice(0, 6));
  else ok(label, 'clean');
  return hits;
}

/* ------------------------------------------------------------------ */
/* STATIC                                                              */
/* ------------------------------------------------------------------ */

console.log('\n\x1b[1mSTATIC\x1b[0m');

/*
 * The single most-cited tell. A 3-4px accent stripe down the left of a card
 * is to AI design what an em-dash is to AI prose. Neutral hairlines and the
 * card's own surface are the alternative.
 */
{
  // 3-4px is the documented pattern. A 2px edge used as a STATE marker in a
  // dense grid is a different thing, and widening the range to catch those
  // made the check fire on legitimate indicators. A detector that cries wolf
  // gets switched off, so judgement handles those (see section 3).
  // Selector-aware, not line-by-line: a left rule on a BLOCKQUOTE is a
  // centuries-old typographic convention and not what the pattern is about.
  // The tell is a card wearing an accent stripe it has not earned.
  const hits = [];
  for (const f of css) {
    for (const m of f.text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selector = m[1].trim().split('\n').pop().trim();
      if (/blockquote|\bq\b/.test(selector)) continue;
      if (/border-(left|top):\s*[34]px\s+solid\s+var\(--(?!line-|ink-)/.test(m[2])) {
        hits.push(`${f.rel}  ${selector}`);
      }
    }
  }
  if (hits.length)
    fail('accent-edge-card', `coloured 3-4px card edge — the most reliable vibe-coded tell (${hits.length})`, hits.slice(0, 6));
  else ok('accent-edge-card', 'no accent stripes on cards');
}

scan('gradients', /(linear|radial|conic)-gradient\(/, 'gradient used as decoration', (f) =>
  // The reduced-capability fallback is allowed one wash; it stands in for a
  // scene that is not being rendered at all.
  f.rel.endsWith('ball-scene.module.css'),
);

scan('glassmorphism', /backdrop-filter:\s*blur/, 'frosted-glass panel');
scan('coloured-shadow', /box-shadow:[^;]*(rgb\((?!\s*\d+\s+\d+\s+\d+\s*\/)|#[0-9a-f]{3,6})/i, 'tinted glow shadow');
scan('vibecode-purple', /#(8b5cf6|a855f7|7c3aed|6366f1)|rebeccapurple|\bviolet\b/i, 'lavender-purple accent');
scan('dark-mode-default', /prefers-color-scheme:\s*dark/, 'dark theme (keep it a deliberate choice, not a default)');
scan('emoji-as-icon', /content:\s*["'][\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'emoji used as an icon');

/*
 * Not from the vibe-coded literature — from this codebase. An undefined
 * custom property makes the WHOLE declaration invalid at computed-value
 * time, silently. `padding: 0 var(--space-5)` became `padding: 0` and a
 * button shipped with no horizontal padding for weeks. Nothing warns.
 */
const defined = new Set();
for (const f of css) for (const m of f.text.matchAll(/^\s*(--[\w-]+):/gm)) defined.add(m[1]);
const undef = [];
for (const f of css) {
  f.text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/var\((--[\w-]+)/g)) {
      if (!defined.has(m[1]) && !m[1].startsWith('--font-')) undef.push(`${f.rel}:${i + 1} ${m[1]}`);
    }
  });
}
if (undef.length) fail('undefined-token', `var() referencing a token that does not exist — the whole declaration is silently dropped (${undef.length})`, undef.slice(0, 8));
else ok('undefined-token', 'every var() resolves');

/* ------------------------------------------------------------------ */
/* LIVE                                                                */
/* ------------------------------------------------------------------ */

const PAGES = process.env['AUDIT_PAGES']?.split(',') ?? ['/', '/updates', '/media'];
const LIMITS = { uppercase: 15, fontSizes: 10, radii: 2 };

let reachable = true;
try {
  await fetch(BASE, { signal: AbortSignal.timeout(3000) });
} catch {
  reachable = false;
}

if (!reachable) {
  console.log(`\n\x1b[2mLIVE   skipped — nothing answering at ${BASE}\x1b[0m`);
} else {
  console.log('\n\x1b[1mLIVE\x1b[0m');
  const { chromium } = await import(join(WEB, 'node_modules/playwright/index.mjs')).catch(() =>
    import('playwright'),
  );
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const m = await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0;
      };
      let upper = 0;
      let total = 0;
      const sizes = new Set();
      const radii = new Set();
      for (const el of document.querySelectorAll('body *')) {
        if (!visible(el)) continue;
        const s = getComputedStyle(el);
        sizes.add(s.fontSize);
        if (s.borderTopLeftRadius !== '0px') radii.add(s.borderTopLeftRadius);
        const own = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join('')
          .trim();
        if (own) {
          total += own.length;
          if (s.textTransform === 'uppercase') upper += own.length;
        }
      }
      return {
        uppercase: Math.round((100 * upper) / Math.max(total, 1)),
        fontSizes: sizes.size,
        radii: radii.size,
      };
    });

    const over = [];
    if (m.uppercase > LIMITS.uppercase) over.push(`${m.uppercase}% uppercase (max ${LIMITS.uppercase})`);
    if (m.fontSizes > LIMITS.fontSizes) over.push(`${m.fontSizes} font sizes (max ${LIMITS.fontSizes})`);
    if (m.radii > LIMITS.radii) over.push(`${m.radii} radii (max ${LIMITS.radii})`);

    // Horizontal overflow is the classic "AI was never prompted for this
    // width" failure, and it only exists at render time.
    for (const w of [390, 768]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(250);
      const spill = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (spill > 1) over.push(`${spill}px horizontal overflow at ${w}px`);
    }
    await page.setViewportSize({ width: 1440, height: 950 });

    if (over.length) fail('page-metrics', over.join('; '), [path]);
    else ok('page-metrics', `${path} — ${m.uppercase}% caps, ${m.fontSizes} sizes, ${m.radii} radii, no overflow`);
  }
  await browser.close();
}

/* ------------------------------------------------------------------ */

console.log('');
for (const p of pass) console.log(`  \x1b[32m✓\x1b[0m ${p}`);
for (const f of findings) {
  console.log(`  \x1b[31m✗\x1b[0m \x1b[1m${f.rule}\x1b[0m — ${f.detail}`);
  for (const w of f.where) console.log(`      ${w}`);
}
console.log(
  findings.length
    ? `\n\x1b[31m${findings.length} finding(s)\x1b[0m\n`
    : '\n\x1b[32mclean\x1b[0m\n',
);
process.exit(findings.length);
