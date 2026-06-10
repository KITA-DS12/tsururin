/* ツルリン — codec.js
 * 挑戦状データを URL ハッシュに埋め込むためのコーデック。
 * バイト列: [ver=1, w, h, authorMoves, nameLen, ...name(UTF-8), ...tiles(4bit×2/byte), crcHi, crcLo]
 */
(function (g) {
  'use strict';
  const E = g.TSR.Engine;
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const VER = 1;
  const NAME_MAX_BYTES = 36; // 全角12文字相当

  function toB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0;
      s += B64[a >> 2];
      s += B64[((a & 3) << 4) | (b >> 4)];
      if (i + 1 < bytes.length) s += B64[((b & 15) << 2) | (c >> 6)];
      if (i + 2 < bytes.length) s += B64[c & 63];
    }
    return s;
  }

  function fromB64(s) {
    const idx = (ch) => B64.indexOf(ch);
    const out = [];
    for (let i = 0; i < s.length; i += 4) {
      const a = idx(s[i]), b = i + 1 < s.length ? idx(s[i + 1]) : -1;
      if (a < 0 || b < 0) return null;
      out.push(((a << 2) | (b >> 4)) & 255);
      if (i + 2 < s.length) {
        const c = idx(s[i + 2]);
        if (c < 0) return null;
        out.push(((b & 15) << 4) | (c >> 2));
        if (i + 3 < s.length) {
          const d = idx(s[i + 3]);
          if (d < 0) return null;
          out.push(((c & 3) << 6) | d);
        }
      }
    }
    return new Uint8Array(out);
  }

  function crc16(bytes) {
    let crc = 0xFFFF;
    for (let j = 0; j < bytes.length; j++) {
      crc ^= bytes[j] << 8;
      for (let i = 0; i < 8; i++) {
        crc = (crc & 0x8000) ? (((crc << 1) ^ 0x1021) & 0xFFFF) : ((crc << 1) & 0xFFFF);
      }
    }
    return crc;
  }

  function utf8Encode(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    return new Uint8Array(0);
  }
  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return '';
  }

  /** 挑戦状をエンコード。{w,h,tiles,authorMoves,name} → URLセーフ文字列 */
  function encodeChallenge(data) {
    const { w, h, tiles } = data;
    const authorMoves = Math.max(1, Math.min(255, data.authorMoves | 0));
    let name = (data.name || '').trim().slice(0, 12);
    let nameBytes = utf8Encode(name);
    while (nameBytes.length > NAME_MAX_BYTES) {
      name = name.slice(0, -1);
      nameBytes = utf8Encode(name);
    }
    const head = [VER, w, h, authorMoves, nameBytes.length];
    const tileBytes = [];
    for (let i = 0; i < tiles.length; i += 2) {
      const hi = tiles[i] & 15;
      const lo = i + 1 < tiles.length ? (tiles[i + 1] & 15) : 0;
      tileBytes.push((hi << 4) | lo);
    }
    const body = new Uint8Array([...head, ...nameBytes, ...tileBytes]);
    const crc = crc16(body);
    const full = new Uint8Array(body.length + 2);
    full.set(body, 0);
    full[body.length] = crc >> 8;
    full[body.length + 1] = crc & 255;
    return toB64(full);
  }

  /** デコード。壊れていれば {error} を返す。 */
  function decodeChallenge(str) {
    try {
      if (!str || str.length < 8 || str.length > 400) return { error: 'format' };
      const bytes = fromB64(str.replace(/[^A-Za-z0-9\-_]/g, ''));
      if (!bytes || bytes.length < 8) return { error: 'format' };
      const body = bytes.slice(0, bytes.length - 2);
      const crc = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
      if (crc16(body) !== crc) return { error: 'crc' };
      const ver = body[0];
      if (ver !== VER) return { error: 'version' };
      const w = body[1], h = body[2];
      if (w < 4 || w > 9 || h < 4 || h > 9) return { error: 'format' };
      const authorMoves = body[3];
      const nameLen = body[4];
      if (5 + nameLen > body.length) return { error: 'format' };
      const name = utf8Decode(body.slice(5, 5 + nameLen));
      const tileBytes = body.slice(5 + nameLen);
      const need = Math.ceil((w * h) / 2);
      if (tileBytes.length !== need) return { error: 'format' };
      const tiles = [];
      for (let i = 0; i < need; i++) {
        tiles.push(tileBytes[i] >> 4);
        if (tiles.length < w * h) tiles.push(tileBytes[i] & 15);
      }
      for (const t of tiles) if (t > 12) return { error: 'format' };
      const sp = E.countSpecials(tiles);
      if (sp.starts !== 1 || sp.goals !== 1) return { error: 'format' };
      return { w, h, tiles, authorMoves, name };
    } catch (e) {
      return { error: 'format' };
    }
  }

  g.TSR.Codec = { encodeChallenge, decodeChallenge, crc16, toB64, fromB64 };
})(typeof window !== 'undefined' ? window : globalThis);
