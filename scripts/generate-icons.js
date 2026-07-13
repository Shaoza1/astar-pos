const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '../frontend/public');

function solidPng(width, height, hex) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, width, height);
  return canvas.toBuffer('image/png');
}

// Icons
fs.writeFileSync(path.join(PUBLIC, 'icons/icon-192.png'), solidPng(192, 192, '#1f3d3d'));
fs.writeFileSync(path.join(PUBLIC, 'icons/icon-512.png'), solidPng(512, 512, '#1f3d3d'));

// Screenshots — desktop 1280×800, mobile 390×844
fs.writeFileSync(path.join(PUBLIC, 'screenshots/desktop.png'), solidPng(1280, 800, '#1f3d3d'));
fs.writeFileSync(path.join(PUBLIC, 'screenshots/mobile.png'), solidPng(390, 844, '#1f3d3d'));

console.log('Icons and screenshots generated.');
