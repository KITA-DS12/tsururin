/* ツルリン — engine.js
 * 盤面モデルと滑走シミュレーション。UI から独立した純粋ロジック。
 * ブラウザ/Node 両対応(グローバル TSR.Engine に公開)。
 */
(function (g) {
  'use strict';

  // タイル種別(コーデックの 4bit 値と一致させること)
  const T = {
    ICE: 0, WALL: 1, HOLE: 2, SAND: 3,
    AU: 4, AR: 5, AD: 6, AL: 7,        // 矢印床(上右下左)
    CRYSTAL: 8, BLOCK: 9, START: 10, GOAL: 11,
  };

  // 方向: 0=上 1=右 2=下 3=左
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const ARROW_DIR = { [T.AU]: 0, [T.AR]: 1, [T.AD]: 2, [T.AL]: 3 };
  const DIR_NAME = ['up', 'right', 'down', 'left'];

  /** タイル配列からレベル定義を作る。動的要素(クリスタル/氷塊/開始位置)は分離する。 */
  function parseLevel(w, h, tiles) {
    const grid = new Uint8Array(w * h);
    const crystals = [], blocks = [], holes = [];
    let start = -1, goal = -1;
    for (let i = 0; i < w * h; i++) {
      const t = tiles[i] | 0;
      switch (t) {
        case T.CRYSTAL: crystals.push(i); grid[i] = T.ICE; break;
        case T.BLOCK:   blocks.push(i);   grid[i] = T.ICE; break;
        case T.START:   start = i;        grid[i] = T.ICE; break;
        case T.GOAL:    goal = i;         grid[i] = T.GOAL; break;
        case T.HOLE:    holes.push(i);    grid[i] = T.HOLE; break;
        default:        grid[i] = t;
      }
    }
    return { w, h, grid, crystals, blocks, holes, start, goal, tiles: Array.from(tiles) };
  }

  function initState(level) {
    return { pos: level.start, got: 0, blocks: level.blocks.slice(), filled: 0 };
  }

  function cloneState(s) {
    return { pos: s.pos, got: s.got, blocks: s.blocks.slice(), filled: s.filled };
  }

  function isFilled(level, filledMask, cell) {
    const hi = level.holes.indexOf(cell);
    return hi >= 0 && ((filledMask >> hi) & 1) === 1;
  }

  function fullCrystalMask(level) {
    return (1 << level.crystals.length) - 1;
  }

  /** 氷塊の滑走。動かなければ null。動けば {to, fell, segs}。 */
  function slideBlock(level, blocks, got, filled, bp, d0) {
    const { w, h, grid, crystals } = level;
    let p = bp, d = d0, fell = null, movedAny = false;
    const segs = [];
    const vis = new Set([p * 4 + d]);
    let running = true, guard = 0;

    while (running && guard++ < 400) {
      const from = p;
      let redirect = -1;
      for (;;) {
        const x = p % w, y = (p - x) / w;
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) { running = false; break; }
        const np = ny * w + nx;
        if (blocks.indexOf(np) !== -1) { running = false; break; }
        let c = grid[np];
        if (c === T.HOLE && isFilled(level, filled, np)) c = T.ICE;
        if (c === T.WALL || c === T.GOAL) { running = false; break; }   // 氷塊はゴール手前で止まる
        const ci = crystals.indexOf(np);
        if (ci !== -1 && !((got >> ci) & 1)) { running = false; break; } // 未回収クリスタル手前で止まる
        p = np; movedAny = true;
        if (c === T.HOLE) { fell = np; running = false; break; }         // 穴に落ちて埋まる
        if (c === T.SAND) { running = false; break; }                    // 砂の上で停止
        if (c >= T.AU && c <= T.AL) {
          const nd = ARROW_DIR[c], k = np * 4 + nd;
          if (vis.has(k)) { running = false; break; }                    // 無限ループ防止: その場停止
          vis.add(k);
          redirect = nd; break;
        }
      }
      if (p !== from) segs.push({ from, to: p, dir: d });
      if (redirect >= 0) d = redirect;
    }
    if (!movedAny) return null;
    return { to: fell != null ? null : p, fell, segs };
  }

  /**
   * 1 手のシミュレーション。
   * 返り値: { moved, outcome:'stop'|'win'|'fall'|'loop', segments, pickups, push, goalLocked, state }
   *  - segments: ペンギンの移動区間 [{from,to,dir,len}]
   *  - pickups:  回収したクリスタル [{cell, step}](step は移動開始からの通過マス数)
   *  - push:     氷塊を押した場合 {bi, from, to, fell, segs}
   */
  function simulate(level, state, dir) {
    const { w, h, grid, goal, crystals, holes } = level;
    let pos = state.pos, d = dir, got = state.got, filled = state.filled;
    const blocks = state.blocks.slice();
    const segments = [], pickups = [];
    let push = null, outcome = 'stop', goalLocked = false;
    const visited = new Set([pos * 4 + d]);
    let totalSteps = 0, running = true, guard = 0;

    while (running && guard++ < 400) {
      const segFrom = pos;
      const segDir = d;
      let redirect = -1;
      for (;;) {
        const x = pos % w, y = (pos - x) / w;
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) { running = false; break; } // 外周は壁扱い
        const np = ny * w + nx;

        const bi = blocks.indexOf(np);
        if (bi !== -1) {
          if (!push) {
            const br = slideBlock(level, blocks, got, filled, np, d);
            if (br) {
              push = { bi, from: np, to: br.to, fell: br.fell, segs: br.segs };
              if (br.fell != null) {
                blocks[bi] = -1;
                filled |= (1 << holes.indexOf(br.fell));
              } else {
                blocks[bi] = br.to;
              }
            }
          }
          running = false; break;  // 押した勢いでペンギンは停止
        }

        let c = grid[np];
        if (c === T.HOLE && isFilled(level, filled, np)) c = T.ICE;
        if (c === T.WALL) { running = false; break; }

        pos = np; totalSteps++;
        if (c === T.HOLE) { outcome = 'fall'; running = false; break; }

        const ci = crystals.indexOf(np);
        if (ci !== -1 && !((got >> ci) & 1)) {
          got |= (1 << ci);
          pickups.push({ cell: np, step: totalSteps });
        }
        if (c === T.SAND) { running = false; break; }
        if (c >= T.AU && c <= T.AL) {
          const nd = ARROW_DIR[c], k = np * 4 + nd;
          if (visited.has(k)) { outcome = 'loop'; running = false; break; }
          visited.add(k);
          redirect = nd; break;
        }
        // 通常の氷・ゴール・回収済みクリスタル: 滑走継続
      }
      if (pos !== segFrom) {
        const len = Math.abs((pos % w) - (segFrom % w)) + Math.abs(((pos / w) | 0) - ((segFrom / w) | 0));
        segments.push({ from: segFrom, to: pos, dir: segDir, len });
      }
      if (redirect >= 0) d = redirect;
    }

    // 軌跡があれば「動いた」扱い(矢印で元の位置へ戻されても1手。壁に密着しての空振りのみ無効)
    const moved = segments.length > 0 || !!push || got !== state.got;
    if (!moved) return { moved: false };

    const ns = { pos, got, blocks, filled };
    if (outcome === 'stop' && pos === goal) {
      if (got === fullCrystalMask(level)) outcome = 'win';
      else goalLocked = true;
    }
    return { moved: true, outcome, segments, pickups, push, goalLocked, state: ns, dirFinal: d };
  }

  /** セグメント from→to(直線・端点含む)上にセル cell があるか */
  function cellOnSegment(from, to, cell, w) {
    const cx = cell % w, cy = (cell - cx) / w;
    const fx = from % w, fy = (from - fx) / w;
    const tx = to % w, ty = (to - tx) / w;
    if (fx === tx && cx === fx) return cy >= Math.min(fy, ty) && cy <= Math.max(fy, ty);
    if (fy === ty && cy === fy) return cx >= Math.min(fx, tx) && cx <= Math.max(fx, tx);
    return false;
  }

  /** エディタ用: タイル配列の妥当性(START/GOAL がちょうど1つずつ) */
  function countSpecials(tiles) {
    let s = 0, gl = 0;
    for (const t of tiles) { if (t === T.START) s++; else if (t === T.GOAL) gl++; }
    return { starts: s, goals: gl };
  }

  g.TSR = g.TSR || {};
  g.TSR.Engine = {
    T, DX, DY, DIR_NAME, ARROW_DIR,
    parseLevel, initState, cloneState, simulate, slideBlock,
    fullCrystalMask, isFilled, countSpecials, cellOnSegment,
  };
})(typeof window !== 'undefined' ? window : globalThis);
