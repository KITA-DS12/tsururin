/* ツルリン — daily.js
 * 「きょうの問題」を日付シードから決定論的に生成する。サーバー不要。
 * 全プレイヤーが同じアルゴリズム・同じシードで同じ盤面を得る。
 */
(function (g) {
  'use strict';
  const E = g.TSR.Engine;
  const S = g.TSR.Solver;
  const T = E.T;

  const EPOCH_UTC = Date.UTC(2026, 5, 11); // #1 = 2026-06-11(JST)
  const SEED_SALT = 'TSURURIN-v1-';

  // 曜日別レシピ(0=日 … 6=土)。日曜が最難関。
  const CFG = [
    /*日*/ { w: 9, h: 9, walls: [9, 13], holes: [2, 3], sand: [1, 2], arrows: [1, 3], crystals: [1, 2], blocks: [1, 2], par: [6, 12] },
    /*月*/ { w: 5, h: 5, walls: [3, 4],  holes: [0, 0], sand: [0, 0], arrows: [0, 0], crystals: [0, 0], blocks: [0, 0], par: [3, 5] },
    /*火*/ { w: 6, h: 6, walls: [4, 6],  holes: [1, 2], sand: [0, 0], arrows: [0, 0], crystals: [0, 0], blocks: [0, 0], par: [4, 6] },
    /*水*/ { w: 6, h: 6, walls: [4, 6],  holes: [0, 2], sand: [1, 2], arrows: [0, 0], crystals: [0, 0], blocks: [0, 0], par: [4, 7] },
    /*木*/ { w: 7, h: 7, walls: [6, 8],  holes: [1, 2], sand: [0, 2], arrows: [1, 2], crystals: [0, 0], blocks: [0, 0], par: [5, 8] },
    /*金*/ { w: 7, h: 7, walls: [6, 8],  holes: [1, 2], sand: [0, 1], arrows: [0, 2], crystals: [1, 2], blocks: [0, 0], par: [5, 9] },
    /*土*/ { w: 8, h: 8, walls: [8, 10], holes: [1, 3], sand: [0, 2], arrows: [0, 2], crystals: [0, 2], blocks: [1, 1], par: [6, 10] },
  ];

  function strHash(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function int(rnd, a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

  /** JST の今日の情報 */
  function todayJST(now) {
    const t = new Date((now ? now.getTime() : Date.now()) + 9 * 3600e3);
    const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, d = t.getUTCDate();
    const key = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    return { y, m, d, key, dow: t.getUTCDay() };
  }

  function infoOf(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const utc = Date.UTC(y, m - 1, d);
    return {
      key: dateKey, y, m, d,
      dow: new Date(utc).getUTCDay(),
      number: Math.floor((utc - EPOCH_UTC) / 86400e3) + 1,
      label: m + '/' + d + '(' + '日月火水木金土'[new Date(utc).getUTCDay()] + ')',
    };
  }

  function buildRandom(cfg, rnd) {
    const { w, h } = cfg;
    const n = w * h;
    const tiles = new Array(n).fill(T.ICE);
    // 空きセルプール
    const pool = [];
    for (let i = 0; i < n; i++) pool.push(i);
    const take = () => pool.splice(Math.floor(rnd() * pool.length), 1)[0];

    const put = (count, maker) => {
      for (let i = 0; i < count && pool.length > 2; i++) tiles[take()] = maker();
    };
    put(int(rnd, cfg.walls[0], cfg.walls[1]), () => T.WALL);
    put(int(rnd, cfg.holes[0], cfg.holes[1]), () => T.HOLE);
    put(int(rnd, cfg.sand[0], cfg.sand[1]), () => T.SAND);
    put(int(rnd, cfg.arrows[0], cfg.arrows[1]), () => T.AU + int(rnd, 0, 3));
    put(int(rnd, cfg.crystals[0], cfg.crystals[1]), () => T.CRYSTAL);
    put(int(rnd, cfg.blocks[0], cfg.blocks[1]), () => T.BLOCK);

    if (pool.length < 2) return null;
    // スタートとゴールはある程度離す
    const minDist = Math.max(3, Math.floor(Math.max(w, h) * 0.7));
    for (let tries = 0; tries < 30; tries++) {
      const si = Math.floor(rnd() * pool.length);
      let gi = Math.floor(rnd() * pool.length);
      if (gi === si) gi = (gi + 1) % pool.length;
      const sc = pool[si], gc = pool[gi];
      const dist = Math.abs((sc % w) - (gc % w)) + Math.abs(((sc / w) | 0) - ((gc / w) | 0));
      if (dist >= minDist) {
        tiles[sc] = T.START;
        tiles[gc] = T.GOAL;
        return { w, h, tiles };
      }
    }
    return null;
  }

  /** 最短手順のどこかで矢印による方向転換が起きるか(矢印が「飾り」でないことの確認) */
  function arrowEngaged(level, dirs) {
    let st = E.initState(level);
    for (const d of dirs) {
      const r = E.simulate(level, st, d);
      if (!r.moved) return false;
      if (r.segments.some((sg) => sg.dir !== d)) return true; // 進行方向が変わる区間がある
      if (r.outcome === 'win') return false;
      st = r.state;
    }
    return false;
  }

  function hasArrowTile(tiles) {
    return tiles.some((t) => t >= T.AU && t <= T.AL);
  }

  // 最終フォールバック(生成が万一失敗した日のための盤面・ソルバー検証済み PAR=6)
  const FALLBACK = {
    w: 7, h: 7,
    tiles: [0,1,0,3,0,0,0, 0,1,1,0,0,0,0, 0,0,0,0,2,10,0, 0,0,0,0,0,1,0, 0,0,1,0,0,1,0, 0,0,0,0,0,0,0, 11,1,0,0,0,0,0],
  };

  /** 日付キーからデイリー問題を生成。{w,h,tiles,par,info} */
  function generate(dateKey) {
    const info = infoOf(dateKey);
    const cfg = CFG[info.dow];
    const cfgNoArrows = Object.assign({}, cfg, { arrows: [0, 0] });
    const rnd = mulberry32(strHash(SEED_SALT + dateKey));
    for (let attempt = 0; attempt < 6000; attempt++) {
      const relaxed = attempt > 4200;
      const b = buildRandom(relaxed ? cfgNoArrows : cfg, rnd);
      if (!b) continue;
      const level = E.parseLevel(b.w, b.h, b.tiles);
      if (level.start < 0 || level.goal < 0) continue;
      const res = S.solvePath(level, 60000);
      if (!res || res.par == null) continue;
      const lo = relaxed ? 3 : cfg.par[0];
      if (res.par < lo || res.par > cfg.par[1]) continue;
      if (hasArrowTile(b.tiles) && !arrowEngaged(level, res.dirs)) continue;
      return { w: b.w, h: b.h, tiles: b.tiles, par: res.par, info, attempt };
    }
    const level = E.parseLevel(FALLBACK.w, FALLBACK.h, FALLBACK.tiles);
    const res = S.solve(level, 60000);
    return { w: FALLBACK.w, h: FALLBACK.h, tiles: FALLBACK.tiles, par: res ? res.par : 3, info, attempt: -1 };
  }

  // れんしゅう用の固定盤面(チュートリアル)
  const PRACTICE = {
    w: 5, h: 5,
    tiles: (function () {
      const _ = T.ICE, W = T.WALL, P = T.START, G = T.GOAL;
      return [
        _, _, _, _, _,
        W, _, _, _, _,
        _, _, _, _, G,
        _, _, _, _, _,
        P, _, _, _, _,
      ];
    })(),
  };

  /* ============ ステージモード(1〜100) ============
   * 低レベルから高レベルへ、盤面サイズとギミックが少しずつ増える。
   * デイリーと同じく日付ではなくステージ番号をシードに決定論的生成。
   */
  const STAGE_MAX = 50;
  const STAGE_SALT = 'TSURURIN-stage-v1-';
  const CHECKPOINT = 5; // 5の倍数 = チェックポイント。クリアで次の5ステージが解放

  // 新タイルが初登場するステージ(チュートリアル導線)
  const NEW_TILES = {
    1:  { tile: T.WALL,    name: 'きほん',     desc: '滑って、岩か壁に当たって止まる。ゴールの上でぴったり停止' },
    9:  { tile: T.HOLE,    name: '穴',         desc: '通ると落ちて失敗。コースをよく見て避けよう' },
    17: { tile: T.SAND,    name: '砂',         desc: '上に乗ると必ず止まれる。貴重な足場' },
    25: { tile: T.AR,      name: '矢印床',     desc: '通ると強制的にその方向へ滑り直す' },
    33: { tile: T.CRYSTAL, name: 'クリスタル', desc: '通過で回収。ぜんぶ集めないとゴールが開かない' },
    41: { tile: T.BLOCK,   name: '氷塊',       desc: '押すと滑っていく。穴に落とせば埋まって道になる' },
  };

  function stageCfg(n) {
    let c;
    if (n <= 4)       { c = { w: 4, walls: [2, 3],  holes: [0, 0], sand: [0, 0], arrows: [0, 0], crystals: [0, 0], blocks: [0, 0], par: [2, 3] }; }
    else if (n <= 8)  { c = { w: 5, walls: [3, 5],  holes: [0, 0], sand: [0, 0], arrows: [0, 0], crystals: [0, 0], blocks: [0, 0], par: [3, 4] }; }
    else if (n <= 16) { c = { w: n <= 12 ? 5 : 6, walls: [3, 6], holes: [1, 2], sand: [0, 0], arrows: [0, 0], crystals: [0, 0], blocks: [0, 0], par: [3, 6] }; }
    else if (n <= 24) { c = { w: 6, walls: [4, 6],  holes: [0, 2], sand: [1, 2], arrows: [0, 0], crystals: [0, 0], blocks: [0, 0], par: [4, 6] }; }
    else if (n <= 32) { c = { w: n <= 28 ? 6 : 7, walls: [5, 7], holes: [0, 2], sand: [0, 1], arrows: [1, 2], crystals: [0, 0], blocks: [0, 0], par: [4, 7] }; }
    else if (n <= 40) { c = { w: 7, walls: [6, 8],  holes: [1, 2], sand: [0, 1], arrows: [0, 2], crystals: [1, 2], blocks: [0, 0], par: [5, 8] }; }
    else {
      const size = n >= 49 ? 9 : n >= 46 ? 8 : 7;
      const lo = n >= 49 ? 7 : n >= 45 ? 6 : 5;
      c = { w: size, walls: [size + 1, size + 4], holes: [1, 3], sand: [0, 2], arrows: [0, 2], crystals: [0, 2], blocks: [1, n >= 46 ? 2 : 1], par: [lo, 12] };
    }
    c.h = c.w;
    if (n % CHECKPOINT === 0) {
      // チェックポイントはひと回り歯ごたえを足す
      c.par = [Math.min(c.par[0] + 1, c.par[1]), Math.min(c.par[1] + 1, 12)];
      c.walls = [c.walls[0], c.walls[1] + 1];
    }
    return c;
  }

  /** ステージ番号から決定論的に生成。{w,h,tiles,par,n} */
  function generateStage(n) {
    const cfg = stageCfg(n);
    const cfgNoArrows = Object.assign({}, cfg, { arrows: [0, 0] });
    const rnd = mulberry32(strHash(STAGE_SALT + n));
    for (let attempt = 0; attempt < 6000; attempt++) {
      const relaxed = attempt > 4200;
      const b = buildRandom(relaxed ? cfgNoArrows : cfg, rnd);
      if (!b) continue;
      const level = E.parseLevel(b.w, b.h, b.tiles);
      if (level.start < 0 || level.goal < 0) continue;
      const res = S.solvePath(level, 60000);
      if (!res || res.par == null) continue;
      const lo = relaxed ? Math.max(2, cfg.par[0] - 2) : cfg.par[0];
      if (res.par < lo || res.par > cfg.par[1]) continue;
      // 矢印を含む盤面は、最短解が矢印を実際に使うものだけ採用
      if (hasArrowTile(b.tiles) && !arrowEngaged(level, res.dirs)) continue;
      return { w: b.w, h: b.h, tiles: b.tiles, par: res.par, n, attempt };
    }
    const level = E.parseLevel(FALLBACK.w, FALLBACK.h, FALLBACK.tiles);
    const res = S.solve(level, 60000);
    return { w: FALLBACK.w, h: FALLBACK.h, tiles: FALLBACK.tiles, par: res ? res.par : 6, n, attempt: -1 };
  }

  /* ============ ランダム生成(エディタ用・毎回ちがう問題) ============ */
  const RANDOM_DIFFS = {
    easy:   { label: 'やさしい',  par: [3, 5] },
    normal: { label: 'ふつう',    par: [4, 7] },
    hard:   { label: 'むずかしい', par: [6, 12] },
  };

  function randomCfg(w, h, diff) {
    const area = w * h;
    const d = RANDOM_DIFFS[diff] || RANDOM_DIFFS.normal;
    const wallLo = Math.max(2, Math.round(area * 0.10));
    const wallHi = Math.max(wallLo + 1, Math.round(area * (diff === 'easy' ? 0.16 : 0.18)));
    const big = area >= 36;
    const cfg = { w, h, walls: [wallLo, wallHi], par: d.par.slice(),
      holes: [0, 0], sand: [0, 0], arrows: [0, 0], crystals: [0, 0], blocks: [0, 0] };
    if (diff === 'easy') {
      cfg.holes = [0, area >= 30 ? 1 : 0];
      cfg.sand = [0, 1];
    } else if (diff === 'normal') {
      cfg.holes = [0, 2];
      cfg.sand = [0, 1];
      cfg.arrows = [0, big ? 2 : 0];
      cfg.crystals = [0, big ? 1 : 0];
    } else {
      cfg.holes = [1, 3];
      cfg.sand = [0, 2];
      cfg.arrows = [0, 2];
      cfg.crystals = [0, 2];
      cfg.blocks = area >= 42 ? [1, 1] : [0, 0];
    }
    return cfg;
  }

  /** その場かぎりのランダム問題を生成(非決定論)。失敗時 null。{w,h,tiles,par} */
  function generateRandom(w, h, diff) {
    const cfg = randomCfg(w, h, diff);
    const cfgNoArrows = Object.assign({}, cfg, { arrows: [0, 0] });
    const rnd = mulberry32((Math.random() * 0xFFFFFFFF) >>> 0);
    for (let attempt = 0; attempt < 3500; attempt++) {
      const relaxed = attempt > 2400;
      const b = buildRandom(relaxed ? cfgNoArrows : cfg, rnd);
      if (!b) continue;
      const level = E.parseLevel(b.w, b.h, b.tiles);
      if (level.start < 0 || level.goal < 0) continue;
      const res = S.solvePath(level, 60000);
      if (!res || res.par == null) continue;
      const lo = relaxed ? 3 : cfg.par[0];
      if (res.par < lo || res.par > cfg.par[1]) continue;
      if (hasArrowTile(b.tiles) && !arrowEngaged(level, res.dirs)) continue;
      return { w: b.w, h: b.h, tiles: b.tiles, par: res.par };
    }
    return null;
  }

  g.TSR.Daily = { todayJST, infoOf, generate, PRACTICE, EPOCH_UTC, CFG, mulberry32, strHash,
                  STAGE_MAX, CHECKPOINT, NEW_TILES, stageCfg, generateStage,
                  RANDOM_DIFFS, generateRandom, arrowEngaged, hasArrowTile };
})(typeof window !== 'undefined' ? window : globalThis);
