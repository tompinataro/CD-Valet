import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outRoot = join(root, 'control/store-metadata/cd-valet/app-store-connect/screenshots');
const tmpRoot = join(outRoot, '.tmp-svg');

const colors = {
  bg: '#0b0b0f',
  panel: '#12121a',
  panel2: '#171722',
  border: '#242431',
  border2: '#2d2d3e',
  gold: '#f7e7b1',
  gold2: '#d9c98f',
  white: '#ffffff',
  text: '#c9c9d1',
  muted: '#9a9ab0',
  wine: '#5f162d',
  wine2: '#7a2140',
  green: '#193323',
  amber: '#3c271a',
  red: '#7e2630',
};

const sizes = [
  { key: 'iphone-6.9', label: 'iPhone 6.9 Display', width: 1320, height: 2868, tablet: false },
  { key: 'ipad-13', label: 'iPad 13 Display', width: 2064, height: 2752, tablet: true },
];

const font = "Helvetica, Arial, sans-serif";

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function text(x, y, content, size, fill = colors.white, weight = 600, extra = '') {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${font}" font-size="${size}" font-weight="${weight}" ${extra}>${esc(content)}</text>`;
}

function rect(x, y, w, h, fill, radius = 0, stroke = 'none', sw = 0) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function line(x1, y1, x2, y2, stroke = colors.border2, sw = 2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

function wrapWords(content, maxChars) {
  const words = content.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textBlock(x, y, content, size, maxChars, lineHeight, fill = colors.text, weight = 500) {
  return wrapWords(content, maxChars)
    .map((part, index) => text(x, y + index * lineHeight, part, size, fill, weight))
    .join('');
}

function button(x, y, w, h, label, primary = false) {
  return [
    rect(x, y, w, h, primary ? colors.wine : colors.panel2, 28, primary ? colors.wine : colors.border2, 2),
    text(x + w / 2, y + h / 2 + 10, label, 34, colors.white, 800, 'text-anchor="middle"'),
  ].join('');
}

function pill(x, y, label, active = false, warn = false) {
  const width = Math.max(126, label.length * 18 + 42);
  return [
    rect(x, y, width, 54, warn ? colors.amber : active ? '#2b2032' : colors.panel2, 27, active ? colors.gold : colors.border2, 2),
    text(x + width / 2, y + 35, label, 24, active ? colors.gold : colors.white, 800, 'text-anchor="middle"'),
  ].join('');
}

function chrome({ width, height, title, tablet }) {
  const pad = tablet ? 86 : 46;
  const top = tablet ? 68 : 64;
  const headerH = tablet ? 120 : 128;
  const tabH = tablet ? 118 : 142;
  return {
    pad,
    top,
    headerH,
    tabH,
    bodyTop: top + headerH,
    bodyBottom: height - tabH,
    svg: [
      rect(0, 0, width, height, colors.bg),
      text(pad, top - 12, '9:41', tablet ? 30 : 28, colors.white, 800),
      rect(width - pad - 132, top - 43, 40, 20, colors.white, 10),
      rect(width - pad - 82, top - 43, 62, 20, colors.white, 10),
      rect(width - pad - 12, top - 46, 10, 26, colors.white, 5),
      text(pad, top + 74, title, tablet ? 54 : 46, colors.white, 800),
      rect(width - pad - 314, top + 28, 314, 64, colors.bg, 24, colors.border2, 2),
      text(width - pad - 157, top + 69, 'Optional Profile', tablet ? 25 : 23, colors.white, 700, 'text-anchor="middle"'),
      line(0, height - tabH, width, height - tabH, colors.border, 2),
      rect(0, height - tabH, width, tabH, colors.panel),
      text(width * 0.33, height - tabH + 72, 'Scan', tablet ? 32 : 28, colors.muted, 700, 'text-anchor="middle"'),
      text(width * 0.66, height - tabH + 72, 'Library', tablet ? 32 : 28, colors.gold, 800, 'text-anchor="middle"'),
    ].join(''),
  };
}

function card(x, y, w, h) {
  return rect(x, y, w, h, colors.panel, 30, colors.border, 2);
}

function albumCard(x, y, w, album, artist, meta, status, note = '', warn = false) {
  return [
    card(x, y, w, note ? 310 : 270),
    pill(x + 28, y + 28, 'CD', true),
    pill(x + 172, y + 28, status, false, warn),
    text(x + w - 28, y + 62, 'last scanned: today', 24, colors.muted, 600, 'text-anchor="end"'),
    text(x + 28, y + 138, album, 42, colors.white, 800),
    text(x + 28, y + 188, artist, 32, colors.text, 600),
    meta ? text(x + 28, y + 232, meta, 27, colors.gold2, 800) : '',
    note ? text(x + 28, y + 280, note, 27, colors.text, 500) : '',
  ].join('');
}

function home(size) {
  const { width, height, tablet } = size;
  const c = chrome({ width, height, title: 'CD Valet', tablet });
  const max = tablet ? 1130 : width - c.pad * 2;
  const x = c.pad;
  const y = c.bodyTop + (tablet ? 78 : 52);
  return [
    c.svg,
    text(x, y, 'CD VALET', 28, colors.gold, 800),
    text(x, y + 96, 'Your library starts here', tablet ? 78 : 72, colors.white, 800),
    textBlock(x, y + 168, 'CD Valet opens immediately on a clean install so any collector can start building a personal CD library, even without a network connection.', tablet ? 34 : 32, tablet ? 68 : 48, tablet ? 50 : 46),
    card(x, y + (tablet ? 360 : 392), max, tablet ? 720 : 780),
    text(x + 44, y + (tablet ? 448 : 486), 'Ready to start', 40, colors.white, 800),
    text(x + 44, y + (tablet ? 510 : 554), 'Local startup finished.', 32, colors.text, 600),
    text(x + 44, y + (tablet ? 622 : 684), 'Scan your first CD', 56, colors.white, 800),
    textBlock(x + 44, y + (tablet ? 694 : 758), 'No account or invitation is required. Open the scanner and start building your personal music collection right away.', 32, tablet ? 62 : 43, 46),
    button(x + 44, y + (tablet ? 884 : 976), max - 88, 92, 'Scan your CDs now', true),
    button(x + 44, y + (tablet ? 1000 : 1100), max - 88, 92, 'Open library', false),
    text(x + max / 2, y + (tablet ? 1160 : 1262), 'Save an optional local profile', 30, colors.gold, 800, 'text-anchor="middle"'),
  ].join('');
}

function library(size) {
  const { width, tablet } = size;
  const c = chrome({ ...size, title: 'Library' });
  const x = c.pad;
  const y = c.bodyTop + 38;
  const contentW = width - c.pad * 2;
  const cardW = tablet ? (contentW - 34) / 2 : contentW;
  return [
    c.svg,
    text(x, y + 28, 'CD Library', tablet ? 52 : 46, colors.white, 800),
    text(x, y + 82, '42 saved', 28, colors.muted, 600),
    button(width - c.pad - 230, y, 230, 72, 'Add CD', true),
    button(width - c.pad - 474, y, 220, 72, 'Refresh', false),
    textBlock(x, y + 154, 'Scan a UPC to auto-fill album data, then tap any row to refine the details.', 31, tablet ? 84 : 52, 44),
    rect(x, y + 256, contentW, 82, colors.panel2, 22, colors.border2, 2),
    text(x + 32, y + 309, 'Search albums, artists, labels, or UPCs', 29, colors.muted, 600),
    pill(x, y + 376, 'Recent', true),
    pill(x + 160, y + 376, 'Artist'),
    pill(x + 312, y + 376, 'Album'),
    pill(x + 468, y + 376, 'Needs details'),
    albumCard(x, y + 474, cardW, 'A Love Supreme', 'John Coltrane', '1965 · Impulse! · 4 tracks', 'Manual', 'Shelf A · near jazz box sets'),
    albumCard(tablet ? x + cardW + 34 : x, y + (tablet ? 474 : 814), cardW, 'Blue Train', 'John Coltrane', '1957 · Blue Note · 5 tracks', 'Found'),
    albumCard(x, y + (tablet ? 818 : 1108), cardW, 'Kind of Blue', 'Miles Davis', '1959 · Columbia · 5 tracks', 'Found'),
    albumCard(tablet ? x + cardW + 34 : x, y + (tablet ? 818 : 1402), cardW, 'Unidentified CD', 'Tap to add artist', '', 'Needs details', '', true),
  ].join('');
}

function scan(size) {
  const { width, height, tablet } = size;
  const pad = tablet ? 90 : 44;
  const frameW = width - pad * 2;
  const frameH = tablet ? 530 : 500;
  const frameY = tablet ? 730 : 760;
  return [
    rect(0, 0, width, height, colors.bg),
    `<defs><linearGradient id="scanGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#242431"/><stop offset="0.52" stop-color="#111119"/><stop offset="1" stop-color="#3b1024"/></linearGradient></defs>`,
    rect(0, 0, width, height, 'url(#scanGrad)'),
    text(pad, 104, 'Scan CDs · In library: 42', tablet ? 44 : 38, colors.white, 800),
    button(width - pad - 180, 62, 180, 70, 'Done', false),
    button(width - pad - 385, 62, 178, 70, 'Reset', false),
    rect(pad, frameY, frameW, frameH, 'rgba(0,0,0,0.08)', 38, 'rgba(255,255,255,0.82)', 6),
    line(pad + 80, frameY + frameH / 2, width - pad - 80, frameY + frameH / 2, colors.gold, 5),
    ...Array.from({ length: 36 }, (_, i) => {
      const bw = i % 5 === 0 ? 14 : i % 3 === 0 ? 9 : 5;
      const bx = pad + 190 + i * ((frameW - 380) / 36);
      return rect(bx, frameY + frameH / 2 - 105, bw, 210, colors.white, 0);
    }),
    rect(width / 2 - 410, frameY + frameH + 178, 820, 92, 'rgba(24,180,90,0.86)', 30),
    text(width / 2, frameY + frameH + 237, 'Found: Blue Train · John Coltrane', tablet ? 34 : 30, colors.white, 800, 'text-anchor="middle"'),
    text(width / 2, height - 210, 'Aim the UPC inside the box to add albums to your library. Duplicates are ignored.', tablet ? 34 : 28, colors.white, 700, 'text-anchor="middle"'),
  ].join('');
}

function edit(size) {
  const { width, tablet } = size;
  const c = chrome({ ...size, title: 'Library' });
  const x = c.pad;
  const y = c.bodyTop + 42;
  const w = width - c.pad * 2;
  const inputH = tablet ? 84 : 78;
  function input(label, value, iy, iw = w) {
    return [
      text(x, iy, label.toUpperCase(), 24, colors.muted, 800),
      rect(x, iy + 22, iw, inputH, colors.panel2, 20, colors.border2, 2),
      text(x + 30, iy + 22 + inputH / 2 + 11, value, 30, colors.white, 600),
    ].join('');
  }
  return [
    c.svg,
    text(x, y, 'CD DETAILS', 26, colors.gold, 800),
    text(x, y + 78, 'UPC 602537534646', tablet ? 48 : 42, colors.white, 800),
    button(x, y + 126, (w - 24) / 2, 82, 'Save CD', true),
    button(x + (w + 24) / 2, y + 126, (w - 24) / 2, 82, 'Cancel', false),
    input('Album', 'Blue Train', y + 286),
    input('Artist', 'John Coltrane', y + 440),
    text(x, y + 602, 'FORMAT', 24, colors.muted, 800),
    pill(x, y + 630, 'CD', true),
    pill(x + 144, y + 630, 'Box Set'),
    pill(x + 346, y + 630, 'Single'),
    input('Release Year', '1957', y + 750),
    input('Label', 'Blue Note', y + 904),
    input('Catalog #', 'BLP 1577', y + 1058, (w - 28) / 2),
    [
      text(x + (w + 28) / 2, y + 1058, 'TRACKS', 24, colors.muted, 800),
      rect(x + (w + 28) / 2, y + 1080, (w - 28) / 2, inputH, colors.panel2, 20, colors.border2, 2),
      text(x + (w + 28) / 2 + 30, y + 1080 + inputH / 2 + 11, '5', 30, colors.white, 600),
    ].join(''),
    input('Notes', 'Original CD issue · shelf A', y + 1212),
  ].join('');
}

function search(size) {
  const { width, tablet } = size;
  const c = chrome({ ...size, title: 'Library' });
  const x = c.pad;
  const y = c.bodyTop + 40;
  const contentW = width - c.pad * 2;
  const cardW = tablet ? (contentW - 34) / 2 : contentW;
  return [
    c.svg,
    text(x, y + 28, 'CD Library', tablet ? 52 : 46, colors.white, 800),
    text(x, y + 82, '42 saved', 28, colors.muted, 600),
    button(width - c.pad - 230, y, 230, 72, 'Add CD', true),
    rect(x, y + 152, contentW, 82, colors.panel2, 22, colors.border2, 2),
    text(x + 32, y + 205, 'Coltrane', 31, colors.white, 700),
    pill(x, y + 270, 'Recent'),
    pill(x + 160, y + 270, 'Artist', true),
    pill(x + 312, y + 270, 'Album'),
    pill(x + 468, y + 270, 'Needs details'),
    albumCard(x, y + 368, cardW, 'A Love Supreme', 'John Coltrane', '1965 · Impulse! · 4 tracks', 'Manual', 'Smoke test enriched metadata'),
    albumCard(tablet ? x + cardW + 34 : x, y + (tablet ? 368 : 706), cardW, 'Blue Train', 'John Coltrane', '1957 · Blue Note · 5 tracks', 'Found'),
    albumCard(x, y + (tablet ? 714 : 1000), cardW, 'Giant Steps', 'John Coltrane', '1960 · Atlantic · 7 tracks', 'Found'),
    albumCard(tablet ? x + cardW + 34 : x, y + (tablet ? 714 : 1294), cardW, 'My Favorite Things', 'John Coltrane', '1961 · Atlantic · 4 tracks', 'Found'),
  ].join('');
}

const screens = [
  ['01-start-no-login', home],
  ['02-library', library],
  ['03-scan-found', scan],
  ['04-edit-details', edit],
  ['05-search-sort', search],
];

function svgDoc(size, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
${body}
</svg>`;
}

function convertSvgToPng(svgPath, outputPath, width, height) {
  execFileSync('/usr/bin/sips', ['-s', 'format', 'png', svgPath, '--out', outputPath], { stdio: 'ignore' });
  execFileSync('/usr/bin/sips', ['-z', String(height), String(width), outputPath, '--out', outputPath], { stdio: 'ignore' });
}

rmSync(tmpRoot, { recursive: true, force: true });
mkdirSync(tmpRoot, { recursive: true });

for (const size of sizes) {
  const dir = join(outRoot, size.key);
  const sourceDir = join(outRoot, 'sources', size.key);
  mkdirSync(dir, { recursive: true });
  mkdirSync(sourceDir, { recursive: true });
  for (const [name, render] of screens) {
    const svgPath = join(tmpRoot, `${Date.now()}-${Math.random().toString(16).slice(2)}-${size.key}-${name}.svg`);
    const sourcePath = join(sourceDir, `${name}-${size.width}x${size.height}.svg`);
    const pngPath = join(dir, `${name}-${size.width}x${size.height}.png`);
    const svg = svgDoc(size, render(size));
    writeFileSync(svgPath, svg);
    writeFileSync(sourcePath, svg);
    convertSvgToPng(svgPath, pngPath, size.width, size.height);
  }
}

rmSync(tmpRoot, { recursive: true, force: true });
console.log(`Generated ${screens.length * sizes.length} screenshots in ${outRoot}`);
