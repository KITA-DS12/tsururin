/* node tools/test.js — ロジック層の検証 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
for (const f of ['engine.js', 'solver.js', 'codec.js', 'daily.js']) {
  eval(fs.readFileSync(path.join(root, 'js', f), 'utf8'));
}
const { Engine: E, Solver: S, Codec: C, Daily: D } = globalThis.TSR;
const T = E.T;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('  ✗ FAIL: ' + msg); }
}
function level1D(row) { return E.parseLevel(row.length, 1, row); }

console.log('--- engine: 基本滑走 ---');
{
  // P . . # .  → 右: x2 で停止(壁手前)
  const lv = level1D([T.START, T.ICE, T.ICE, T.WALL, T.ICE]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.moved && r.state.pos === 2 && r.outcome === 'stop', '壁手前で停止');
  // 左: 動けない
  const r2 = E.simulate(lv, E.initState(lv), 3);
  ok(!r2.moved, '壁際で空振り = movedなし');
}
{
  // P . . . .  → 右: 端 x4 で停止(外周は壁)
  const lv = level1D([T.START, T.ICE, T.ICE, T.ICE, T.ICE]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.state.pos === 4, '盤端で停止');
}
{
  // ゴール素通り: P . G . . → 右で x4(Gを通過)、勝利ではない
  const lv = level1D([T.START, T.ICE, T.GOAL, T.ICE, T.ICE]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.state.pos === 4 && r.outcome === 'stop', 'ゴール素通り');
}
{
  // ぴったり停止で勝ち: P . G #
  const lv = level1D([T.START, T.ICE, T.GOAL, T.WALL]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.outcome === 'win' && r.state.pos === 2, 'ゴールぴったりで勝利');
}

console.log('--- engine: ギミック ---');
{
  // 穴: P . H . → 右で落下
  const lv = level1D([T.START, T.ICE, T.HOLE, T.ICE]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.outcome === 'fall' && r.state.pos === 2, '穴に落下');
}
{
  // 砂: P . S . → 砂上 x2 で停止
  const lv = level1D([T.START, T.ICE, T.SAND, T.ICE]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.outcome === 'stop' && r.state.pos === 2, '砂で停止');
}
{
  // クリスタル通過回収: P . C . # → x3 停止、got=1
  const lv = level1D([T.START, T.ICE, T.CRYSTAL, T.ICE, T.WALL]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.state.pos === 3 && r.state.got === 1 && r.pickups.length === 1, 'クリスタル通過回収');
}
{
  // ゴールロック: クリスタル未回収でゴール停止 → win にならない
  const lv = level1D([T.START, T.GOAL, T.WALL, T.CRYSTAL]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.outcome === 'stop' && r.goalLocked === true, 'クリスタル未回収でゴールロック');
}
{
  // 矢印: P → AR で右継続、AL→AR の対面で無限ループ検出
  const lv = level1D([T.START, T.AR, T.ICE, T.AL, T.ICE]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.outcome === 'loop', '対面矢印で無限ループ検出');
}
{
  // 矢印リダイレクト: 2x3 で右→下
  // P AR .
  // .  .  .   AD を (1,0) に置く → P右: (1,0)で下へ → (1,1)…端で停止
  const tiles = [T.START, T.AD, T.ICE,
                 T.ICE,  T.ICE, T.ICE];
  const lv = E.parseLevel(3, 2, tiles);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.state.pos === 4 && r.segments.length === 2, '矢印で方向転換(2区間)');
}

{
  // 矢印で押し戻されて元の位置に戻る → 1手として成立(往復アニメが再生される)
  const lv = E.parseLevel(1, 3, [T.START, T.ICE, T.AU]);
  const r = E.simulate(lv, E.initState(lv), 2);
  ok(r.moved && r.state.pos === 0 && r.segments.length === 2 && r.outcome === 'stop', '矢印往復は1手扱い(moved=true, 2区間)');
}

console.log('--- engine: 氷塊 ---');
{
  // P . B . # → 押す: 塊は x3、ペンギンは x1
  const lv = level1D([T.START, T.ICE, T.BLOCK, T.ICE, T.WALL]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.state.pos === 1 && r.push && r.state.blocks[0] === 3, '氷塊プッシュ');
  // 続けて右: 塊は壁際で動けない → ペンギン x2 で停止、push なし
  const r2 = E.simulate(lv, r.state, 1);
  ok(r2.state.pos === 2 && !r2.push, '動かない塊の手前で停止');
}
{
  // P . B H . → 塊が穴に落ちて埋まる → 次の右で上を通過できる
  const lv = level1D([T.START, T.ICE, T.BLOCK, T.HOLE, T.ICE]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.push && r.push.fell === 3 && r.state.blocks[0] === -1 && r.state.filled === 1, '氷塊が穴を埋める');
  const r2 = E.simulate(lv, r.state, 1);
  ok(r2.state.pos === 4 && r2.outcome === 'stop', '埋まった穴の上を滑走');
}
{
  // 塊はゴール手前で止まる: P B G .
  const lv = level1D([T.START, T.BLOCK, T.GOAL, T.ICE]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(!r.moved || (r.push === null && !r.moved), '塊がゴール直前で動けない場合は空振り');
}

console.log('--- engine: ヒビ氷 ---');
{
  // 通過で割れる: P K . # → 右で x2 停止、K は割れ済み
  const lv = level1D([T.START, T.CRACK, T.ICE, T.WALL]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.outcome === 'stop' && r.state.pos === 2 && r.state.cracked === 1, 'ヒビ氷を通過すると割れる');
  // 割れた上に戻ろうとすると落ちる
  const r2 = E.simulate(lv, r.state, 3);
  ok(r2.outcome === 'fall' && r2.state.pos === 1, '割れたヒビ氷に入ると落下');
}
{
  // 上で停止はできる(まだ割れない)。離脱した瞬間に割れる
  const lv = level1D([T.START, T.ICE, T.CRACK, T.WALL]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.outcome === 'stop' && r.state.pos === 2 && r.state.cracked === 0, 'ヒビ氷の上で停止可能(未破壊)');
  const r2 = E.simulate(lv, r.state, 3);
  ok(r2.outcome === 'stop' && r2.state.pos === 0 && r2.state.cracked === 1, '離脱した瞬間に割れる');
  const r3 = E.simulate(lv, r2.state, 1);
  ok(r3.outcome === 'fall' && r3.state.pos === 2, '割れた跡には二度と乗れない');
}
{
  // 矢印で同一 move 内に同じヒビ氷へ戻ると自滅
  const lv = level1D([T.START, T.CRACK, T.AL]);
  const r = E.simulate(lv, E.initState(lv), 1);
  ok(r.outcome === 'fall' && r.state.pos === 1, '矢印で割れ跡に押し戻されて落下');
}

console.log('--- solver ---');
{
  const p = D.PRACTICE;
  const lv = E.parseLevel(p.w, p.h, p.tiles);
  const res = S.solve(lv);
  ok(res && res.par === 2, 'れんしゅう盤面 PAR=2 (actual: ' + (res && res.par) + ')');
}
{
  // 解なし盤面(素通り)
  const lv = level1D([T.START, T.ICE, T.GOAL, T.ICE, T.ICE]);
  ok(S.solve(lv) === null, '1次元の素通り盤面は解なし');
  // 解ありは {par, capped:false}
  const lv2 = level1D([T.START, T.GOAL, T.WALL]);
  const r2 = S.solve(lv2);
  ok(r2 && r2.par === 1 && r2.capped === false, '解ありは{par,capped:false}');
}
{
  // ヒビ氷の状態をソルバーが区別する:
  // # G . P K C # … クリスタル回収に右進→ヒビ氷が割れて帰り道が消える→解なし
  const crack = [T.WALL, T.GOAL, T.ICE, T.START, T.CRACK, T.CRYSTAL, T.WALL];
  ok(S.solve(level1D(crack)) === null, 'ヒビ氷で帰り道が消えると解なし');
  // 同じ盤面のヒビ氷を普通の氷にすると PAR=2 で解ける
  const ice = crack.slice(); ice[4] = T.ICE;
  const r = S.solve(level1D(ice));
  ok(r && r.par === 2, 'ヒビ氷を氷に置換すれば解ける(PAR=2)');
}
console.log('--- solver: diagnose ---');
{
  // no_stop: 中央P・右隣G・氷だけ → 通れるが止まれない
  const t = new Array(25).fill(T.ICE); t[12] = T.START; t[13] = T.GOAL;
  const lv = E.parseLevel(5, 5, t);
  ok(S.diagnose(lv).status === 'no_stop', 'diagnose: 止まれない盤面=no_stop');
  // ok: Gの右に壁を足す → 解ける(PAR1なのでtoo_easy扱い)
  const t2 = t.slice(); t2[14] = T.WALL;
  ok(S.diagnose(E.parseLevel(5, 5, t2)).status === 'too_easy', 'diagnose: 簡単すぎ=too_easy');
  // unreachable: ゴールを壁で隔離
  const u = new Array(25).fill(T.ICE); u[0] = T.START; u[24] = T.GOAL; u[19] = T.WALL; u[23] = T.WALL;
  ok(S.diagnose(E.parseLevel(5, 5, u)).status === 'unreachable', 'diagnose: 到達不能=unreachable');
  // ok: フォールバック盤面(PAR6)
  const fb = [0,1,0,3,0,0,0, 0,1,1,0,0,0,0, 0,0,0,0,2,10,0, 0,0,0,0,0,1,0, 0,0,1,0,0,1,0, 0,0,0,0,0,0,0, 11,1,0,0,0,0,0];
  const rep = S.diagnose(E.parseLevel(7, 7, fb));
  ok(rep.status === 'ok' && rep.par === 6, 'diagnose: 正常盤面=ok PAR6');
}

console.log('--- codec ---');
{
  const p = D.PRACTICE;
  const enc = C.encodeChallenge({ w: p.w, h: p.h, tiles: p.tiles, authorMoves: 2, name: 'ペンギン🐧' });
  const dec = C.decodeChallenge(enc);
  ok(!dec.error, 'デコード成功');
  ok(dec.w === 5 && dec.h === 5 && dec.authorMoves === 2 && dec.name === 'ペンギン🐧', 'メタ情報一致');
  ok(JSON.stringify(dec.tiles) === JSON.stringify(p.tiles), 'タイル一致');
  console.log('  URLペイロード長(5x5+名前):', enc.length, '文字');

  // 改ざん検出
  const broken = enc.slice(0, -3) + (enc.endsWith('AAA') ? 'BBB' : 'AAA');
  ok(C.decodeChallenge(broken).error != null, 'CRCで破損検出');
  ok(C.decodeChallenge('').error != null, '空文字でエラー');
  ok(C.decodeChallenge('!!!!####').error != null, '不正文字でエラー');

  // ヒビ氷(タイル12)を含む盤面の roundtrip
  const ct = p.tiles.slice();
  ct[1] = T.CRACK;
  const enc2 = C.encodeChallenge({ w: p.w, h: p.h, tiles: ct, authorMoves: 3, name: '' });
  const dec2 = C.decodeChallenge(enc2);
  ok(!dec2.error && JSON.stringify(dec2.tiles) === JSON.stringify(ct), 'ヒビ氷入り盤面のroundtrip');
}
{
  // ランダム盤面 ×80 ラウンドトリップ
  const rnd = D.mulberry32(12345);
  let allOk = true;
  for (let k = 0; k < 80; k++) {
    const w = 4 + Math.floor(rnd() * 6), h = 4 + Math.floor(rnd() * 6);
    const tiles = [];
    for (let i = 0; i < w * h; i++) tiles.push(Math.floor(rnd() * 10)); // 0..9
    tiles[0] = T.START; tiles[w * h - 1] = T.GOAL;
    const enc = C.encodeChallenge({ w, h, tiles, authorMoves: 1 + (k % 30), name: k % 3 ? 'abcDEF' + k : '' });
    const dec = C.decodeChallenge(enc);
    if (dec.error || JSON.stringify(dec.tiles) !== JSON.stringify(tiles) || dec.w !== w || dec.h !== h) { allOk = false; break; }
  }
  ok(allOk, 'ランダム盤面80件ラウンドトリップ');
  const big = C.encodeChallenge({ w: 9, h: 9, tiles: new Array(81).fill(0).map((_, i) => i === 0 ? T.START : i === 80 ? T.GOAL : T.ICE), authorMoves: 9, name: 'ながいなまえ12文字です' });
  console.log('  URLペイロード長(9x9+12文字名):', big.length, '文字');
}

console.log('--- stages: 全50ステージ生成+関門+ランダム生成 ---');
{
  let totalMs = 0, fb = 0;
  const pars = [];
  for (let n = 1; n <= D.STAGE_MAX; n++) {
    const t0 = Date.now();
    const a = D.generateStage(n);
    totalMs += Date.now() - t0;
    if (a.attempt === -1) fb++;
    pars.push(a.par);
    const cfg = D.stageCfg(n);
    if (!(a.par >= 2 && a.par <= cfg.par[1])) { fail++; console.error('  ✗ PAR範囲外 stage ' + n + ' par=' + a.par); }
    if (!(a.w === cfg.w && a.h === cfg.h)) { fail++; console.error('  ✗ サイズ不一致 stage ' + n); }
  }
  ok(fb === 0, 'フォールバック未使用(' + fb + '件)');
  ok(totalMs < 5000, '全50ステージ生成が5秒以内(' + totalMs + 'ms)');
  ok(D.STAGE_MAX === 50, 'STAGE_MAX=50');
  // 矢印を含むステージは、最短解が必ず矢印で方向転換する
  let arrowStages = 0, allEngaged = true;
  for (let n = 1; n <= D.STAGE_MAX; n++) {
    const g2 = D.generateStage(n);
    if (!D.hasArrowTile(g2.tiles)) continue;
    arrowStages++;
    const lv2 = E.parseLevel(g2.w, g2.h, g2.tiles);
    const sp2 = S.solvePath(lv2, 60000);
    if (!sp2 || !D.arrowEngaged(lv2, sp2.dirs)) { allEngaged = false; console.error('  ✗ stage ' + n + ' の矢印が飾り'); }
  }
  ok(allEngaged, '矢印入りステージ全てで最短解が矢印を使用(' + arrowStages + '件)');
  ok(arrowStages >= 8, '矢印入りステージが十分ある(' + arrowStages + '件)');
  // 関門はその帯の通常ステージよりPAR下限が高い
  for (const n of [10, 20, 30, 40]) {
    ok(D.stageCfg(n).par[0] >= D.stageCfg(n - 1).par[0] + 1, '関門' + n + 'はPAR下限+1');
  }
  // ランダム生成: 各サイズ・難易度で可解な問題が返る
  for (const [w, diff] of [[4, 'easy'], [6, 'normal'], [7, 'hard'], [9, 'hard']]) {
    const g2 = D.generateRandom(w, w, diff);
    ok(g2 != null, 'generateRandom ' + w + 'x' + w + ' ' + diff + ' 成功');
    if (g2) {
      const lv2 = E.parseLevel(g2.w, g2.h, g2.tiles);
      const r2 = S.solve(lv2, 60000);
      ok(r2 && r2.par === g2.par && r2.par >= 3, 'ランダム生成は可解でPAR一致(' + g2.par + ')');
    }
  }
  // 決定論
  const a = D.generateStage(50), b = D.generateStage(50);
  ok(JSON.stringify(a.tiles) === JSON.stringify(b.tiles), 'ステージ生成は決定論的');
  // 難易度が上昇傾向(最初の10と最後の10の平均PAR比較)
  const head = pars.slice(0, 10).reduce((x, y) => x + y) / 10;
  const tail = pars.slice(-10).reduce((x, y) => x + y) / 10;
  ok(tail > head + 3, '難易度カーブ: 序盤平均PAR ' + head.toFixed(1) + ' → 終盤 ' + tail.toFixed(1));
  // 新タイル導入ステージで実際にそのタイルが盤面に含まれる
  const E2 = E;
  for (const [nStr, info] of Object.entries(D.NEW_TILES)) {
    const n = +nStr;
    if (n === 1) continue;
    const g2 = D.generateStage(n);
    const tset = new Set(g2.tiles);
    const family = info.tile >= 4 && info.tile <= 7 ? [4,5,6,7] : [info.tile];
    ok(family.some((t) => tset.has(t)), 'stage ' + n + ' に NEW タイル(' + info.name + ')が登場');
  }
  // 新タイル導入ステージは、最短解で実際にそのタイルが機能している(飾りで終わらない)
  const ENGAGED_CHECKS = [
    { n: 9,  name: '穴',     fn: (lv, dirs, par) => D.holeEngaged(lv, dirs, par) },
    { n: 17, name: '砂',     fn: (lv, dirs) => D.sandEngaged(lv, dirs) },
    { n: 41, name: '氷塊',   fn: (lv, dirs) => D.blockEngaged(lv, dirs) },
    { n: 46, name: 'ヒビ氷', fn: (lv, dirs, par) => D.crackEngaged(lv, dirs, par) },
  ];
  for (const c of ENGAGED_CHECKS) {
    const g2 = D.generateStage(c.n);
    const lv2 = E.parseLevel(g2.w, g2.h, g2.tiles);
    const sp2 = S.solvePath(lv2, 60000);
    ok(sp2 && c.fn(lv2, sp2.dirs, sp2.par), 'stage ' + c.n + ' の NEW タイル(' + c.name + ')が最短解で機能');
  }
}

console.log('--- daily: 生成・決定論・速度 ---');
{
  const dates = [];
  for (let d = 8; d <= 21; d++) dates.push('2026-06-' + String(d).padStart(2, '0'));
  let allDet = true;
  for (const key of dates) {
    const t0 = Date.now();
    const a = D.generate(key);
    const ms = Date.now() - t0;
    const b = D.generate(key);
    const det = JSON.stringify(a.tiles) === JSON.stringify(b.tiles) && a.par === b.par;
    if (!det) allDet = false;
    const dow = '日月火水木金土'[a.info.dow];
    const cfg = D.CFG[a.info.dow];
    const inRange = a.par >= 3 && a.par <= cfg.par[1];
    if (!inRange) { fail++; console.error('  ✗ PAR範囲外: ' + key); }
    console.log(`  ${key}(${dow}) #${a.info.number} ${a.w}x${a.h} PAR=${a.par} 試行=${a.attempt} ${ms}ms`);
    ok(a.attempt >= 0, key + ' フォールバック未使用');
  }
  ok(allDet, '生成は決定論的(2回実行で一致)');
  ok(D.infoOf('2026-06-11').number === 1, 'エポック日 2026-06-11 は #1 (actual: ' + D.infoOf('2026-06-11').number + ')');
  ok(D.infoOf('2026-06-12').number === 2, '翌日は #2');
  ok(D.infoOf('2026-07-11').number === 31, '30日後は #31');
}
{
  // フォールバック盤面が可解であること
  const fbTiles = [0,1,0,3,0,0,0, 0,1,1,0,0,0,0, 0,0,0,0,2,10,0, 0,0,0,0,0,1,0, 0,0,1,0,0,1,0, 0,0,0,0,0,0,0, 11,1,0,0,0,0,0];
  const lv = E.parseLevel(7, 7, fbTiles);
  const res = S.solve(lv);
  ok(res != null && res.par === 6, 'フォールバック盤面は可解 (PAR=' + (res && res.par) + ')');
}

console.log(`\n結果: ${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
