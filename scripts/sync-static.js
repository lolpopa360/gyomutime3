#!/usr/bin/env node
// Copy root static pages and assets into web/public so Netlify/Vite builds
// a single publish folder (web/dist) suitable for Netlify deploy.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const root = process.cwd();
const srcRoot = root;
const dstRoot = path.join(root, 'web', 'public');

const pages = [
  'index.html',
  'grouping.html',
  'admin.html',
  'support.html',
  'timetable.html',
];

async function copyFile(src, dst) {
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  await fsp.copyFile(src, dst);
}

async function copyDir(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else if (e.isFile()) await copyFile(s, d);
  }
}

async function main() {
  // Copy pages
  for (const p of pages) {
    const src = path.join(srcRoot, p);
    if (fs.existsSync(src)) {
      const dst = path.join(dstRoot, p);
      await copyFile(src, dst);
      // eslint-disable-next-line no-console
      console.log('[sync-static] copied', p);
    }
  }
  // Copy assets
  const assetsSrc = path.join(srcRoot, 'assets');
  const assetsDst = path.join(dstRoot, 'assets');
  if (fs.existsSync(assetsSrc)) {
    await copyDir(assetsSrc, assetsDst);
    console.log('[sync-static] copied assets/');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

