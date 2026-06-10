/* ツルリン — ui.js
 * 盤面レンダラー(DOM + インラインSVG)、滑走アニメーション、効果音。
 */
(function (g) {
  'use strict';
  const E = g.TSR.Engine;
  const T = E.T;

  /* ============================== SVG スプライト ============================== */
  const SVG = {};

  SVG.penguin = () => `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <ellipse cx="50" cy="93" rx="24" ry="5" fill="rgba(24,42,70,.18)"/>
  <ellipse cx="40" cy="88" rx="9" ry="4.5" fill="#FF8A3D"/>
  <ellipse cx="60" cy="88" rx="9" ry="4.5" fill="#FF8A3D"/>
  <path d="M50 12 C72 12 80 32 80 56 C80 78 67 90 50 90 C33 90 20 78 20 56 C20 32 28 12 50 12 Z" fill="#1B2A44"/>
  <path d="M50 30 C64 30 70 44 70 62 C70 78 61 86 50 86 C39 86 30 78 30 62 C30 44 36 30 50 30 Z" fill="#F7FBFF"/>
  <ellipse cx="17" cy="56" rx="6.5" ry="15" fill="#1B2A44" transform="rotate(14 17 56)"/>
  <ellipse cx="83" cy="56" rx="6.5" ry="15" fill="#1B2A44" transform="rotate(-14 83 56)"/>
  <circle cx="40" cy="34" r="5.5" fill="#fff"/><circle cx="60" cy="34" r="5.5" fill="#fff"/>
  <circle cx="41.5" cy="35" r="2.6" fill="#10182B"/><circle cx="58.5" cy="35" r="2.6" fill="#10182B"/>
  <circle cx="43" cy="33.5" r="0.9" fill="#fff"/><circle cx="60" cy="33.5" r="0.9" fill="#fff"/>
  <circle cx="31" cy="43" r="3.6" fill="#FFB3A0" opacity=".75"/><circle cx="69" cy="43" r="3.6" fill="#FFB3A0" opacity=".75"/>
  <path d="M44 42 L56 42 L50 51 Z" fill="#FF8A3D"/>
  <path d="M44 42 L56 42 L50 45.5 Z" fill="#E96F1F"/>
</svg>`;

  SVG.rock = () => `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <ellipse cx="50" cy="86" rx="36" ry="8" fill="rgba(24,42,70,.16)"/>
  <path d="M16 80 L11 50 L30 26 L54 18 L80 30 L90 58 L81 80 Z" fill="#67788E"/>
  <path d="M30 26 L54 18 L80 30 L63 40 L38 38 Z" fill="#8A9BB0"/>
  <path d="M33 25 L54 18 L77 28 L62 35 L41 34 Z" fill="#F2F7FB"/>
  <path d="M11 50 L30 26 L38 38 L24 58 Z" fill="#576A82" opacity=".8"/>
</svg>`;

  SVG.hole = () => `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <ellipse cx="50" cy="55" rx="34" ry="25" fill="#9FBDD4"/>
  <ellipse cx="50" cy="53.5" rx="29" ry="20.5" fill="#E8F3FB"/>
  <ellipse cx="50" cy="57" rx="29" ry="20.5" fill="#16263D"/>
  <ellipse cx="50" cy="61" rx="21" ry="12" fill="#0C1626"/>
</svg>`;

  SVG.holeFilled = () => `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <ellipse cx="50" cy="56" rx="34" ry="26" fill="#9FBDD4"/>
  <ellipse cx="50" cy="55" rx="29" ry="21" fill="#BFD9EC"/>
  <rect x="28" y="36" width="44" height="38" rx="8" fill="#A8D4EE"/>
  <rect x="28" y="36" width="44" height="14" rx="7" fill="#D6EDFB"/>
  <path d="M36 58 L46 66 M58 52 L66 62" stroke="#7FB4D6" stroke-width="3" stroke-linecap="round"/>
</svg>`;

  SVG.sand = () => `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect x="10" y="12" width="80" height="76" rx="16" fill="#E8CD94"/>
  <rect x="10" y="12" width="80" height="20" rx="10" fill="#F2DFB4"/>
  <circle cx="32" cy="46" r="3" fill="#C9A968"/><circle cx="58" cy="38" r="2.5" fill="#C9A968"/>
  <circle cx="70" cy="60" r="3" fill="#C9A968"/><circle cx="42" cy="68" r="2.5" fill="#C9A968"/>
  <circle cx="26" cy="70" r="2" fill="#C9A968"/><circle cx="62" cy="76" r="2" fill="#C9A968"/>
</svg>`;

  SVG.arrow = (dir) => {
    const rot = { 0: 180, 1: 270, 2: 0, 3: 90 }[dir]; // chevron は下向き基準
    return `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <g transform="rotate(${rot} 50 50)">
    <path d="M28 26 L50 46 L72 26" stroke="#2F7CC4" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".4"/>
    <path d="M28 48 L50 68 L72 48" stroke="#2F7CC4" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
  };

  SVG.crystal = () => `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <ellipse cx="50" cy="88" rx="20" ry="5" fill="rgba(24,42,70,.15)"/>
  <path d="M50 10 L80 42 L50 88 L20 42 Z" fill="#5FC6E8"/>
  <path d="M50 10 L80 42 L50 53 Z" fill="#9ADFF5"/>
  <path d="M50 10 L20 42 L50 53 Z" fill="#C9F0FB"/>
  <path d="M20 42 L50 88 L50 53 Z" fill="#3FA8D2"/>
  <path d="M64 20 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#fff" opacity=".95"/>
</svg>`;

  SVG.goal = () => `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="60" r="30" fill="none" stroke="#FF8A3D" stroke-width="5" stroke-dasharray="10 9" opacity=".85"/>
  <ellipse cx="50" cy="84" rx="16" ry="4.5" fill="rgba(24,42,70,.18)"/>
  <rect x="47" y="20" width="6" height="64" rx="3" fill="#1B2A44"/>
  <path d="M53 22 L86 32 L53 44 Z" fill="#FF8A3D"/>
  <path d="M53 22 L86 32 L53 33 Z" fill="#FFB37A"/>
</svg>`;

  SVG.block = () => `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <ellipse cx="50" cy="90" rx="28" ry="6" fill="rgba(24,42,70,.16)"/>
  <rect x="16" y="14" width="68" height="68" rx="14" fill="#A8D4EE" opacity=".92"/>
  <rect x="16" y="14" width="68" height="24" rx="12" fill="#D6EDFB"/>
  <rect x="22" y="20" width="14" height="9" rx="4.5" fill="#fff" opacity=".95"/>
  <path d="M30 56 L42 68 M58 44 L70 56" stroke="#7FB4D6" stroke-width="4" stroke-linecap="round" opacity=".8"/>
  <rect x="16" y="14" width="68" height="68" rx="14" fill="none" stroke="#7FB4D6" stroke-width="3"/>
</svg>`;

  SVG.startMark = () => `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="26" fill="none" stroke="#9FBDD4" stroke-width="4" stroke-dasharray="6 7"/>
</svg>`;

  // UIアイコン(絵文字の代替)
  SVG.soundOn = () => `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/>
  <path d="M16.5 8.5a5 5 0 0 1 0 7"/>
  <path d="M19 6a8.5 8.5 0 0 1 0 12"/>
</svg>`;
  SVG.soundOff = () => `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/>
  <path d="M16 9.5l5 5M21 9.5l-5 5"/>
</svg>`;
  SVG.crystalMini = () => `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2 L19 10 L12 22 L5 10 Z" fill="#5FC6E8"/>
  <path d="M12 2 L19 10 L12 12 Z" fill="#9ADFF5"/>
  <path d="M12 2 L5 10 L12 12 Z" fill="#C9F0FB"/>
</svg>`;
  SVG.iceBroken = () => `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <ellipse cx="50" cy="86" rx="30" ry="6" fill="rgba(24,42,70,.12)"/>
  <path d="M22 30 L46 22 L52 40 L34 50 Z" fill="#A8D4EE"/>
  <path d="M46 22 L74 32 L66 52 L52 40 Z" fill="#C2E2F4"/>
  <path d="M34 50 L52 40 L50 70 L30 64 Z" fill="#8FC4E4"/>
  <path d="M52 40 L66 52 L62 74 L50 70 Z" fill="#A8D4EE"/>
  <path d="M22 30 L46 22 M46 22 L52 40 M52 40 L34 50 M52 40 L66 52 M50 70 L52 40" stroke="#F7FBFF" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>
</svg>`;

  // パレット/凡例用にタイル種別 → SVG
  function tileSVG(t) {
    switch (t) {
      case T.WALL: return SVG.rock();
      case T.HOLE: return SVG.hole();
      case T.SAND: return SVG.sand();
      case T.AU: case T.AR: case T.AD: case T.AL: return SVG.arrow(E.ARROW_DIR[t]);
      case T.CRYSTAL: return SVG.crystal();
      case T.BLOCK: return SVG.block();
      case T.START: return SVG.penguin();
      case T.GOAL: return SVG.goal();
      default: return '';
    }
  }

  /* ============================== サウンド(WebAudio合成) ============================== */
  const Sound = {
    ctx: null,
    enabled: true,
    init() {
      if (this.ctx) return;
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    },
    tone(freq, dur, type, vol, slideTo) {
      if (!this.enabled || !this.ctx) return;
      const c = this.ctx, t0 = c.currentTime;
      const o = c.createOscillator(), gn = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gn.gain.setValueAtTime(vol || 0.12, t0);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(gn).connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
    play(name) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      switch (name) {
        case 'slide': this.tone(620, 0.10, 'sine', 0.05, 880); break;
        case 'stop': this.tone(180, 0.07, 'square', 0.10); break;
        case 'push': this.tone(120, 0.09, 'square', 0.13); break;
        case 'pick': this.tone(880, 0.09, 'sine', 0.12, 1320); setTimeout(() => this.tone(1320, 0.10, 'sine', 0.10, 1760), 70); break;
        case 'fall': this.tone(320, 0.35, 'sawtooth', 0.10, 70); break;
        case 'loop': this.tone(440, 0.12, 'triangle', 0.10, 520); setTimeout(() => this.tone(520, 0.12, 'triangle', 0.10, 440), 130); setTimeout(() => this.tone(440, 0.16, 'triangle', 0.09, 300), 260); break;
        case 'win': [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.13), i * 95)); break;
        case 'stamp': this.tone(90, 0.12, 'square', 0.18); this.tone(50, 0.18, 'sine', 0.16); break;
        case 'beat': this.tone(740, 0.2, 'triangle', 0.1, 1480); setTimeout(() => this.tone(1480, 0.25, 'triangle', 0.12, 1960), 150); break;
      }
    },
  };

  /* ============================== レンダラー ============================== */
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class Renderer {
    constructor(boardEl) {
      this.boardEl = boardEl;
      this.level = null;
      this.cellEls = [];
      this.crystalEls = new Map();
      this.blockEls = [];
      this.penguinEl = null;
      this.onResize = () => this.fit();
      window.addEventListener('resize', this.onResize);
    }

    destroy() { window.removeEventListener('resize', this.onResize); }

    fit() {
      if (!this.level) return;
      const w = this.level.w, h = this.level.h;
      const wrap = this.boardEl.closest('.board-wrap') || this.boardEl.parentElement;
      const avail = Math.max(180, (wrap ? wrap.clientWidth : 320) - 24); // 枠のpadding分を引く
      const cs = Math.floor(Math.min(avail / w, 480 / w, 56));
      this.boardEl.style.setProperty('--cs', cs + 'px');
      this.boardEl.style.setProperty('--bw', w);
      this.boardEl.style.setProperty('--bh', h);
    }

    setLevel(level, opts) {
      opts = opts || {};
      this.level = level;
      const { w, h } = level;
      this.boardEl.innerHTML = '';
      this.boardEl.classList.toggle('editor-mode', !!opts.editor);
      this.fit();

      const grid = document.createElement('div');
      grid.className = 'grid-layer';
      this.cellEls = [];
      for (let i = 0; i < w * h; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell sheen-' + ((i * 7 + ((i / w) | 0) * 3) % 4);
        cell.dataset.i = i;
        const t = level.grid[i];
        if (t === T.WALL) { cell.classList.add('t-wall'); cell.innerHTML = SVG.rock(); }
        else if (t === T.HOLE) { cell.classList.add('t-hole'); cell.innerHTML = SVG.hole(); }
        else if (t === T.SAND) { cell.classList.add('t-sand'); cell.innerHTML = SVG.sand(); }
        else if (t >= T.AU && t <= T.AL) { cell.classList.add('t-arrow'); cell.innerHTML = SVG.arrow(E.ARROW_DIR[t]); }
        else if (t === T.GOAL) { cell.classList.add('t-goal'); cell.innerHTML = SVG.goal(); }
        if (i === level.start && !opts.editor) {
          const m = document.createElement('div');
          m.className = 'start-mark';
          m.innerHTML = SVG.startMark();
          cell.appendChild(m);
        }
        grid.appendChild(cell);
        this.cellEls.push(cell);
      }
      this.boardEl.appendChild(grid);

      const spr = document.createElement('div');
      spr.className = 'sprite-layer';
      this.spriteLayer = spr;
      this.crystalEls = new Map();
      for (const c of level.crystals) {
        const el = document.createElement('div');
        el.className = 'sprite crystal';
        el.innerHTML = SVG.crystal();
        this.place(el, c);
        spr.appendChild(el);
        this.crystalEls.set(c, el);
      }
      this.blockEls = [];
      for (const b of level.blocks) {
        const el = document.createElement('div');
        el.className = 'sprite block';
        el.innerHTML = SVG.block();
        this.place(el, b);
        spr.appendChild(el);
        this.blockEls.push(el);
      }
      if (!opts.editor) {
        const p = document.createElement('div');
        p.className = 'sprite penguin';
        p.innerHTML = SVG.penguin();
        this.place(p, level.start);
        spr.appendChild(p);
        this.penguinEl = p;
      }
      this.boardEl.appendChild(spr);
    }

    place(el, cell, animateMs) {
      const w = this.level.w;
      const x = cell % w, y = (cell - x) / w;
      el.style.transitionDuration = (animateMs || 0) + 'ms';
      el.style.transform = `translate(calc(${x} * var(--cs)), calc(${y} * var(--cs)))`;
    }

    /** 状態を即時反映(アニメなし)— リセット/アンドゥ用 */
    refresh(state) {
      const lv = this.level;
      lv.crystals.forEach((c, i) => {
        const el = this.crystalEls.get(c);
        if (!el) return;
        el.classList.remove('picked'); // 回収アニメの残留を解除(リセット/アンドゥ時)
        el.classList.toggle('hidden', ((state.got >> i) & 1) === 1);
      });
      state.blocks.forEach((b, i) => {
        const el = this.blockEls[i];
        if (!el) return;
        el.classList.remove('sunk'); // 落下アニメの残留を解除
        if (b === -1) el.classList.add('hidden');
        else { el.classList.remove('hidden'); this.place(el, b, 0); }
      });
      lv.holes.forEach((hc, i) => {
        const filledNow = ((state.filled >> i) & 1) === 1;
        const cell = this.cellEls[hc];
        if (filledNow && !cell.classList.contains('filled')) {
          cell.classList.add('filled');
          cell.innerHTML = SVG.holeFilled();
        } else if (!filledNow && cell.classList.contains('filled')) {
          cell.classList.remove('filled');
          cell.innerHTML = SVG.hole();
        }
      });
      if (this.penguinEl) {
        this.penguinEl.className = 'sprite penguin';
        this.penguinEl.style.opacity = '';
        this.place(this.penguinEl, state.pos, 0);
      }
    }

    animateTo(el, cell, ms) {
      return new Promise((resolve) => {
        if (ms <= 0 || reduceMotion()) { this.place(el, cell, 0); resolve(); return; }
        let done = false;
        const finish = () => { if (!done) { done = true; el.removeEventListener('transitionend', finish); resolve(); } };
        el.addEventListener('transitionend', finish);
        setTimeout(finish, ms + 120);
        requestAnimationFrame(() => this.place(el, cell, ms));
      });
    }

    durFor(len) { return reduceMotion() ? 0 : Math.min(70 + len * 62, 480); }

    spray(cell, dir) {
      if (reduceMotion()) return;
      const w = this.level.w;
      const x = cell % w, y = (cell - x) / w;
      const s = document.createElement('div');
      s.className = 'spray d' + dir;
      s.style.transform = `translate(calc(${x} * var(--cs)), calc(${y} * var(--cs)))`;
      s.innerHTML = '<i></i><i></i><i></i>';
      this.spriteLayer.appendChild(s);
      setTimeout(() => s.remove(), 500);
    }

    setPenguinDir(dir) {
      if (!this.penguinEl) return;
      this.penguinEl.classList.remove('lean-0', 'lean-1', 'lean-2', 'lean-3');
      this.penguinEl.classList.add('lean-' + dir);
    }

    /** simulate の結果を演出付きで再生 */
    async playMove(result) {
      const lv = this.level;
      // クリスタル消滅予約
      let elapsed = 0;
      const schedule = [];
      for (const seg of result.segments) {
        const dur = this.durFor(seg.len);
        for (const p of result.pickups) {
          // この区間内で通過するか
          if (this.cellInSegment(p.cell, seg)) {
            const stepInSeg = this.stepsBetween(seg.from, p.cell);
            schedule.push({ cell: p.cell, at: elapsed + (seg.len ? (stepInSeg / seg.len) * dur : 0) });
          }
        }
        elapsed += dur;
      }
      for (const s of schedule) {
        setTimeout(() => {
          const el = this.crystalEls.get(s.cell);
          if (el) { el.classList.add('picked'); Sound.play('pick'); setTimeout(() => el.classList.add('hidden'), 240); }
        }, s.at);
      }

      // ペンギン滑走
      Sound.play('slide');
      for (const seg of result.segments) {
        this.setPenguinDir(seg.dir);
        this.penguinEl.classList.add('sliding');
        await this.animateTo(this.penguinEl, seg.to, this.durFor(seg.len));
      }
      this.penguinEl.classList.remove('sliding');

      // 氷塊プッシュ
      if (result.push) {
        Sound.play('push');
        const el = this.blockEls[result.push.bi];
        for (const seg of result.push.segs) {
          await this.animateTo(el, seg.to, this.durFor(this.stepsBetween(seg.from, seg.to)));
        }
        if (result.push.fell != null) {
          el.classList.add('sunk');
          await wait(220);
          el.classList.add('hidden');
          const hi = result.push.fell;
          const cellEl = this.cellEls[hi];
          cellEl.classList.add('filled');
          cellEl.innerHTML = SVG.holeFilled();
          Sound.play('stop');
        } else {
          Sound.play('stop');
        }
      }

      // 結末演出
      if (result.outcome === 'fall') {
        Sound.play('fall');
        this.penguinEl.classList.add('falling');
        await wait(reduceMotion() ? 60 : 520);
      } else if (result.outcome === 'loop') {
        Sound.play('loop');
        this.penguinEl.classList.add('dizzy');
        await wait(reduceMotion() ? 60 : 700);
      } else {
        this.spray(result.state.pos, result.dirFinal);
        if (!result.push) Sound.play('stop');
        if (result.outcome === 'win') {
          this.penguinEl.classList.add('happy');
        }
      }
    }

    cellInSegment(cell, seg) {
      const w = this.level.w;
      const cx = cell % w, cy = (cell - cx) / w;
      const fx = seg.from % w, fy = (seg.from - fx) / w;
      const tx = seg.to % w, ty = (seg.to - tx) / w;
      if (fx === tx && cx === fx) return cy > Math.min(fy, ty) - 1 && cy <= Math.max(fy, ty) && cy >= Math.min(fy, ty);
      if (fy === ty && cy === fy) return cx >= Math.min(fx, tx) && cx <= Math.max(fx, tx);
      return false;
    }
    stepsBetween(a, b) {
      const w = this.level.w;
      return Math.abs((a % w) - (b % w)) + Math.abs(((a / w) | 0) - ((b / w) | 0));
    }
  }

  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  g.TSR.UI = { SVG, tileSVG, Sound, Renderer, wait, reduceMotion };
})(typeof window !== 'undefined' ? window : globalThis);
