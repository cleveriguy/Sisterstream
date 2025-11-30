const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const ICON_B64_PATH = join(__dirname, '..', 'icons', 'icon.b64');
const ICON_OUTPUT = join(__dirname, '..', 'icons', 'icon.ico');

function ensureIcon() {
  if (existsSync(ICON_OUTPUT)) return;
  const base64 = readFileSync(ICON_B64_PATH, 'utf8').replace(/\s+/g, '');
  const buffer = Buffer.from(base64, 'base64');
  writeFileSync(ICON_OUTPUT, buffer);
  // keep icon ignored from git if needed; only generated for packaging
}

ensureIcon();
