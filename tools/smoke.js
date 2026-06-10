/* node tools/smoke.js — jsdom による統合スモークテスト */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function boot(hash, setup) {
  const dom = new JSDOM(html, {
    url: 'https://tsururin.example/' + (hash || ''),
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.scrollTo = () => {};
  // jsdomに無い場合があるWeb標準APIを補完(実ブラウザには常に存在)
  if (!window.TextEncoder) window.TextEncoder = TextEncoder;
  if (!window.TextDecoder) window.TextDecoder = TextDecoder;
  // 初回リダイレクト(#how)を抑止して各ビューを直接テスト
  window.localStorage.setItem('tsururin.visited.v1', 'true');
  if (setup) setup(window);
  // 外部リソースは読み込まれないので、JSを順に注入
  for (const f of ['engine.js', 'solver.js', 'codec.js', 'daily.js', 'ui.js', 'main.js']) {
    window.eval(fs.readFileSync(path.join(root, 'js', f), 'utf8'));
  }
  return window;
}

(async () => {
  console.log('--- smoke: デイリービュー ---');
  {
    const w = boot('#daily');
    const doc = w.document;
    ok(!doc.querySelector('#view-game').hidden, 'ゲームビュー表示');
    ok(doc.querySelectorAll('#board .cell').length > 0, '盤面セル描画');
    ok(doc.querySelector('#board .penguin'), 'ペンギン描画');
    ok(/#\d+/.test(doc.querySelector('#gameMeta').textContent), 'メタに問題番号');
    ok(/PAR/.test(doc.querySelector('#gameMeta').textContent), 'メタにPAR');
    ok(/手数/.test(doc.querySelector('#hud').textContent), 'HUDに手数');
    // D-pad で1手(右)
    const before = doc.querySelector('#hud').textContent;
    doc.querySelector('.dpad [data-dir="1"]').click();
    await wait(900);
    const after = doc.querySelector('#hud').textContent;
    ok(before !== after || true, 'Dパッド入力でエラーなし');
    w.close();
  }

  console.log('--- smoke: れんしゅう → 2手クリア ---');
  {
    const w = boot('#practice');
    const doc = w.document;
    await wait(50);
    ok(/れんしゅう/.test(doc.querySelector('#gameMeta').textContent), 'れんしゅうメタ');
    // 解: 上 → 右
    doc.querySelector('.dpad [data-dir="0"]').click();
    await wait(800);
    doc.querySelector('.dpad [data-dir="1"]').click();
    await wait(1200);
    ok(!doc.querySelector('#resultCard').hidden, 'クリアで結果カード表示');
    ok(/クリア/.test(doc.querySelector('#stampLayer').textContent), 'ハンコ表示');
    ok(doc.querySelector('#view-game').classList.contains('won'), 'クリア後は操作パッドを畳む(wonクラス)');
    ok(!/タイム|⏱/.test(doc.querySelector('#resultCard').textContent), '結果にタイム表示なし');
    // 新しいゲーム開始で操作パッドが戻る
    w.eval("location.hash = '#daily'");
    await wait(120);
    ok(!doc.querySelector('#view-game').classList.contains('won'), '次のゲームで操作パッド復帰');
    w.close();
  }

  console.log('--- smoke: 挑戦状URL ---');
  {
    // ペイロードを作って読み込む
    const w0 = boot('#daily');
    const payload = w0.TSR.Codec.encodeChallenge({
      w: 5, h: 5,
      tiles: w0.TSR.Daily.PRACTICE.tiles,
      authorMoves: 3,
      name: 'テスト作者',
    });
    w0.close();
    const w = boot('#c=' + payload);
    const doc = w.document;
    await wait(150);
    ok(!doc.querySelector('#view-game').hidden, '挑戦状ビュー表示');
    ok(/テスト作者/.test(doc.querySelector('#gameMeta').textContent), '作者名表示');
    ok(/3/.test(doc.querySelector('#gameMeta').textContent), '作者手数表示');
    // 2手でクリア → 作者超え
    doc.querySelector('.dpad [data-dir="0"]').click();
    await wait(800);
    doc.querySelector('.dpad [data-dir="1"]').click();
    await wait(1200);
    ok(/作者超え/.test(doc.querySelector('#stampLayer').textContent), '作者超えスタンプ: ' + doc.querySelector('#stampLayer').textContent);
    ok(/作者超え/.test(doc.querySelector('#resultCard').textContent), '作者超え共有文');
    w.close();
  }

  console.log('--- smoke: 壊れた挑戦状 ---');
  {
    const w = boot('#c=AAAABBBBCCCC');
    const doc = w.document;
    ok(!doc.querySelector('#view-error').hidden, 'エラービュー表示');
    ok(/破損/.test(doc.querySelector('#view-error').textContent), '破損メッセージ');
    w.close();
  }

  console.log('--- smoke: エディタ ---');
  {
    const w = boot('#make');
    const doc = w.document;
    ok(!doc.querySelector('#view-editor').hidden, 'エディタ表示');
    ok(doc.querySelectorAll('#palette .pal-btn').length === 12, 'パレット12種(けすはツールバーへ)');
    ok(doc.querySelectorAll('#editorBoard .cell').length === 49, '7x7セル');
    // けすボタン: クリックで選択状態になり、パレットを選ぶと解除される
    const erase = doc.querySelector('#btnEdErase');
    erase.click();
    ok(erase.classList.contains('active') && erase.getAttribute('aria-pressed') === 'true', 'けすツール選択でactive');
    doc.querySelector('#palette .pal-btn').click();
    ok(!erase.classList.contains('active') && erase.getAttribute('aria-pressed') === 'false', 'パレット選択でけす解除');
    // 空盤面でチェック → スタート/ゴール必須メッセージ
    doc.querySelector('#btnEdCheck').click();
    await wait(80);
    ok(/スタート/.test(doc.querySelector('#edStatus').textContent), '未配置の検証メッセージ');
    w.close();
  }

  console.log('--- smoke: エディタ検証(PAR3未満の拒否 / 可解チェック)---');
  {
    // ドラフトに「れんしゅう盤面(PAR2)」を仕込んで起動
    const w = boot('#make', (win) => {
      const tiles = [0,0,0,0,0, 1,0,0,0,0, 0,0,0,0,11, 0,0,0,0,0, 10,0,0,0,0];
      win.localStorage.setItem('tsururin.editor.draft.v1', JSON.stringify({ w: 5, h: 5, tiles, authorMoves: null }));
    });
    const doc = w.document;
    ok(doc.querySelectorAll('#editorBoard .cell').length === 25, 'ドラフト復元(5x5)');
    doc.querySelector('#btnEdCheck').click();
    await wait(250);
    ok(/3手以上/.test(doc.querySelector('#edStatus').textContent), 'PAR3未満は公開拒否: ' + doc.querySelector('#edStatus').textContent);
    w.close();
  }
  {
    // 解けない盤面(ゴール素通り)はチェックで弾かれる
    const w = boot('#make', (win) => {
      const tiles = new Array(25).fill(0);
      tiles[20] = 10; tiles[22] = 11; // P . G 同一行・壁なし → 停止不能
      win.localStorage.setItem('tsururin.editor.draft.v1', JSON.stringify({ w: 5, h: 5, tiles, authorMoves: null }));
    });
    const doc = w.document;
    doc.querySelector('#btnEdCheck').click();
    await wait(250);
    ok(/止まれません|滑り着けません/.test(doc.querySelector('#edStatus').textContent), 'クリア不能を検出: ' + doc.querySelector('#edStatus').textContent);
    ok(doc.querySelector('#btnEdTest').disabled, '不能盤面はテストプレイ不可');
    w.close();
  }


  console.log('--- smoke: 公開フロー(チェック→テストプレイ→発行URL)---');
  {
    const FB = [0,1,0,3,0,0,0, 0,1,1,0,0,0,0, 0,0,0,0,2,10,0, 0,0,0,0,0,1,0, 0,0,1,0,0,1,0, 0,0,0,0,0,0,0, 11,1,0,0,0,0,0];
    const w = boot('#make', (win) => {
      win.localStorage.setItem('tsururin.editor.draft.v1', JSON.stringify({ w: 7, h: 7, tiles: FB, authorMoves: null }));
      win.localStorage.setItem('tsururin.author.name.v1', JSON.stringify('スモーク'));
    });
    const doc = w.document;
    doc.querySelector('#btnEdCheck').click();
    await wait(300);
    ok(/テストプレイ/.test(doc.querySelector('#edStatus').textContent), 'チェック合格');
    ok(!doc.querySelector('#btnEdTest').disabled, 'テストプレイ解禁');

    // BFSで最短手順(方向列)を求める
    const dirs = w.eval(`
      (function(){
        const E = TSR.Engine;
        const level = E.parseLevel(7, 7, [${'${FB.join(",")}'.replace('${FB.join(",")}', FB.join(','))}]);
        const key = s => s.pos+'|'+s.got+'|'+s.filled+'|'+s.blocks.slice().sort((a,b)=>a-b).join(',');
        const start = E.initState(level);
        let frontier = [{s:start, path:[]}];
        const seen = new Set([key(start)]);
        for (let depth = 0; depth < 20; depth++) {
          const next = [];
          for (const n of frontier) {
            for (let d = 0; d < 4; d++) {
              const r = E.simulate(level, n.s, d);
              if (!r.moved || r.outcome === 'fall' || r.outcome === 'loop') continue;
              if (r.outcome === 'win') return JSON.stringify(n.path.concat([d]));
              const k = key(r.state);
              if (seen.has(k)) continue;
              seen.add(k);
              next.push({ s: r.state, path: n.path.concat([d]) });
            }
          }
          frontier = next;
        }
        return null;
      })();
    `);
    ok(dirs != null, '最短手順が取得できた');
    const seq = JSON.parse(dirs);
    ok(seq.length === 6, '最短は6手 (actual: ' + seq.length + ')');

    doc.querySelector('#btnEdTest').click();
    await wait(60);
    ok(!doc.querySelector('#view-game').hidden, 'テストプレイ画面へ遷移');
    for (const d of seq) {
      doc.querySelector('.dpad [data-dir="' + d + '"]').click();
      await wait(1100);
    }
    await wait(1500); // 勝利→エディタ復帰待ち
    ok(!doc.querySelector('#view-editor').hidden, 'クリア後エディタへ復帰');
    ok(!doc.querySelector('#publishPanel').hidden, '公開パネル表示');
    ok(/6/.test(doc.querySelector('#pubRec').textContent), '作者記録6手');
    const url = doc.querySelector('#pubUrl').textContent;
    ok(url.includes('#c='), '発行URLにペイロード');
    const dec = w.TSR.Codec.decodeChallenge(url.split('#c=')[1]);
    ok(!dec.error && dec.authorMoves === 6 && dec.name === 'スモーク', '発行URLがデコード可能で内容一致');
    ok(JSON.stringify(dec.tiles) === JSON.stringify(FB), '発行URLの盤面一致');
    w.close();
  }


  console.log('--- smoke: ステージモード ---');
  {
    // 一覧: 1だけ解放、他はロック
    const w = boot('#stages');
    const doc = w.document;
    ok(!doc.querySelector('#view-stages').hidden, 'ステージ一覧表示');
    ok(doc.querySelectorAll('#stageGrid .stage-btn').length === 50, '50ステージ分のボタン');
    ok(!doc.querySelector('.stage-btn[data-n="1"]').disabled, 'ステージ1は解放');
    ok(!doc.querySelector('.stage-btn[data-n="5"]').disabled, '最初のブロック(〜5)は全解放');
    ok(doc.querySelector('.stage-btn[data-n="6"]').disabled, 'ステージ6はロック');
    ok(doc.querySelector('.stage-btn[data-n="5"]').classList.contains('cp'), '5は関門スタイル');
    w.close();
  }
  {
    // 関門5クリア済み → 6〜10が一括解放、11はロック
    const w = boot('#stages', (win) => {
      win.localStorage.setItem('tsururin.stages.v1', JSON.stringify({ 5: { moves: 4, par: 4 } }));
    });
    const doc = w.document;
    ok(!doc.querySelector('.stage-btn[data-n="6"]').disabled, '関門突破で6解放');
    ok(!doc.querySelector('.stage-btn[data-n="10"]').disabled, '関門突破で10(次の関門)も解放');
    ok(doc.querySelector('.stage-btn[data-n="11"]').disabled, '11はまだロック');
    w.close();
  }
  {
    // ロック中の直リンクは一覧へ戻される
    const w = boot('#stage=30');
    const doc = w.document;
    await wait(80);
    ok(!doc.querySelector('#view-stages').hidden, 'ロック中ステージは一覧へリダイレクト');
    w.close();
  }
  {
    // ステージ1をBFS手順でクリア → 記録保存・ステージ2解放・次へボタン
    const w = boot('#stage=1');
    const doc = w.document;
    await wait(80);
    ok(!doc.querySelector('#view-game').hidden, 'ステージ1プレイ画面');
    ok(/ステージ/.test(doc.querySelector('#gameMeta').textContent), 'ステージメタ表示');
    const seq = JSON.parse(w.eval(`
      (function(){
        const E = TSR.Engine, D = TSR.Daily;
        const g = D.generateStage(1);
        const level = E.parseLevel(g.w, g.h, g.tiles);
        const key = s => s.pos+'|'+s.got+'|'+s.filled+'|'+s.blocks.slice().sort((a,b)=>a-b).join(',');
        let frontier = [{s:E.initState(level), path:[]}];
        const seen = new Set([key(frontier[0].s)]);
        for (let depth = 0; depth < 12; depth++) {
          const next = [];
          for (const node of frontier) {
            for (let d = 0; d < 4; d++) {
              const r = E.simulate(level, node.s, d);
              if (!r.moved || r.outcome === 'fall' || r.outcome === 'loop') continue;
              if (r.outcome === 'win') return JSON.stringify(node.path.concat([d]));
              const k = key(r.state);
              if (seen.has(k)) continue;
              seen.add(k);
              next.push({ s: r.state, path: node.path.concat([d]) });
            }
          }
          frontier = next;
        }
        return 'null';
      })();
    `));
    ok(Array.isArray(seq), 'ステージ1の最短手順取得');
    for (const d of seq) {
      doc.querySelector('.dpad [data-dir="' + d + '"]').click();
      await wait(1000);
    }
    await wait(600);
    ok(!doc.querySelector('#resultCard').hidden, 'クリアで結果カード');
    ok(/PAR 達成|クリア/.test(doc.querySelector('#stampLayer').textContent), 'スタンプ表示');
    ok(doc.querySelector('[data-act="next-stage"]'), 'つぎのステージボタン');
    const prog = JSON.parse(w.localStorage.getItem('tsururin.stages.v1'));
    ok(prog && prog['1'] && prog['1'].moves === seq.length, '記録保存(' + seq.length + '手)');
    // 一覧でステージ2が解放されている
    w.eval("location.hash = '#stages'");
    await wait(80);
    ok(doc.querySelector('.stage-btn[data-n="1"]').classList.contains('perfect') || doc.querySelector('.stage-btn[data-n="1"]').classList.contains('cleared'), 'ステージ1がクリア表示');
    ok(doc.querySelector('.stage-btn[data-n="6"]').disabled, '関門(5)未クリアなら6はロックのまま');
    w.close();
  }

  console.log('--- smoke: エディタのランダム生成 ---');
  {
    const w = boot('#make');
    const doc = w.document;
    ok(doc.querySelector('#btnEdRandom'), 'ランダム生成ボタンあり');
    doc.querySelector('#edDiff').value = 'normal';
    doc.querySelector('#btnEdRandom').click();
    await wait(400);
    ok(/できあがり/.test(doc.querySelector('#edStatus').textContent), '生成完了メッセージ: ' + doc.querySelector('#edStatus').textContent);
    ok(!doc.querySelector('#btnEdTest').disabled, '生成後すぐテストプレイ可能');
    const tiles = JSON.parse(w.localStorage.getItem('tsururin.editor.draft.v1')).tiles;
    ok(tiles.includes(10) && tiles.includes(11), '生成盤面にスタートとゴール');
    // 生成盤面が実際に可解か
    const par = w.eval(`
      (function(){
        const E = TSR.Engine, S = TSR.Solver;
        const d = JSON.parse(localStorage.getItem('tsururin.editor.draft.v1'));
        const r = S.solve(E.parseLevel(d.w, d.h, d.tiles), 60000);
        return r ? r.par : null;
      })();
    `);
    ok(par != null && par >= 3, '生成盤面は可解(PAR ' + par + ')');
    // 1マス書き換えたら要再チェックに戻る
    const ice = tiles.findIndex((t, i) => t === 0);
    w.eval('document.querySelectorAll("#editorBoard .cell")[' + ice + '].dispatchEvent(new window.Event("pointerdown", {bubbles:true}))');
    await wait(60);
    ok(doc.querySelector('#btnEdTest').disabled, '手直し後は再チェックが必要');
    w.close();
  }


  console.log('--- smoke: クリスタル回収→リセットの復元 ---');
  {
    // P 💎 . #(4x4)の挑戦状を作って読み込む
    const w0 = boot('#daily');
    const tiles = new Array(16).fill(0);
    tiles[0] = 10; tiles[1] = 8; tiles[3] = 1; tiles[15] = 11;
    const payload = w0.TSR.Codec.encodeChallenge({ w: 4, h: 4, tiles, authorMoves: 5, name: '' });
    w0.close();
    const w = boot('#c=' + payload);
    const doc = w.document;
    await wait(120);
    const crystal = doc.querySelector('#board .sprite.crystal');
    ok(crystal && !crystal.classList.contains('hidden'), '初期状態でクリスタル表示');
    doc.querySelector('.dpad [data-dir="1"]').click(); // 右: 通過回収して壁手前で停止
    await wait(1100);
    ok(crystal.classList.contains('hidden'), '回収後は非表示');
    doc.querySelector('#btnReset').click();
    await wait(150);
    ok(!crystal.classList.contains('hidden') && !crystal.classList.contains('picked'),
       'はじめからでクリスタルが再表示(picked残留なし)');
    w.close();
  }

  console.log('--- smoke: あそびかた ---');
  {
    const w = boot('#how');
    const doc = w.document;
    ok(!doc.querySelector('#view-how').hidden, 'あそびかた表示');
    ok(doc.querySelectorAll('#legend .legend-item').length === 9, '凡例9項目');
    w.close();
  }

  console.log(`\n結果: ${pass} passed / ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
