/* ツルリン — solver.js
 * 幅優先探索で最短手数(PAR)を求める。状態 = (位置, クリスタル, 氷塊配置, 埋まった穴)。
 */
(function (g) {
  'use strict';
  const E = g.TSR.Engine;

  function keyOf(s) {
    const bs = s.blocks.slice().sort((a, b) => a - b).join(',');
    return s.pos + '|' + s.got + '|' + s.filled + '|' + (s.cracked | 0) + '|' + bs;
  }

  /**
   * 最短手数を返す。
   *  - 解あり          : { par, capped:false }
   *  - 複雑すぎ(打切) : { par:null, capped:true }
   *  - 解なし          : null
   */
  function solve(level, cap) {
    cap = cap || 80000;
    if (level.start < 0 || level.goal < 0) return null;
    const start = E.initState(level);
    let frontier = [start];
    const seen = new Set([keyOf(start)]);
    let depth = 0;

    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        for (let d = 0; d < 4; d++) {
          const r = E.simulate(level, s, d);
          if (!r.moved) continue;
          if (r.outcome === 'fall' || r.outcome === 'loop') continue;
          if (r.outcome === 'win') return { par: depth + 1, capped: false };
          const k = keyOf(r.state);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(r.state);
          if (seen.size > cap) return { par: null, capped: true };
        }
      }
      frontier = next;
      depth++;
      if (depth > 64) return { par: null, capped: true };
    }
    return null; // 解なし
  }

  /**
   * 不可解の原因を切り分ける。エディタの検証メッセージ用。
   * 返り値 status:
   *  'ok'          解けて PAR>=3        → { status, par }
   *  'too_easy'    解けるが PAR<3       → { status, par }
   *  'no_stop'     ゴールは通れるが止まれない
   *  'unreachable' ゴールへ滑り着けない
   *  'too_complex' 状態数が多すぎて検証不能
   */
  function diagnose(level, cap) {
    cap = cap || 120000;
    if (level.start < 0 || level.goal < 0) return { status: 'unreachable' };
    const start = E.initState(level);
    let frontier = [start];
    const seen = new Set([keyOf(start)]);
    let depth = 0;
    let reachedGoalCell = false;
    let capped = false;

    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        for (let d = 0; d < 4; d++) {
          const r = E.simulate(level, s, d);
          if (!r.moved) continue;
          if (!reachedGoalCell) {
            for (const seg of r.segments) {
              if (E.cellOnSegment(seg.from, seg.to, level.goal, level.w)) { reachedGoalCell = true; break; }
            }
          }
          if (r.outcome === 'fall' || r.outcome === 'loop') continue;
          if (r.outcome === 'win') return { status: depth + 1 < 3 ? 'too_easy' : 'ok', par: depth + 1 };
          const k = keyOf(r.state);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(r.state);
          if (seen.size > cap) { capped = true; break; }
        }
        if (capped) break;
      }
      if (capped) break;
      frontier = next;
      depth++;
      if (depth > 64) { capped = true; break; }
    }
    if (capped) return { status: 'too_complex' };
    return { status: reachedGoalCell ? 'no_stop' : 'unreachable' };
  }

  /**
   * 最短手数とその手順(方向列)を返す。
   *  - 解あり: { par, dirs, capped:false } / 打切: { par:null, capped:true } / 解なし: null
   */
  function solvePath(level, cap) {
    cap = cap || 80000;
    if (level.start < 0 || level.goal < 0) return null;
    const start = E.initState(level);
    const nodes = [{ s: start, parent: -1, dir: -1 }];
    const seen = new Set([keyOf(start)]);
    let qi = 0;
    while (qi < nodes.length) {
      const node = nodes[qi];
      for (let d = 0; d < 4; d++) {
        const r = E.simulate(level, node.s, d);
        if (!r.moved) continue;
        if (r.outcome === 'fall' || r.outcome === 'loop') continue;
        if (r.outcome === 'win') {
          const dirs = [d];
          let p = qi;
          while (nodes[p].parent !== -1) { dirs.unshift(nodes[p].dir); p = nodes[p].parent; }
          return { par: dirs.length, dirs, capped: false };
        }
        const k = keyOf(r.state);
        if (seen.has(k)) continue;
        seen.add(k);
        nodes.push({ s: r.state, parent: qi, dir: d });
        if (seen.size > cap) return { par: null, capped: true };
      }
      qi++;
    }
    return null;
  }

  g.TSR.Solver = { solve, solvePath, diagnose };
})(typeof window !== 'undefined' ? window : globalThis);
