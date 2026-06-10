/* node tools/promo.js — ツイート添付用プロモ画像(1600×900)を promo.png に出力 */
'use strict';
const sharp = require('sharp');
const path = require('path');

const W = 1600, H = 900;
const INK = '#1B2A44', INK2 = '#2A3D5E', INKSOFT = 'rgba(27,42,68,.62)',
      PAPER = '#E8F1F8', TILE = '#F7FBFF', EDGE = '#C4D9E9',
      BLUE = '#2F7CC4', CYAN = '#74C7E8', BEAK = '#FF8A3D', BEAK_D = '#E96F1F',
      STAMP = '#D8404A';
const FONT = 'MPLUSRounded1c';

/* ---- スプライト(ゲーム本体と同じ造形) ---- */
const penguin = () => `
  <ellipse cx="50" cy="93" rx="24" ry="5" fill="rgba(24,42,70,.18)"/>
  <ellipse cx="40" cy="88" rx="9" ry="4.5" fill="${BEAK}"/>
  <ellipse cx="60" cy="88" rx="9" ry="4.5" fill="${BEAK}"/>
  <path d="M50 12 C72 12 80 32 80 56 C80 78 67 90 50 90 C33 90 20 78 20 56 C20 32 28 12 50 12 Z" fill="${INK}"/>
  <path d="M50 30 C64 30 70 44 70 62 C70 78 61 86 50 86 C39 86 30 78 30 62 C30 44 36 30 50 30 Z" fill="${TILE}"/>
  <ellipse cx="17" cy="56" rx="6.5" ry="15" fill="${INK}" transform="rotate(14 17 56)"/>
  <ellipse cx="83" cy="56" rx="6.5" ry="15" fill="${INK}" transform="rotate(-14 83 56)"/>
  <circle cx="40" cy="34" r="5.5" fill="#fff"/><circle cx="60" cy="34" r="5.5" fill="#fff"/>
  <circle cx="41.5" cy="35" r="2.6" fill="#10182B"/><circle cx="58.5" cy="35" r="2.6" fill="#10182B"/>
  <circle cx="31" cy="43" r="3.6" fill="#FFB3A0" opacity=".75"/><circle cx="69" cy="43" r="3.6" fill="#FFB3A0" opacity=".75"/>
  <path d="M44 42 L56 42 L50 51 Z" fill="${BEAK}"/>`;
const rock = () => `
  <ellipse cx="50" cy="86" rx="36" ry="8" fill="rgba(24,42,70,.16)"/>
  <path d="M16 80 L11 50 L30 26 L54 18 L80 30 L90 58 L81 80 Z" fill="#67788E"/>
  <path d="M30 26 L54 18 L80 30 L63 40 L38 38 Z" fill="#8A9BB0"/>
  <path d="M33 25 L54 18 L77 28 L62 35 L41 34 Z" fill="#F2F7FB"/>
  <path d="M11 50 L30 26 L38 38 L24 58 Z" fill="#576A82" opacity=".8"/>`;
const goal = () => `
  <circle cx="50" cy="60" r="30" fill="none" stroke="${BEAK}" stroke-width="5" stroke-dasharray="10 9" opacity=".85"/>
  <rect x="47" y="20" width="6" height="64" rx="3" fill="${INK}"/>
  <path d="M53 22 L86 32 L53 44 Z" fill="${BEAK}"/>
  <path d="M53 22 L86 32 L53 33 Z" fill="#FFB37A"/>`;
const crystal = () => `
  <ellipse cx="50" cy="88" rx="20" ry="5" fill="rgba(24,42,70,.15)"/>
  <path d="M50 10 L80 42 L50 88 L20 42 Z" fill="#5FC6E8"/>
  <path d="M50 10 L80 42 L50 53 Z" fill="#9ADFF5"/>
  <path d="M50 10 L20 42 L50 53 Z" fill="#C9F0FB"/>
  <path d="M20 42 L50 88 L50 53 Z" fill="#3FA8D2"/>
  <path d="M64 20 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#fff"/>`;
const hole = () => `
  <ellipse cx="50" cy="55" rx="34" ry="25" fill="#9FBDD4"/>
  <ellipse cx="50" cy="53.5" rx="29" ry="20.5" fill="#E8F3FB"/>
  <ellipse cx="50" cy="57" rx="29" ry="20.5" fill="#16263D"/>
  <ellipse cx="50" cy="61" rx="21" ry="12" fill="#0C1626"/>`;
const sand = () => `
  <rect x="10" y="12" width="80" height="76" rx="16" fill="#E8CD94"/>
  <rect x="10" y="12" width="80" height="20" rx="10" fill="#F2DFB4"/>
  <circle cx="32" cy="46" r="3" fill="#C9A968"/><circle cx="58" cy="38" r="2.5" fill="#C9A968"/>
  <circle cx="70" cy="60" r="3" fill="#C9A968"/><circle cx="42" cy="68" r="2.5" fill="#C9A968"/>`;
const block = () => `
  <ellipse cx="50" cy="90" rx="28" ry="6" fill="rgba(24,42,70,.16)"/>
  <rect x="16" y="14" width="68" height="68" rx="14" fill="#A8D4EE" opacity=".92"/>
  <rect x="16" y="14" width="68" height="24" rx="12" fill="#D6EDFB"/>
  <rect x="22" y="20" width="14" height="9" rx="4.5" fill="#fff"/>
  <rect x="16" y="14" width="68" height="68" rx="14" fill="none" stroke="#7FB4D6" stroke-width="3"/>`;
const crystalMini = (x, y, s) => `
  <g transform="translate(${x},${y}) scale(${s / 24})">
    <path d="M12 2 L19 10 L12 22 L5 10 Z" fill="#5FC6E8"/>
    <path d="M12 2 L19 10 L12 12 Z" fill="#9ADFF5"/>
    <path d="M12 2 L5 10 L12 12 Z" fill="#C9F0FB"/>
  </g>`;

/* ---- 盤面(6×5)。素通りルートとぴったりルートを図解 ---- */
function demoBoard(x, y, cs) {
  const cols = 6, rows = 5, pad = 18, r = 30;
  const bw = cols * cs + pad * 2, bh = rows * cs + pad * 2;
  let tiles = '';
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const f = (cx * 7 + cy * 3) % 4 < 2 ? 'url(#iceA)' : 'url(#iceB)';
      tiles += `<rect x="${pad + cx * cs + 4}" y="${pad + cy * cs + 4}" width="${cs - 8}" height="${cs - 8}" rx="11" fill="${f}"/>`;
    }
  }
  const g = (cx, cy) => `translate(${pad + cx * cs}, ${pad + cy * cs}) scale(${cs / 100})`;
  const cc = (cx, cy) => [pad + cx * cs + cs / 2, pad + cy * cs + cs / 2]; // セル中心
  const [px, py] = cc(0, 2);
  const wrongEnd = cc(5, 2);
  const p1 = cc(0, 0), p2 = cc(4, 0), p3 = cc(4, 2);

  return `
  <g transform="translate(${x}, ${y})">
    <rect width="${bw}" height="${bh}" rx="${r}" fill="url(#frameG)"/>
    <rect x="${pad - 5}" y="${pad - 5}" width="${bw - pad * 2 + 10}" height="${bh - pad * 2 + 10}" rx="16" fill="${EDGE}"/>
    ${tiles}
    <g transform="${g(2, 0)}">${crystal()}</g>
    <g transform="${g(5, 0)}">${rock()}</g>
    <g transform="${g(4, 2)}">${goal()}</g>
    <g transform="${g(4, 3)}">${rock()}</g>
    <g transform="${g(1, 4)}">${hole()}</g>
    <g transform="${g(0, 4)}">${sand()}</g>
    <g transform="${g(5, 4)}">${block()}</g>

    <!-- 素通りルート(シアン): まっすぐ右 → ゴールを通り越して端へ -->
    <path d="M ${px + cs * 0.55} ${py + cs * 0.16} H ${wrongEnd[0]}" stroke="${CYAN}" stroke-width="11"
          stroke-linecap="round" stroke-dasharray="24 18" fill="none" opacity=".9"/>
    <g transform="translate(${wrongEnd[0]}, ${wrongEnd[1] + cs * 0.16})" stroke="${BLUE}" stroke-width="9" stroke-linecap="round">
      <path d="M -13 -13 L 13 13 M 13 -13 L -13 13"/>
    </g>

    <!-- ぴったりルート(オレンジ): 上→右(クリスタル回収)→下でゴール上に停止 -->
    <path d="M ${px - cs * 0.16} ${py - cs * 0.5}
             L ${p1[0] - cs * 0.16} ${p1[1] + cs * 0.1}
             Q ${p1[0] - cs * 0.16} ${p1[1] - cs * 0.22} ${p1[0] + cs * 0.18} ${p1[1] - cs * 0.22}
             L ${p2[0] - cs * 0.1} ${p2[1] - cs * 0.22}
             Q ${p2[0] + cs * 0.24} ${p2[1] - cs * 0.22} ${p2[0] + cs * 0.24} ${p2[1] + cs * 0.12}
             L ${p3[0] + cs * 0.24} ${p3[1] - cs * 0.42}"
          stroke="${BEAK}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"
          stroke-dasharray="24 18" fill="none"/>
    <path d="M ${p3[0] + cs * 0.24} ${p3[1] - cs * 0.30} l -15 -19 M ${p3[0] + cs * 0.24} ${p3[1] - cs * 0.30} l 15 -19"
          stroke="${BEAK_D}" stroke-width="10" stroke-linecap="round" fill="none"/>

    <!-- ペンギン -->
    <g transform="${g(0, 2)} rotate(6 50 50)">${penguin()}</g>
  </g>`;
}

/* ---- ハンコ ---- */
function hanko(x, y, rot) {
  return `
  <g transform="translate(${x},${y}) rotate(${rot})">
    <rect x="-150" y="-62" width="300" height="124" rx="18" fill="rgba(255,255,255,.92)"
          stroke="${STAMP}" stroke-width="9"/>
    <text x="0" y="6" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="58" fill="${STAMP}">作者超え!</text>
    <text x="0" y="42" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="20" fill="${STAMP}" letter-spacing="6">TSURURIN</text>
  </g>`;
}

const features = [
  ['毎日1問', '世界中がきょうの同じ盤面に挑戦'],
  ['全50ステージ', '新タイルが順番に登場、あそびながらルールがわかる'],
  ['ステージを自作して勝負', 'URLを送るだけ。作者超えされたら負け'],
];

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

  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <g opacity=".5">
    ${Array.from({ length: 20 }, (_, i) =>
      `<rect x="${-360 + i * 130}" y="-120" width="60" height="${H + 240}" fill="${BLUE}" opacity=".045" transform="rotate(25 ${-360 + i * 130} 0)"/>`
    ).join('')}
  </g>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <circle cx="150" cy="120" r="5" fill="#fff"/><circle cx="1430" cy="100" r="4" fill="#fff"/>
  <circle cx="1320" cy="760" r="5" fill="#fff"/><circle cx="90" cy="700" r="4" fill="#fff"/>

  <rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="40" fill="none" stroke="${INK}" stroke-width="11"/>

  <!-- 左: 図解盤面 -->
  ${demoBoard(84, 130, 88)}

  <!-- 盤面下の凡例 -->
  <g font-family="${FONT}" font-weight="900" font-size="29">
    <path d="M 120 740 h 64" stroke="${CYAN}" stroke-width="11" stroke-linecap="round" stroke-dasharray="22 16"/>
    <text x="206" y="750" fill="${INK2}">まっすぐ行くと、ゴールを<tspan fill="${BLUE}">素通り…</tspan></text>
    <path d="M 120 800 h 64" stroke="${BEAK}" stroke-width="11" stroke-linecap="round" stroke-dasharray="22 16"/>
    <text x="206" y="810" fill="${INK2}">回り道して<tspan fill="${BEAK_D}">「ぴったり停止」</tspan>で勝ち</text>
  </g>

  <!-- 右: タイトル+魅力 -->
  <g transform="translate(764, 0)">
    <text x="10" y="150" font-family="${FONT}" font-weight="900" font-size="30" letter-spacing="9" fill="${BLUE}">氷上スライドパズル挑戦状</text>
    <g transform="skewX(-6)">
      <text x="40" y="306" font-family="${FONT}" font-weight="900" font-size="158" letter-spacing="4" fill="${CYAN}" opacity=".85">ツルリン</text>
      <text x="32" y="298" font-family="${FONT}" font-weight="900" font-size="158" letter-spacing="4" fill="${INK}">ツルリン</text>
    </g>
    <rect x="36" y="332" width="600" height="11" rx="5.5" fill="${BEAK}"/>

    <text x="12" y="416" font-family="${FONT}" font-weight="900" font-size="42" fill="${INK2}">壁にぶつかるまで、止まれない。</text>

    ${features.map(([t, d], i) => `
      ${crystalMini(14, 458 + i * 96, 40)}
      <text x="68" y="${492 + i * 96}" font-family="${FONT}" font-weight="900" font-size="34" fill="${INK}">${t}</text>
      <text x="68" y="${527 + i * 96}" font-family="${FONT}" font-weight="900" font-size="24" fill="${INKSOFT}">${d}</text>
    `).join('')}

    <!-- 下部: 無料・ログイン不要 -->
    <rect x="10" y="772" width="528" height="64" rx="32" fill="${INK}"/>
    <text x="274" y="815" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="28" fill="#fff">ログイン不要・無料・今すぐあそべる</text>
  </g>

  <!-- ハンコ(右下、勢いよく) -->
  ${hanko(1430, 756, -12)}
</svg>`;

const out = path.join(__dirname, '..', 'promo.png');
sharp(Buffer.from(svg), { density: 96 })
  .resize(W, H)
  .png({ compressionLevel: 9 })
  .toFile(out)
  .then(() => console.log('OK ' + out))
  .catch((e) => { console.error(e); process.exit(1); });
