#!/usr/bin/env node
// Overwrite Vite's dist/index.html with our static landing page copied to web/public/index.html
// so Netlify serves the intended homepage while keeping other Vite assets.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

async function main() {
  const src = path.join(process.cwd(), 'web', 'public', 'index.html');
  const dst = path.join(process.cwd(), 'web', 'dist', 'index.html');
  if (fs.existsSync(src) && fs.existsSync(path.dirname(dst))) {
    await fsp.copyFile(src, dst);
    console.log('[postbuild-static] homepage overridden with public/index.html');
  } else {
    console.log('[postbuild-static] nothing to override');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

