// アプリ全体のデータを持つ係。起動時に全部読み込んでおき、変更はすぐ保存する。
import * as db from './db.js';

export const state = {
  records: [],          // 全記録
  favorites: new Set(), // 推しコンビ名
  prefs: {},            // その他の保存値
};
const byId = new Map();

const PREF_KEYS = ['listFilter', 'lastExportAt', 'firstUseAt', 'lastEntry', 'onboarded', 'draft'];

export async function load() {
  const [records, favs, ...prefVals] = await Promise.all([
    db.getAllRecords(), db.kvGet('favorites'), ...PREF_KEYS.map(k => db.kvGet(k)),
  ]);
  setRecords(records);
  state.favorites = new Set(favs || []);
  state.prefs = Object.fromEntries(PREF_KEYS.map((k, i) => [k, prefVals[i]]));
}

function setRecords(records) {
  state.records = records;
  byId.clear();
  records.forEach(r => byId.set(r.id, r));
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const getRecord = id => byId.get(id);

// 新規・更新どちらもこれで保存
export async function saveRecord(rec) {
  await db.putRecord(rec);
  if (byId.has(rec.id)) {
    const i = state.records.findIndex(r => r.id === rec.id);
    state.records[i] = rec;
  } else {
    state.records.push(rec);
  }
  byId.set(rec.id, rec);
}

export async function removeRecord(id) {
  await db.deleteRecord(id);
  byId.delete(id);
  state.records = state.records.filter(r => r.id !== id);
}

export async function setResult(id, result) {
  const r = byId.get(id);
  if (!r) return null;
  const nr = { ...r, result, updatedAt: Date.now() };
  await saveRecord(nr);
  return nr;
}

export async function toggleFavorite(name) {
  const s = new Set(state.favorites);
  if (s.has(name)) s.delete(name); else s.add(name);
  await db.kvSet('favorites', [...s]);
  state.favorites = s;
  return s.has(name);
}

// バックアップ読み込み：追加（同じidは上書き）
export async function mergeIn(records, favorites) {
  await db.putRecords(records);
  const s = new Set([...state.favorites, ...favorites]);
  await db.kvSet('favorites', [...s]);
  state.favorites = s;
  const map = new Map(state.records.map(r => [r.id, r]));
  records.forEach(r => map.set(r.id, r));
  setRecords([...map.values()]);
}

// バックアップ読み込み：全部置き換え
export async function replaceAll(records, favorites) {
  await db.replaceAllRecords(records);
  await db.kvSet('favorites', favorites);
  state.favorites = new Set(favorites);
  setRecords([...records]);
}

export async function deleteAll() {
  await db.clearRecords();
  await db.kvSet('favorites', []);
  await delPref('draft');
  state.favorites = new Set();
  setRecords([]);
}

// 過去に入力したコンビ名（最近使った順・重複なし）
export function combiNames() {
  const last = new Map();
  for (const r of state.records) {
    const t = last.get(r.combi);
    if (t === undefined || r.createdAt > t) last.set(r.combi, r.createdAt);
  }
  return [...last.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
}

// その他の値の読み書き（読みは state.prefs から即座に、書きは保存も行う）
export function setPref(key, value) {
  state.prefs[key] = value;
  return db.kvSet(key, value);
}
export function delPref(key) {
  state.prefs[key] = undefined;
  return db.kvDel(key);
}
