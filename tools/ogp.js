/* node tools/ogp.js — OGP画像(1200×630)を生成して ogp.png に出力 */
'use strict';
const sharp = require('sharp');
const path = require('path');

const W = 1200, H = 630;

// サイトと同じトーン
const INK = '#1B2A44', INK2 = '#2A3D5E', PAPER = '#E8F1F8',
      TILE = '#F7FBFF', EDGE = '#C4D9E9', BLUE = '#2F7CC4',
      CYAN = '#74C7E8', BEAK = '#FF8A3D', BEAK_D = '#E96F1F';

// ペンギン(ui.js と同じ造形・viewBox 0 0 100 100)
function penguin() {
  return `
  <ellipse cx="50" cy="93" rx="24" ry="5" fill="rgba(24,42,70,.18)"/>
  <ellipse cx="40" cy="88" rx="9" ry="4.5" fill="${BEAK}"/>
  <ellipse cx="60" cy="88" rx="9" ry="4.5" fill="${BEAK}"/>
  <path d="M50 12 C72 12 80 32 80 56 C80 78 67 90 50 90 C33 90 20 78 20 56 C20 32 28 12 50 12 Z" fill="${INK}"/>
  <path d="M50 30 C64 30 70 44 70 62 C70 78 61 86 50 86 C39 86 30 78 30 62 C30 44 36 30 50 30 Z" fill="${TILE}"/>
  <ellipse cx="17" cy="56" rx="6.5" ry="15" fill="${INK}" transform="rotate(14 17 56)"/>
  <ellipse cx="83" cy="56" rx="6.5" ry="15" fill="${INK}" transform="rotate(-14 83 56)"/>
  <circle cx="40" cy="34" r="5.5" fill="#fff"/><circle cx="60" cy="34" r="5.5" fill="#fff"/>
  <circle cx="41.5" cy="35" r="2.6" fill="#10182B"/><circle cx="58.5" cy="35" r="2.6" fill="#10182B"/>
  <circle cx="43" cy="33.5" r="0.9" fill="#fff"/><circle cx="60" cy="33.5" r="0.9" fill="#fff"/>
  <circle cx="31" cy="43" r="3.6" fill="#FFB3A0" opacity=".75"/><circle cx="69" cy="43" r="3.6" fill="#FFB3A0" opacity=".75"/>
  <path d="M44 42 L56 42 L50 51 Z" fill="${BEAK}"/>
  <path d="M44 42 L56 42 L50 45.5 Z" fill="${BEAK_D}"/>`;
}

function goalFlag() {
  return `
  <circle cx="50" cy="60" r="30" fill="none" stroke="${BEAK}" stroke-width="5" stroke-dasharray="10 9" opacity=".85"/>
  <ellipse cx="50" cy="84" rx="16" ry="4.5" fill="rgba(24,42,70,.18)"/>
  <rect x="47" y="20" width="6" height="64" rx="3" fill="${INK}"/>
  <path d="M53 22 L86 32 L53 44 Z" fill="${BEAK}"/>
  <path d="M53 22 L86 32 L53 33 Z" fill="#FFB37A"/>`;
}

function rock() {
  return `
  <ellipse cx="50" cy="86" rx="36" ry="8" fill="rgba(24,42,70,.16)"/>
  <path d="M16 80 L11 50 L30 26 L54 18 L80 30 L90 58 L81 80 Z" fill="#67788E"/>
  <path d="M30 26 L54 18 L80 30 L63 40 L38 38 Z" fill="#8A9BB0"/>
  <path d="M33 25 L54 18 L77 28 L62 35 L41 34 Z" fill="#F2F7FB"/>
  <path d="M11 50 L30 26 L38 38 L24 58 Z" fill="#576A82" opacity=".8"/>`;
}

// 右側のミニ盤面: 5x3 の氷タイル
function miniBoard(x, y, cs) {
  const cols = 5, rows = 3, pad = 14, r = 26;
  const bw = cols * cs + pad * 2, bh = rows * cs + pad * 2;
  let tiles = '';
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const sheen = (cx * 7 + cy * 3) % 4;
      const fills = ['url(#iceA)', 'url(#iceB)', 'url(#iceA)', 'url(#iceB)'];
      tiles += `<rect x="${pad + cx * cs + 4}" y="${pad + cy * cs + 4}" width="${cs - 8}" height="${cs - 8}" rx="10" fill="${fills[sheen]}"/>`;
    }
  }
  const c = (cx, cy) => `translate(${pad + cx * cs}, ${pad + cy * cs}) scale(${cs / 100})`;
  return `
  <g transform="translate(${x}, ${y})">
    <rect x="0" y="0" width="${bw}" height="${bh}" rx="${r}" fill="url(#frameG)"/>
    <rect x="${pad - 4}" y="${pad - 4}" width="${bw - pad * 2 + 8}" height="${bh - pad * 2 + 8}" rx="14" fill="${EDGE}"/>
    ${tiles}
    <!-- 岩(右上) -->
    <g transform="${c(4, 0)}">${rock()}</g>
    <!-- ゴール(右・中段) -->
    <g transform="${c(4, 1)}">${goalFlag()}</g>
    <!-- 滑走ライン -->
    <path d="M ${pad + 0.7 * cs} ${pad + 1.62 * cs} H ${pad + 3.1 * cs}" stroke="${CYAN}" stroke-width="10" stroke-linecap="round" stroke-dasharray="26 20" opacity=".75"/>
    <!-- 雪しぶき -->
    <circle cx="${pad + 1.0 * cs}" cy="${pad + 1.30 * cs}" r="9" fill="#fff" opacity=".95"/>
    <circle cx="${pad + 0.78 * cs}" cy="${pad + 1.52 * cs}" r="6" fill="#fff" opacity=".8"/>
    <circle cx="${pad + 1.18 * cs}" cy="${pad + 1.78 * cs}" r="5" fill="#fff" opacity=".7"/>
    <!-- ペンギン(中段を右へ滑走中) -->
    <g transform="${c(1.95, 0.88)} scale(1.22) rotate(7 50 50)">${penguin()}</g>
  </g>`;
}

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="frameG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK2}"/><stop offset="1" stop-color="${INK}"/>
    </linearGradient>
    <linearGradient id="iceA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FDFEFF"/><stop offset=".55" stop-color="${TILE}"/><stop offset="1" stop-color="#EAF4FC"/>
    </linearGradient>
    <linearGradient id="iceB" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#F3F9FE"/><stop offset="1" stop-color="#E6F1FA"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy="-.1" r="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset=".6" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- 背景 -->
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <g opacity=".5">
    ${Array.from({ length: 16 }, (_, i) =>
      `<rect x="${-300 + i * 120}" y="-100" width="56" height="${H + 200}" fill="${BLUE}" opacity=".045" transform="rotate(25 ${-300 + i * 120} 0)"/>`
    ).join('')}
  </g>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <!-- 雪の粒 -->
  <circle cx="120" cy="120" r="5" fill="#fff"/><circle cx="1050" cy="90" r="4" fill="#fff"/>
  <circle cx="930" cy="540" r="5" fill="#fff"/><circle cx="220" cy="520" r="4" fill="#fff"/>
  <circle cx="650" cy="70" r="3.5" fill="#fff"/>

  <!-- 濃紺の額縁 -->
  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="34" fill="none" stroke="${INK}" stroke-width="10"/>
  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="34" fill="none" stroke="#ffffff" stroke-width="2" opacity=".5" transform="translate(0,3)"/>

  <!-- 左: タイトルブロック -->
  <g transform="translate(86, 0)">
    <text x="6" y="150" font-family="MPLUSRounded1c" font-weight="900" font-size="30" letter-spacing="10" fill="${BLUE}">氷上スライドパズル挑戦状</text>

    <!-- タイトル(シアンの落ち影 → 紺) -->
    <g transform="skewX(-6)">
      <text x="34" y="296" font-family="MPLUSRounded1c" font-weight="900" font-size="136" letter-spacing="4" fill="${CYAN}" opacity=".85">ツルリン</text>
      <text x="28" y="290" font-family="MPLUSRounded1c" font-weight="900" font-size="136" letter-spacing="4" fill="${INK}">ツルリン</text>
    </g>
    <rect x="30" y="322" width="520" height="10" rx="5" fill="${BEAK}"/>

    <text x="8" y="398" font-family="MPLUSRounded1c" font-weight="900" font-size="34" fill="${INK2}">壁にぶつかるまで、止まれない。</text>

    <!-- 特徴チップ -->
    <g font-family="MPLUSRounded1c" font-weight="900" font-size="26" fill="#fff">
      <rect x="6" y="452" width="176" height="56" rx="28" fill="${INK}"/>
      <text x="94" y="490" text-anchor="middle">毎日1問</text>
      <rect x="198" y="452" width="226" height="56" rx="28" fill="${INK}"/>
      <text x="311" y="490" text-anchor="middle">50ステージ</text>
      <rect x="440" y="452" width="252" height="56" rx="28" fill="${BEAK_D}"/>
      <text x="566" y="490" text-anchor="middle">URLで挑戦状</text>
    </g>
  </g>

  <!-- 右: ミニ盤面 -->
  ${miniBoard(742, 150, 72)}
</svg>`;

const out = path.join(__dirname, '..', 'ogp.png');
sharp(Buffer.from(svg), { density: 96 })
  .resize(W, H)
  .png({ compressionLevel: 9 })
  .toFile(out)
  .then(() => console.log('OK ' + out))
  .catch((e) => { console.error(e); process.exit(1); });
