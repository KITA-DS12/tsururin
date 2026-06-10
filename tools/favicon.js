/* node tools/favicon.js — favicon.svg から各サイズのラスタ画像を生成
 *  - apple-touch-icon.png (180x180): iOS ホーム画面
 *  - favicon-192.png (192x192): PWA / Android ホーム画面
 *  - favicon.ico は省略 (modern browser は <link rel="icon" type="image/svg+xml"> を解釈する)
 */
'use strict';
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svgBuf = fs.readFileSync(path.join(root, 'favicon.svg'));

async function gen(size, outName) {
  const out = path.join(root, outName);
  await sharp(svgBuf, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('OK ' + outName + ' (' + size + 'x' + size + ')');
}

(async () => {
  await gen(180, 'apple-touch-icon.png');
  await gen(192, 'favicon-192.png');
})().catch((e) => { console.error(e); process.exit(1); });
