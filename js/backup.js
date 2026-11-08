// バックアップの書き出し・読み込み（SPEC 第9章）
import { ROUND_KEYS } from './rounds.js';
import { newId } from './store.js';

const APP_ID = 'm1-netacho';
// バックアップの形式の版数。項目を増やしたら数字を上げ、migrate() に古い版からの変換を書く
export const FORMAT_VERSION = 1;

const p2 = n => String(n).padStart(2, '0');

// 書き出し。iPhoneでは共有シートを出し、PCではファイルとしてダウンロードする。
// 成功で true、ユーザーがキャンセルしたら false
export async function exportBackup(records, favorites) {
  const data = {
    app: APP_ID,
    formatVersion: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
    favorites: [...favorites],
  };
  const json = JSON.stringify(data, null, 1);
  const d = new Date();
  const name = `m1-netacho-backup-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.json`;
  const file = new File([json], name, { type: 'application/json' });

  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
      // それ以外の失敗はダウンロードに切り替える
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

// 古い版のバックアップを今の形に直す（今は版1しかないので何もしない）
function migrate(data, version) {
  // 例：if (version < 2) { data.records.forEach(r => { r.newField = '初期値'; }); }
  return data;
}

function toMs(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const t = Date.parse(v); if (!Number.isNaN(t)) return t; }
  return null;
}

// 1件分を点検して、正しい形にそろえる。おかしなものは null
function normalizeRecord(x) {
  if (!x || typeof x !== 'object') return null;
  const combi = typeof x.combi === 'string' ? x.combi.trim() : '';
  const year = Number(x.year);
  const rating = Number(x.rating);
  if (!combi || !Number.isInteger(year) || year < 2001 || year > 2100) return null;
  if (typeof x.round !== 'string' || !ROUND_KEYS.has(x.round)) return null;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  const createdAt = toMs(x.createdAt) ?? Date.now();
  return {
    id: typeof x.id === 'string' && x.id ? x.id : newId(),
    combi, year, round: x.round, rating,
    result: ['win', 'lose', 'pending'].includes(x.result) ? x.result : 'pending',
    topic: typeof x.topic === 'string' ? x.topic : '',
    comment: typeof x.comment === 'string' ? x.comment : '',
    createdAt,
    updatedAt: toMs(x.updatedAt) ?? createdAt,
  };
}

// 読み込み。問題があれば日本語のメッセージ付きでエラーにする
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('ファイルの中身を読み取れませんでした（JSON形式ではありません）。'); }
  if (!data || typeof data !== 'object' || !Array.isArray(data.records)) {
    throw new Error('このアプリのバックアップファイルではないようです。');
  }
  const version = Number(data.formatVersion) || 1;
  data = migrate(data, version);
  const records = [];
  let skipped = 0;
  for (const raw of data.records) {
    const r = normalizeRecord(raw);
    if (r) records.push(r); else skipped++;
  }
  const favorites = Array.isArray(data.favorites)
    ? [...new Set(data.favorites.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()))] : [];
  return { records, favorites, skipped, newer: version > FORMAT_VERSION };
}
