/* ツルリン — main.js
 * アプリ全体の進行: ルーティング、ゲーム進行、デイリー記録、挑戦状、エディタ、共有。
 */
(function () {
  'use strict';
  const E = TSR.Engine, S = TSR.Solver, C = TSR.Codec, D = TSR.Daily, UI = TSR.UI;
  const T = E.T;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------------- ストレージ ---------------- */
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const K = {
    daily: 'tsururin.daily.v1',
    sound: 'tsururin.sound.v1',
    draft: 'tsururin.editor.draft.v1',
    name: 'tsururin.author.name.v1',
    visited: 'tsururin.visited.v1',
    stages: 'tsururin.stages.v1',
  };

  /* ---------------- 共通UI ---------------- */
  let toastTimer = null;
  function toast(msg, ms) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2200);
  }

  function showStamp(big, sub, cls) {
    const layer = $('#stampLayer');
    layer.innerHTML = `<div class="stamp ${cls || ''}"><div class="big">${esc(big)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;
    UI.Sound.play('stamp');
  }
  function clearStamp() { $('#stampLayer').innerHTML = ''; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function baseUrl() {
    return location.origin === 'null' || location.protocol === 'file:'
      ? location.href.split('#')[0]
      : location.origin + location.pathname;
  }

  /* ---------------- ビュー切替 ---------------- */
  const views = ['view-game', 'view-editor', 'view-how', 'view-error', 'view-stages'];
  function showView(id) {
    for (const v of views) $('#' + v).hidden = (v !== id);
    window.scrollTo({ top: 0 });
  }
  function setTab(name) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.nav === name));
  }

  /* ---------------- ゲームコントローラ ---------------- */
  const renderer = new UI.Renderer($('#board'));
  let game = null;
  let dailyCache = null; // {dateKey, gen}

  function startGame(ctx) {
    game = {
      ctx,
      level: ctx.level,
      state: E.initState(ctx.level),
      moves: 0, fails: 0,
      busy: false, won: false,
      undoSnap: null,
    };
    renderer.setLevel(ctx.level);
    renderer.refresh(game.state);
    clearStamp();
    $('#resultCard').hidden = true;
    $('#resultCard').innerHTML = '';
    $('#view-game').classList.remove('won');
    updateMeta();
    updateHUD();
  }

  function updateMeta() {
    const m = $('#gameMeta');
    if (!game) { m.innerHTML = ''; return; }
    const c = game.ctx;
    if (c.mode === 'daily') {
      const done = getDailyRecord(c.info.key);
      m.innerHTML = `<span class="badge">きょうの問題</span>
        <span class="num">#${c.info.number}</span>
        <span>${esc(c.info.label)}</span>
        <span>PAR <span class="num">${c.par}</span></span>
        ${done ? '<span class="badge warn">クリア済み</span>' : ''}`;
    } else if (c.mode === 'challenge') {
      const who = c.authorName ? `「${esc(c.authorName)}」さん` : 'なぞの作者';
      m.innerHTML = `<span class="badge warn">挑戦状</span>
        <span>${who}の記録 <span class="num">${c.authorMoves}</span> 手 — 超えられる?</span>`;
    } else if (c.mode === 'stage') {
      const nt = D.NEW_TILES[c.stageN];
      m.innerHTML = `<span class="badge">ステージ</span>
        <span class="num">${c.stageN}</span><span style="opacity:.55">/ ${D.STAGE_MAX}</span>
        <span>PAR <span class="num">${c.par}</span></span>
        ${nt ? `<span class="badge warn">NEW ${esc(nt.name)}</span>` : ''}`;
    } else if (c.mode === 'practice') {
      m.innerHTML = `<span class="badge">れんしゅう</span><span>おてほんは <span class="num">2</span> 手。まずは滑ってみよう</span>`;
    } else if (c.mode === 'test') {
      m.innerHTML = `<span class="badge warn">テストプレイ</span><span>クリアすると公開できます</span>`;
    }
  }

  function updateHUD() {
    const h = $('#hud');
    if (!game) { h.innerHTML = ''; return; }
    const c = game.ctx;
    let chips = '';
    if (c.mode === 'daily' || c.mode === 'practice' || c.mode === 'stage') {
      chips += `<div class="chip">手数 <b>${game.moves}</b>/<b>${c.par}</b></div>`;
    } else if (c.mode === 'challenge') {
      chips += `<div class="chip">手数 <b>${game.moves}</b> <span style="opacity:.6">/ 作者</span> <b>${c.authorMoves}</b></div>`;
    } else {
      chips += `<div class="chip">手数 <b>${game.moves}</b></div>`;
    }
    if (game.level.crystals.length) {
      const got = popcount(game.state.got);
      chips += `<div class="chip"><span class="chip-ic">${UI.SVG.crystalMini()}</span><b>${got}</b>/<b>${game.level.crystals.length}</b></div>`;
    }
    if (game.fails > 0) chips += `<div class="chip alert">おちた <b>×${game.fails}</b></div>`;
    h.innerHTML = chips;
  }

  function popcount(n) { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; }

  async function doMove(dir) {
    if (!game || game.busy || game.won) return;
    UI.Sound.init();
    const r = E.simulate(game.level, game.state, dir);
    if (!r.moved) return;
    game.busy = true;
    game.undoSnap = { state: E.cloneState(game.state), moves: game.moves };
    game.moves++;
    updateHUD();
    await renderer.playMove(r);

    if (r.outcome === 'fall' || r.outcome === 'loop') {
      game.fails++;
      game.undoSnap = null;
      toast(r.outcome === 'fall' ? '穴に落ちた! はじめから' : 'ぐるぐる… 無限ループ! はじめから');
      await UI.wait(280);
      game.state = E.initState(game.level);
      game.moves = 0;
      renderer.refresh(game.state);
    } else {
      game.state = r.state;
      if (r.goalLocked) toast('クリスタルをぜんぶ集めないとゴールは開きません');
      if (r.outcome === 'win') {
        game.won = true;
        onWin();
      }
    }
    updateHUD();
    game.busy = false;
  }

  function undo() {
    if (!game || game.busy || game.won || !game.undoSnap) return;
    game.state = game.undoSnap.state;
    game.moves = game.undoSnap.moves;
    game.undoSnap = null;
    renderer.refresh(game.state);
    updateHUD();
    toast('1手もどした');
  }

  function resetBoard() {
    if (!game || game.busy || game.won) return;
    game.state = E.initState(game.level);
    game.moves = 0;
    game.undoSnap = null;
    renderer.refresh(game.state);
    updateHUD();
  }

  /* ---------------- 勝利処理 ---------------- */
  function onWin() {
    $('#view-game').classList.add('won');
    setTimeout(() => {
      const card = $('#resultCard');
      if (!card.hidden) {
        try { card.scrollIntoView({ behavior: UI.reduceMotion() ? 'auto' : 'smooth', block: 'center' }); } catch (e) {}
      }
    }, 450); // スタンプ演出をひと呼吸見せてから
    const c = game.ctx;
    if (c.mode === 'daily') return winDaily();
    if (c.mode === 'stage') return winStage();
    if (c.mode === 'challenge') return winChallenge();
    if (c.mode === 'practice') return winPractice();
    if (c.mode === 'test') return winTest();
  }

  function getDailyRecord(key) {
    const all = store.get(K.daily, {});
    return all[key] || null;
  }

  function calcStreak(uptoKey) {
    const all = store.get(K.daily, {});
    let n = 0;
    let [y, m, d] = uptoKey.split('-').map(Number);
    let t = Date.UTC(y, m - 1, d);
    for (;;) {
      const dt = new Date(t);
      const key = dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
      if (!all[key]) break;
      n++;
      t -= 86400e3;
    }
    return n;
  }

  function dailyTier(moves, par) {
    if (moves <= par) return { stamp: 'PAR 達成', sub: 'PERFECT', cls: '', perfect: true };
    return { stamp: 'クリア', sub: '+' + (moves - par), cls: 'blue', perfect: false };
  }

  function winDaily() {
    const c = game.ctx;
    const key = c.info.key;
    const already = getDailyRecord(key);
    let rec;
    if (!already) {
      rec = { moves: game.moves, par: c.par, fails: game.fails };
      const all = store.get(K.daily, {});
      all[key] = rec;
      store.set(K.daily, all);
    } else {
      rec = already;
    }
    const shown = already ? { moves: game.moves } : rec;
    const tier = dailyTier(shown.moves, c.par);
    showStamp(tier.stamp, tier.sub, tier.cls);
    UI.Sound.play('win');

    const streak = calcStreak(key);
    const text = dailyShareText(c.info, rec, streak);
    const note = already ? '<div class="result-sub">きょうの記録はクリア済み。これは参考記録です</div>' : '';
    $('#resultCard').innerHTML = `
      <div class="result-title">${tier.perfect ? '最短手数でクリア' : 'クリア'}</div>
      ${note}
      <div class="result-stats">
        <span><b>${shown.moves}</b>手</span>
        <span><b>${c.par}</b>PAR</span>
      </div>
      ${streak > 1 ? `<div class="streak-line">${streak}日連続クリア中</div>` : ''}
      <div class="share-preview">${esc(text)}</div>
      <div class="share-row">
        <a class="btn primary" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(text)}">Xでじまんする</a>
        <button class="btn" data-act="copy-share">コピー</button>
        <button class="btn" data-act="retry">もう一回</button>
        <button class="btn dark" data-act="go-make">挑戦状をつくる</button>
      </div>`;
    $('#resultCard').hidden = false;
    bindResultActions(text);
  }

  function dailyShareText(info, rec, streak) {
    const perfect = rec.moves <= rec.par;
    const lines = [
      `ツルリン #${info.number}${perfect ? ' PAR達成' : ''}`,
      `${rec.moves}手 / PAR ${rec.par}`,
    ];
    if (streak > 1) lines.push(`${streak}日連続クリア中`);
    lines.push(baseUrl());
    return lines.join('\n');
  }

  function winChallenge() {
    const c = game.ctx;
    const am = c.authorMoves, mv = game.moves;
    const who = c.authorName ? `「${c.authorName}」さん` : '作者';
    let verdict, stamp, cls, line;
    if (mv < am) {
      verdict = '作者超え!'; stamp = '作者超え!'; cls = '';
      line = `${who}の記録を ${am - mv} 手も短縮! 完全勝利だ`; UI.Sound.play('beat');
    } else if (mv === am) {
      verdict = '引き分け'; stamp = '引き分け'; cls = 'blue';
      line = `${who}と同じ手数。実力は互角…!`; UI.Sound.play('win');
    } else {
      verdict = 'クリア'; stamp = 'クリア'; cls = 'ok';
      line = `クリア! でも${who}はあと ${mv - am} 手みじかい。リベンジする?`; UI.Sound.play('win');
    }
    showStamp(stamp, mv + '手 / 作者 ' + am + '手', cls);
    const text = challengeShareText(c, mv);
    $('#resultCard').innerHTML = `
      <div class="result-title">${esc(verdict)}</div>
      <div class="result-sub">${esc(line)}</div>
      <div class="result-stats">
        <span><b>${mv}</b>あなた</span>
        <span><b>${am}</b>作者</span>
      </div>
      <div class="share-preview">${esc(text)}</div>
      <div class="share-row">
        <a class="btn primary" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(text)}">Xで結果をいう</a>
        <button class="btn" data-act="copy-share">コピー</button>
        <button class="btn" data-act="retry">もう一回</button>
        <button class="btn dark" data-act="go-make">仕返しの挑戦状をつくる</button>
      </div>`;
    $('#resultCard').hidden = false;
    bindResultActions(text);
  }

  function challengeShareText(c, mv) {
    const who = c.authorName ? `「${c.authorName}」さん` : 'なぞの作者';
    const url = c.url;
    if (mv < c.authorMoves) return `${who}の挑戦状で「作者超え」達成\n${mv}手(作者 ${c.authorMoves}手)\nあなたも挑戦 → ${url}`;
    if (mv === c.authorMoves) return `${who}の挑戦状と引き分け\n${mv}手(作者と同記録)\nあなたは超えられる? → ${url}`;
    return `${who}の挑戦状を ${mv}手でクリア(作者は ${c.authorMoves}手)\nだれか作者を倒して → ${url}`;
  }

  /* ---------------- ステージモード ---------------- */
  const stageCache = new Map();

  function stageProgress() { return store.get(K.stages, {}); }
  function stageUnlocked(n) {
    if (n <= D.CHECKPOINT) return true; // 最初のブロックは全開放
    const prog = stageProgress();
    const cp = Math.floor((n - 1) / D.CHECKPOINT) * D.CHECKPOINT; // 直前のチェックポイント
    return !!prog[cp] || !!prog[n - 1];
  }
  function stageGen(n) {
    if (!stageCache.has(n)) stageCache.set(n, D.generateStage(n));
    return stageCache.get(n);
  }

  function showStages() {
    setTab('stages');
    showView('view-stages');
    document.title = 'ステージ | ツルリン';
    const prog = stageProgress();
    const grid = $('#stageGrid');
    let html = '';
    for (let n = 1; n <= D.STAGE_MAX; n++) {
      const rec = prog[n];
      const open = stageUnlocked(n);
      const perfect = rec && rec.moves <= rec.par;
      const isCp = n % D.CHECKPOINT === 0;
      const cls = (rec ? (perfect ? 'perfect' : 'cleared') : (open ? 'open' : 'locked')) + (isCp ? ' cp' : '');
      const nt = D.NEW_TILES[n];
      html += `<button type="button" class="stage-btn ${cls}" data-n="${n}" ${open ? '' : 'disabled'}
        aria-label="ステージ${n}${isCp ? '(チェックポイント)' : ''}${rec ? ' クリア済み' : open ? '' : ' ロック中'}">
        <span class="sn">${n}</span>
        ${perfect ? starSVG() : rec ? checkSVG() : !open ? lockSVG() : (nt ? '<span class="nb">NEW</span>' : isCp ? '<span class="nb cpb">関門</span>' : '')}
      </button>`;
    }
    grid.innerHTML = html;
    const cleared = Object.keys(prog).filter((k) => +k >= 1 && +k <= D.STAGE_MAX).length;
    $('#stageSummary').textContent = cleared > 0
      ? `${cleared} / ${D.STAGE_MAX} クリア`
      : '岩だけのやさしい盤面から、すこしずつ新しいタイルが登場します';
    $('#stageHint').textContent = cleared >= D.STAGE_MAX
      ? '全制覇おみごと。「つくる」のランダム生成で無限にあそべます'
      : '太枠は関門ステージ。クリアすると次の5ステージがまとめて解放されます';
    grid.querySelectorAll('.stage-btn:not([disabled])').forEach((b) => {
      b.addEventListener('click', () => { location.hash = '#stage=' + b.dataset.n; });
    });
  }

  function starSVG() {
    return '<svg class="st" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z" fill="currentColor"/></svg>';
  }
  function checkSVG() {
    return '<svg class="st" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function lockSVG() {
    return '<svg class="st" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';
  }

  function showStage(n) {
    if (!Number.isInteger(n) || n < 1 || n > D.STAGE_MAX) { location.hash = '#stages'; return; }
    if (!stageUnlocked(n)) {
      toast('まだロック中。ひとつ前のステージをクリアしよう');
      location.hash = '#stages';
      return;
    }
    setTab('stages');
    showView('view-game');
    const gen = stageGen(n);
    const level = E.parseLevel(gen.w, gen.h, gen.tiles);
    startGame({ mode: 'stage', level, par: gen.par, stageN: n });
    document.title = `ステージ ${n} | ツルリン`;
    const nt = D.NEW_TILES[n];
    if (nt && !stageProgress()[n]) toast(`NEW「${nt.name}」 — ${nt.desc}`, 3600);
  }

  function winStage() {
    const c = game.ctx;
    const n = c.stageN;
    const prog = stageProgress();
    const prev = prog[n];
    if (!prev || game.moves < prev.moves) {
      prog[n] = { moves: game.moves, par: c.par };
      store.set(K.stages, prog);
    }
    const best = prog[n].moves;
    const perfect = game.moves <= c.par;
    showStamp(perfect ? 'PAR 達成' : 'クリア', perfect ? 'PERFECT' : '+' + (game.moves - c.par), perfect ? '' : 'blue');
    UI.Sound.play('win');
    const last = n >= D.STAGE_MAX;
    const cpCleared = !last && n % D.CHECKPOINT === 0 && !prev;
    $('#resultCard').innerHTML = `
      <div class="result-title">${last ? '全ステージ制覇!' : perfect ? '最短手数でクリア' : 'クリア'}</div>
      ${cpCleared ? `<div class="result-sub">関門突破。ステージ${n + 1}〜${Math.min(D.STAGE_MAX, n + D.CHECKPOINT)}が解放されました</div>` : ''}
      ${prev && game.moves < prev.moves ? '<div class="result-sub">自己ベスト更新</div>' : ''}
      <div class="result-stats">
        <span><b>${game.moves}</b>手</span>
        <span><b>${c.par}</b>PAR</span>
        <span><b>${best}</b>ベスト</span>
      </div>
      <div class="share-row">
        ${last ? '' : `<button class="btn primary" data-act="next-stage">つぎのステージへ</button>`}
        ${perfect ? '' : '<button class="btn" data-act="retry">PARに再挑戦</button>'}
        <a class="btn${last ? ' primary' : ''}" href="#stages">ステージ一覧</a>
        ${last ? '<a class="btn dark" href="#make">ランダム生成であそぶ</a>' : ''}
      </div>`;
    $('#resultCard').hidden = false;
    const nx = $('#resultCard').querySelector('[data-act="next-stage"]');
    if (nx) nx.addEventListener('click', () => { location.hash = '#stage=' + (n + 1); });
    const rt = $('#resultCard').querySelector('[data-act="retry"]');
    if (rt) rt.addEventListener('click', () => { startGame(game.ctx); });
  }

  function winPractice() {
    showStamp('クリア!', 'れんしゅう完了', 'ok');
    UI.Sound.play('win');
    $('#resultCard').innerHTML = `
      <div class="result-title">コツはつかめた?</div>
      <div class="result-sub">「止まれる場所」から逆算するのがツルリンの極意</div>
      <div class="share-row">
        <a class="btn primary" href="#daily">きょうの問題に挑む</a>
        <a class="btn" href="#how">あそびかたに戻る</a>
      </div>`;
    $('#resultCard').hidden = false;
  }

  function winTest() {
    const prev = editor.authorMoves;
    editor.authorMoves = prev == null ? game.moves : Math.min(prev, game.moves);
    showStamp('クリア!', game.moves + '手で公開OK', 'ok');
    UI.Sound.play('win');
    setTimeout(() => {
      showEditor();
      toast(prev != null && game.moves < prev ? `記録更新! ${game.moves}手` : `あなたの記録: ${editor.authorMoves}手`);
    }, 1100);
  }

  function bindResultActions(shareText) {
    const card = $('#resultCard');
    const copyBtn = card.querySelector('[data-act="copy-share"]');
    if (copyBtn) copyBtn.addEventListener('click', () => copyText(shareText));
    const makeBtn = card.querySelector('[data-act="go-make"]');
    if (makeBtn) makeBtn.addEventListener('click', () => { location.hash = '#make'; });
    const retryBtn = card.querySelector('[data-act="retry"]');
    if (retryBtn) retryBtn.addEventListener('click', () => { startGame(game.ctx); });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('コピーした!');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('コピーした!'); } catch (e2) { toast('コピーできなかった…'); }
      ta.remove();
    }
  }

  /* ---------------- ルーティング ---------------- */
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith('c=')) return showChallenge(h.slice(2));
    if (h.startsWith('stage=')) return showStage(parseInt(h.slice(6), 10));
    if (h === 'stages') return showStages();
    if (h === 'make') return showEditor();
    if (h === 'how') return showHow();
    if (h === 'practice') return showPractice();
    return showDaily();
  }

  function showDaily() {
    setTab('daily');
    showView('view-game');
    const today = D.todayJST();
    if (!dailyCache || dailyCache.dateKey !== today.key) {
      dailyCache = { dateKey: today.key, gen: D.generate(today.key) };
    }
    const gen = dailyCache.gen;
    const level = E.parseLevel(gen.w, gen.h, gen.tiles);
    startGame({ mode: 'daily', level, par: gen.par, info: gen.info });
    document.title = `ツルリン #${gen.info.number} | 氷上スライドパズル挑戦状`;

    const rec = getDailyRecord(today.key);
    if (rec) {
      const streak = calcStreak(today.key);
      const text = dailyShareText(gen.info, rec, streak);
      const tier = dailyTier(rec.moves, rec.par);
      $('#resultCard').innerHTML = `
        <div class="result-title">きょうはクリア済み</div>
        <div class="result-sub">もう一度あそべます(記録は最初のクリアのまま)</div>
        <div class="result-stats">
          <span><b>${rec.moves}</b>手</span>
          <span><b>${rec.par}</b>PAR</span>
        </div>
        ${streak > 1 ? `<div class="streak-line">${streak}日連続クリア中</div>` : ''}
        <div class="share-row">
          <a class="btn primary" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(text)}">Xでじまんする</a>
          <button class="btn" data-act="copy-share">コピー</button>
        </div>`;
      $('#resultCard').hidden = false;
      bindResultActions(text);
    }
  }

  function showPractice() {
    setTab('how');
    showView('view-game');
    const p = D.PRACTICE;
    const level = E.parseLevel(p.w, p.h, p.tiles);
    startGame({ mode: 'practice', level, par: 2 });
    document.title = 'れんしゅう | ツルリン';
    toast('まずは右にスワイプしてみよう', 2800);
  }

  function showChallenge(payload) {
    setTab('');
    const dec = C.decodeChallenge(payload);
    if (dec.error) {
      showView('view-error');
      document.title = 'ツルリン';
      return;
    }
    const level = E.parseLevel(dec.w, dec.h, dec.tiles);
    const url = baseUrl() + '#c=' + payload;
    showView('view-game');
    startGame({ mode: 'challenge', level, authorMoves: dec.authorMoves, authorName: dec.name, url });
    document.title = (dec.name ? dec.name + 'さん' : 'なぞの作者') + 'からの挑戦状 | ツルリン';
    // 念のため可解性を裏で確認(改造URL対策)。PAR は表示しない。
    setTimeout(() => {
      const res = S.solve(level, 60000);
      if (!res) toast('注意: この挑戦状はクリアできない可能性があります', 3200);
    }, 50);
  }

  function showHow() {
    setTab('how');
    showView('view-how');
    document.title = 'あそびかた | ツルリン';
  }

  /* ---------------- 入力 ---------------- */
  document.addEventListener('keydown', (e) => {
    if ($('#view-game').hidden) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const map = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };
    if (map[e.key] != null) { e.preventDefault(); doMove(map[e.key]); }
    else if (e.key === 'z' || e.key === 'Z') undo();
    else if (e.key === 'r' || e.key === 'R') resetBoard();
  });

  (function setupSwipe() {
    const area = $('#board');
    let sx = 0, sy = 0, active = false;
    area.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; active = true; });
    area.addEventListener('pointerup', (e) => {
      if (!active) return;
      active = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      doMove(dir);
    });
    area.addEventListener('pointercancel', () => { active = false; });
  })();

  $$('.dpad [data-dir]').forEach((b) => b.addEventListener('click', () => doMove(+b.dataset.dir)));
  $('#btnUndo').addEventListener('click', undo);
  $('#btnReset').addEventListener('click', resetBoard);

  /* ---------------- サウンドトグル ---------------- */
  UI.Sound.enabled = store.get(K.sound, true);
  function syncSoundBtn() {
    $('#btnSound').innerHTML = UI.Sound.enabled ? UI.SVG.soundOn() : UI.SVG.soundOff();
    $('#btnSound').setAttribute('aria-label', UI.Sound.enabled ? '効果音をオフにする' : '効果音をオンにする');
    $('#btnSound').setAttribute('aria-pressed', UI.Sound.enabled ? 'true' : 'false');
  }
  $('#btnSound').addEventListener('click', () => {
    UI.Sound.enabled = !UI.Sound.enabled;
    store.set(K.sound, UI.Sound.enabled);
    syncSoundBtn();
    if (UI.Sound.enabled) UI.Sound.play('pick');
  });
  syncSoundBtn();

  /* ============================================================
     エディタ
     ============================================================ */
  const PAL = [
    { t: T.WALL, name: '岩' },
    { t: T.HOLE, name: '穴' },
    { t: T.SAND, name: '砂' },
    { t: T.AU, name: '矢印↑' },
    { t: T.AR, name: '矢印→' },
    { t: T.AD, name: '矢印↓' },
    { t: T.AL, name: '矢印←' },
    { t: T.CRYSTAL, name: 'クリスタル' },
    { t: T.BLOCK, name: '氷塊' },
    { t: T.START, name: 'スタート' },
    { t: T.GOAL, name: 'ゴール' },
    { t: -1, name: 'けす' },
  ];

  let editor = loadDraft() || newEditor(7, 7);
  let painting = false;

  function newEditor(w, h) {
    return { w, h, tiles: new Array(w * h).fill(T.ICE), tool: T.WALL, checked: false, authorMoves: null };
  }
  function loadDraft() {
    const d = store.get(K.draft, null);
    if (!d || !d.tiles || d.tiles.length !== d.w * d.h) return null;
    return Object.assign(newEditor(d.w, d.h), d, { checked: false, authorMoves: d.authorMoves || null });
  }
  function saveDraft() { store.set(K.draft, { w: editor.w, h: editor.h, tiles: editor.tiles, authorMoves: editor.authorMoves }); }

  function showEditor() {
    setTab('make');
    showView('view-editor');
    document.title = '挑戦状をつくる | ツルリン';
    renderEditorAll();
  }

  function renderEditorAll() {
    $('#edW').value = editor.w;
    $('#edH').value = editor.h;
    renderPalette();
    renderEditorBoard();
    renderEditorStatus();
  }

  function renderPalette() {
    const pal = $('#palette');
    pal.innerHTML = '';
    for (const p of PAL) {
      const b = document.createElement('button');
      b.className = 'pal-btn' + (editor.tool === p.t ? ' active' : '');
      b.type = 'button';
      b.innerHTML = (p.t === -1 ? '<span class="erase-mark">✕</span>' : UI.tileSVG(p.t)) + `<span>${p.name}</span>`;
      b.addEventListener('click', () => { editor.tool = p.t; renderPalette(); });
      pal.appendChild(b);
    }
  }

  function renderEditorBoard() {
    const el = $('#editorBoard');
    const { w, h } = editor;
    const wrap = el.closest('.editor-board-wrap');
    const avail = Math.max(180, ((wrap && wrap.clientWidth) || 344) - 24);
    const cs = Math.floor(Math.min(avail / w, 480 / w, 52));
    el.style.setProperty('--cs', cs + 'px');
    el.style.setProperty('--bw', w);
    el.style.setProperty('--bh', h);
    el.classList.add('editor-mode');
    el.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid-layer';
    for (let i = 0; i < w * h; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell sheen-' + ((i * 7 + ((i / w) | 0) * 3) % 4);
      const t = editor.tiles[i];
      if (t !== T.ICE) cell.innerHTML = UI.tileSVG(t);
      cell.dataset.i = i;
      cell.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { cell.releasePointerCapture(e.pointerId); } catch (err) {}
        painting = true; paint(i);
      });
      cell.addEventListener('pointerenter', () => { if (painting) paint(i); });
      grid.appendChild(cell);
    }
    grid.addEventListener('pointermove', (e) => {
      if (!painting) return;
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const cell = t && t.closest && t.closest('#editorBoard .cell');
      if (cell) paint(+cell.dataset.i);
    });
    el.appendChild(grid);
  }
  document.addEventListener('pointerup', () => { painting = false; });

  function paint(i) {
    const tool = editor.tool;
    const cur = editor.tiles[i];
    if (tool === -1) {
      if (cur === T.ICE) return;
      editor.tiles[i] = T.ICE;
    } else if (tool === T.START || tool === T.GOAL) {
      // 1つだけ: 既存を消して置く
      editor.tiles = editor.tiles.map((t) => (t === tool ? T.ICE : t));
      editor.tiles[i] = tool;
      painting = false;
    } else {
      if (cur === tool) return;
      editor.tiles[i] = tool;
    }
    invalidateCheck();
    saveDraft();
    renderEditorBoard();
  }

  function invalidateCheck() {
    if (editor.checked || editor.authorMoves != null) {
      editor.checked = false;
      editor.authorMoves = null;
    }
    renderEditorStatus();
  }

  function resizeEditor() {
    const w = +$('#edW').value, h = +$('#edH').value;
    const old = editor;
    const next = newEditor(w, h);
    next.tool = old.tool;
    for (let y = 0; y < Math.min(h, old.h); y++) {
      for (let x = 0; x < Math.min(w, old.w); x++) {
        next.tiles[y * w + x] = old.tiles[y * old.w + x];
      }
    }
    editor = next;
    saveDraft();
    renderEditorAll();
  }
  $('#edW').addEventListener('change', resizeEditor);
  $('#edH').addEventListener('change', resizeEditor);

  $('#btnEdRandom').addEventListener('click', () => {
    const diff = $('#edDiff').value;
    setEdStatus('生成中…', '');
    setTimeout(() => {
      const gen = D.generateRandom(editor.w, editor.h, diff);
      if (!gen) {
        return setEdStatus('うまく生成できませんでした。もう一度押すか、盤面サイズを変えてください', 'bad');
      }
      editor.tiles = gen.tiles;
      editor.checked = true;       // ソルバー検証済みで生成される
      editor.authorMoves = null;
      saveDraft();
      renderEditorBoard();
      renderEditorStatus();
      setEdStatus('できあがり(解けることは確認済み)。このままテストプレイへ。手直ししてもOK', 'ok');
    }, 30);
  });

  $('#btnEdClear').addEventListener('click', () => {
    editor.tiles = new Array(editor.w * editor.h).fill(T.ICE);
    invalidateCheck();
    saveDraft();
    renderEditorBoard();
  });

  $('#btnEdCheck').addEventListener('click', () => {
    const sp = E.countSpecials(editor.tiles);
    if (sp.starts !== 1 || sp.goals !== 1) {
      return setEdStatus('スタートとゴールを1つずつ置いてください', 'bad');
    }
    const level = E.parseLevel(editor.w, editor.h, editor.tiles);
    setEdStatus('ソルバーで確認中…', '');
    setTimeout(() => {
      const rep = S.diagnose(level, 120000);
      editor.checked = false;
      switch (rep.status) {
        case 'ok':
          editor.checked = true;
          setEdStatus('解けることを確認。テストプレイでクリアすると公開できます', 'ok');
          break;
        case 'too_easy':
          setEdStatus(`${rep.par}手で解けてしまいます。3手以上の歯ごたえがある問題だけ公開できます`, 'bad');
          break;
        case 'no_stop':
          setEdStatus('ゴールの上は通れますが、ぴったり止まれません。ゴールの「滑っていく先(裏側)」に岩か壁を置くと止まれます', 'bad');
          break;
        case 'unreachable':
          setEdStatus('スタートからゴールまで滑り着けません。途中の壁や床の配置を見直してください', 'bad');
          break;
        case 'too_complex':
          setEdStatus('複雑すぎて検証しきれません。盤面を小さくするか、ギミックを減らしてください', 'bad');
          break;
      }
      renderEditorStatus();
    }, 30);
  });

  function setEdStatus(msg, cls) {
    const el = $('#edStatus');
    el.textContent = msg;
    el.className = 'ed-status ' + (cls || '');
  }

  $('#btnEdTest').addEventListener('click', () => {
    const sp = E.countSpecials(editor.tiles);
    if (sp.starts !== 1 || sp.goals !== 1) {
      return setEdStatus('スタートとゴールを1つずつ置いてください', 'bad');
    }
    if (!editor.checked) {
      return setEdStatus('先に「とけるかチェック」をしてください', 'bad');
    }
    const level = E.parseLevel(editor.w, editor.h, editor.tiles);
    showView('view-game');
    setTab('make');
    startGame({ mode: 'test', level });
  });

  function renderEditorStatus() {
    const can = editor.authorMoves != null;
    $('#btnEdTest').disabled = !editor.checked && !can;
    const panel = $('#publishPanel');
    panel.hidden = !can;
    if (can) {
      $('#pubRec').innerHTML = `あなたの記録 <b>${editor.authorMoves}</b> 手で公開されます`;
      updatePublishUrl();
    }
  }

  function updatePublishUrl() {
    if (editor.authorMoves == null) return { url: '', text: '' };
    const name = $('#authorName').value.trim().slice(0, 12);
    store.set(K.name, name);
    const payload = C.encodeChallenge({
      w: editor.w, h: editor.h, tiles: editor.tiles,
      authorMoves: editor.authorMoves, name,
    });
    const url = baseUrl() + '#c=' + payload;
    $('#pubUrl').textContent = url;
    const text = `ツルリンで挑戦状をつくりました。\n作者記録 ${editor.authorMoves}手 — 超えられるなら超えてみて\n${url}`;
    $('#btnPubX').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text);
    return { url, text };
  }

  $('#authorName').value = store.get(K.name, '');
  $('#authorName').addEventListener('input', updatePublishUrl);
  $('#btnPubCopy').addEventListener('click', () => {
    const { text } = updatePublishUrl();
    copyText(text);
  });
  $('#btnPubRetest').addEventListener('click', () => {
    const level = E.parseLevel(editor.w, editor.h, editor.tiles);
    showView('view-game');
    startGame({ mode: 'test', level });
    toast('記録を縮めて公開URLを強くしよう');
  });

  /* ---------------- あそびかた: 凡例の注入 ---------------- */
  (function buildLegend() {
    const defs = [
      [T.WALL, '岩', 'ぶつかると止まる。基本の足場'],
      [T.HOLE, '穴', '通ると落ちて失敗。即やりなおし'],
      [T.SAND, '砂', '上に乗ると必ず止まる'],
      [T.AR, '矢印床', '通ると強制的にその方向へ滑る'],
      [T.CRYSTAL, 'クリスタル', '通過で回収。全部集めるとゴールが開く'],
      [T.BLOCK, '氷塊', '押すと滑る。穴に落とせば埋まって道になる'],
      [T.GOAL, 'ゴール', '上で「ぴったり止まる」と勝ち。素通りは無効'],
      [T.START, 'ペンギン', 'キミ。スワイプ/矢印キーで滑る'],
    ];
    const wrap = $('#legend');
    wrap.innerHTML = defs.map(([t, name, desc]) => `
      <div class="legend-item">
        <div class="tile-pic">${UI.tileSVG(t)}</div>
        <div><div class="t-name">${name}</div><div class="t-desc">${desc}</div></div>
      </div>`).join('');
  })();

  /* ---------------- ナビ ---------------- */
  $$('.tab').forEach((t) => t.addEventListener('click', () => { location.hash = '#' + t.dataset.nav; }));
  window.addEventListener('hashchange', route);

  /* ---------------- 起動 ---------------- */
  if (!store.get(K.visited, false)) {
    store.set(K.visited, true);
    if (!location.hash || location.hash === '#' || location.hash === '#daily') {
      location.hash = '#how';
    }
  }
  route();
})();
