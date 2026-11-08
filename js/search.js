// 検索・絞り込み・並び替え（SPEC 第6章）
import { ROUND_INDEX } from './rounds.js';

// 文字のゆれをそろえる：全角/半角を統一し、カタカナをひらがなに、英字を小文字にする
export function norm(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// 検索用の文字列は記録ごとに一度だけ作って覚えておく（2,000件でも速くするため）
const hayCache = new WeakMap();
const nameCache = new WeakMap();
function hay(r) {
  let h = hayCache.get(r);
  if (h === undefined) { h = norm(`${r.combi}\n${r.comment || ''}\n${r.topic || ''}`); hayCache.set(r, h); }
  return h;
}
function nameKey(r) {
  let h = nameCache.get(r);
  if (h === undefined) { h = norm(r.combi); nameCache.set(r, h); }
  return h;
}

export const DEFAULT_FILTER = {
  q: '', years: [], rounds: [], minRating: 1, maxRating: 5,
  results: [], dateFrom: '', dateTo: '', favOnly: false, sort: 'created_desc',
};

export const SORT_OPTIONS = [
  { value: 'created_desc', label: '記録が新しい順' },
  { value: 'created_asc', label: '記録が古い順' },
  { value: 'rating_desc', label: '★が高い順' },
  { value: 'rating_asc', label: '★が低い順' },
  { value: 'name', label: 'コンビ名順' },
  { value: 'yearround', label: '大会年＋ラウンド順' },
  { value: 'result', label: '結果順（待ち→通過→敗退）' },
];

const newer = (a, b) => b.createdAt - a.createdAt;
const RESULT_ORDER = { pending: 0, win: 1, lose: 2 };
const SORTS = {
  created_desc: newer,
  created_asc: (a, b) => a.createdAt - b.createdAt,
  rating_desc: (a, b) => b.rating - a.rating || newer(a, b),
  rating_asc: (a, b) => a.rating - b.rating || newer(a, b),
  name: (a, b) => { const x = nameKey(a), y = nameKey(b); return x < y ? -1 : x > y ? 1 : newer(a, b); },
  yearround: (a, b) => b.year - a.year || ROUND_INDEX[a.round] - ROUND_INDEX[b.round] || newer(a, b),
  result: (a, b) => RESULT_ORDER[a.result] - RESULT_ORDER[b.result] || newer(a, b),
};

// 絞り込み欄で何種類の条件が有効になっているか
export function activeFilterCount(f) {
  return [f.years.length, f.rounds.length, f.minRating > 1 || f.maxRating < 5,
    f.results.length, f.dateFrom || f.dateTo, f.favOnly].filter(Boolean).length;
}

export function applyFilter(records, f, favorites) {
  const terms = norm(f.q).split(/\s+/).filter(Boolean); // スペース区切りで複数語（すべて含むもの）
  const years = f.years.length ? new Set(f.years) : null;
  const rounds = f.rounds.length ? new Set(f.rounds) : null;
  const results = f.results.length ? new Set(f.results) : null;
  const from = f.dateFrom ? new Date(`${f.dateFrom}T00:00`).getTime() : -Infinity;
  const to = f.dateTo ? new Date(`${f.dateTo}T23:59:59.999`).getTime() : Infinity;

  const out = records.filter(r =>
    (!years || years.has(r.year)) &&
    (!rounds || rounds.has(r.round)) &&
    r.rating >= f.minRating && r.rating <= f.maxRating &&
    (!results || results.has(r.result)) &&
    r.createdAt >= from && r.createdAt <= to &&
    (!f.favOnly || favorites.has(r.combi)) &&
    (terms.length === 0 || terms.every(t => hay(r).includes(t))));
  out.sort(SORTS[f.sort] || SORTS.created_desc);
  return out;
}
