/**
 * Builds the Max for Live device into m4l/device/:
 *   soundfunc.js     — the device's script for [v8] (engine + host, one file)
 *   SoundFunc.maxpat — the patch, generated
 *   ui/              — the editor (the SoundFunc app, sound off, following Live)
 */
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
mkdirSync('m4l/device', { recursive: true });

// 1. the device script: one plain file Max's [v8] can load
run('npx rolldown m4l/max-entry.ts --format iife --file m4l/device/soundfunc.js --platform neutral --minify false');

// 2. the patch (generated from code, so the kit menu matches the kits)
mkdirSync('node_modules/.cache/soundfunc', { recursive: true });
run('npx rolldown m4l/make-patch.ts --format esm --file node_modules/.cache/soundfunc/make-patch.mjs --platform node');
run('node node_modules/.cache/soundfunc/make-patch.mjs');

// 3. the editor: relative paths, so it loads from the device's own folder
rmSync('m4l/device/ui', { recursive: true, force: true });
execSync('npx vite build --base ./ --outDir m4l/device/ui --emptyOutDir', { stdio: 'inherit', env: { ...process.env, SOUNDFUNC_TARGET: 'm4l' } });
console.log('\nBuilt the device in m4l/device — see m4l/README.md to load it in Live.');
