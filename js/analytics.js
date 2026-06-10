(function () {
  'use strict';
  const TSR = window.TSR = window.TSR || {};

  // ローカル開発時は本番GAに送らず、console に出すだけにする
  const host = location.hostname;
  const isDev = location.protocol === 'file:'
    || host === 'localhost' || host === '127.0.0.1' || host === '';

  function track(event, params) {
    const safeParams = params || {};
    if (isDev) {
      console.log('[GA dev]', event, safeParams);
      return;
    }
    if (typeof window.gtag !== 'function') return; // gtag.js 読込前 or ブロック中
    try {
      window.gtag('event', event, safeParams);
    } catch (e) {
      // 解析の失敗でゲームを止めない
    }
  }

  TSR.Analytics = { track };
})();
