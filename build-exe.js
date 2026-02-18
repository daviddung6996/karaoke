/**
 * Build script: Creates a portable karaoke folder with everything needed.
 * 
 * Usage: node build-exe.js
 * Output: ./karaoke-portable/ (copy this folder anywhere and run start.bat)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'karaoke-portable');

console.log('🔨 Step 1: Building frontend...');
execSync('npm run build', { stdio: 'inherit', cwd: __dirname });

console.log('📦 Step 2: Creating portable package...');

// Clean dist/ and node_modules/ only — preserve server.js and scripts
fs.mkdirSync(OUT, { recursive: true });
const distOut = path.join(OUT, 'dist');
if (fs.existsSync(distOut)) fs.rmSync(distOut, { recursive: true });
const nmOut = path.join(OUT, 'node_modules');
if (fs.existsSync(nmOut)) fs.rmSync(nmOut, { recursive: true });

// Copy fresh dist/
copyDir(path.join(__dirname, 'dist'), distOut);

// server.js is maintained directly in karaoke-portable/ — no copy needed

// Create minimal package.json for the portable version
const pkg = {
  name: 'karaoke-portable',
  version: '3.0.0',
  type: 'module',
  dependencies: {
    'youtubei.js': '^16.0.1',
  },
};
fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify(pkg, null, 2));

// Install only production deps
console.log('📥 Step 3: Installing production dependencies...');
execSync('npm install --omit=dev', { stdio: 'inherit', cwd: OUT });

// Create start.bat
fs.writeFileSync(path.join(OUT, 'start.bat'),
  `@echo off\r\ntitle Karaoke Server\r\necho.\r\necho   Starting Karaoke Server...\r\necho   Browser will open at http://localhost:5173\r\necho.\r\ntimeout /t 2 /nobreak >nul\r\nstart http://localhost:5173\r\nnode server.js\r\npause\r\n`
);

// Create start.sh for Linux/Mac
fs.writeFileSync(path.join(OUT, 'start.sh'),
  `#!/bin/bash\necho "Starting Karaoke Server..."\necho "Open http://localhost:5173 in your browser"\nsleep 1\nnode server.js\n`
);

console.log('\n✅ Done! Portable package created at:');
console.log(`   ${OUT}`);
console.log('\n📂 To use:');
console.log('   1. Copy the "karaoke-portable" folder to any computer with Node.js');
console.log('   2. Double-click start.bat (Windows) or run ./start.sh (Mac/Linux)');
console.log(`\n📊 Size: ${getFolderSize(OUT)} MB`);

// ── Helpers ──
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function getFolderSize(dir) {
  let size = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) size += parseFloat(getFolderSize(p));
    else size += fs.statSync(p).size;
  }
  return (size / 1024 / 1024).toFixed(1);
}
