// 分析の計算（SPEC 第7章）。画面とは切り離して、数字だけを計算する
import { ROUND_INDEX, roundOf, resultLabel } from './rounds.js';

const avg = arr => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const decided = r => r.result !== 'pending';

// 画面上部の絞り込み（年・ラウンド）。0 や '' は「すべて」
export function scopeRecords(records, { year, round }) {
  return records.filter(r => (!year || r.year === year) && (!round || r.round === round));
}

// 的中率：★4・5は「勝つ予想」、★1・2は「負ける予想」。★3と結果待ちは対象外
export function hitInfo(records) {
  let hit = 0, n = 0;
  for (const r of records) {
    if (!decided(r) || r.rating === 3) continue;
    n++;
    if ((r.rating >= 4 && r.result === 'win') || (r.rating <= 2 && r.result === 'lose')) hit++;
  }
  return { hit, n, rate: n ? hit / n : null };
}

// ★別の勝ち上がり率（★5→★1の順）
export function byStar(records) {
  return [5, 4, 3, 2, 1].map(star => {
    const d = records.filter(r => r.rating === star && decided(r));
    const win = d.filter(r => r.result === 'win').length;
    return { star, n: d.length, win, rate: d.length ? win / d.length : null };
  });
}

// 見る目スコア：勝ち上がった記録の平均★ − 敗退した記録の平均★
export function eyeScore(records) {
  const winAvg = avg(records.filter(r => r.result === 'win').map(r => r.rating));
  const loseAvg = avg(records.filter(r => r.result === 'lose').map(r => r.rating));
  return { winAvg, loseAvg, diff: winAvg != null && loseAvg != null ? winAvg - loseAvg : null };
}

// 意外な結果：★5なのに敗退、★1〜2なのに勝ち上がり
export function surprises(records) {
  return records
    .filter(r => (r.rating === 5 && r.result === 'lose') || (r.rating <= 2 && r.result === 'win'))
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ラウンド別・年別の表。件数と平均★は結果待ちも含めた全記録、的中率は結果が出たものだけ
export function groupTable(records, keyOf, keys) {
  return keys.map(key => {
    const rs = records.filter(r => keyOf(r) === key);
    return { key, n: rs.length, avg: avg(rs.map(r => r.rating)), hit: hitInfo(rs) };
  }).filter(x => x.n > 0);
}

// 同点は同じ順位にする（1位,1位,3位…）
function withRanks(list, valueOf) {
  return list.map(item => ({ ...item, rank: 1 + list.filter(x => valueOf(x) > valueOf(item)).length }));
}

// お気に入りランキング（1本ごと）
export function rankRecords(records, limit = 10) {
  const sorted = [...records].sort((a, b) => b.rating - a.rating || b.createdAt - a.createdAt);
  return withRanks(sorted.map(r => ({ rec: r })), x => x.rec.rating).slice(0, limit);
}

// お気に入りランキング（コンビごとの平均★）
export function rankCombis(records, limit = 10) {
  const map = new Map();
  for (const r of records) {
    if (!map.has(r.combi)) map.set(r.combi, []);
    map.get(r.combi).push(r.rating);
  }
  const list = [...map.entries()].map(([combi, rs]) => ({ combi, n: rs.length, avg: avg(rs) }))
    .sort((a, b) => b.avg - a.avg || b.n - a.n || (a.combi < b.combi ? -1 : 1));
  return withRanks(list, x => Math.round(x.avg * 100)).slice(0, limit);
}

// どこまで進んだかを数値にする（後のラウンドほど大きく、勝ち上がりは＋1）
const progress = r => ROUND_INDEX[r.round] * 2 + (r.result === 'win' ? 1 : 0);

export function stageLabel(r) {
  if (r.result === 'pending') return `${roundOf(r.round).name}（結果待ち）`;
  if (r.round === 'ff' || r.round === 'f1') return resultLabel(r.round, r.result) === '敗退' ? '決勝 敗退' : resultLabel(r.round, r.result);
  return `${roundOf(r.round).name} ${resultLabel(r.round, r.result, true)}`;
}

// 年ごとの振り返り：左＝自分の★ランキング（同じコンビは最も高い★）、右＝実際に先まで進んだ順
export function yearReview(records, year, limit = 10) {
  const rs = records.filter(r => r.year === year);
  const best = new Map();
  const far = new Map();
  for (const r of rs) {
    if (!best.has(r.combi) || r.rating > best.get(r.combi)) best.set(r.combi, r.rating);
    const cur = far.get(r.combi);
    if (!cur || progress(r) > progress(cur)) far.set(r.combi, r);
  }
  const own = withRanks(
    [...best.entries()].map(([combi, rating]) => ({ combi, rating }))
      .sort((a, b) => b.rating - a.rating || (a.combi < b.combi ? -1 : 1)),
    x => x.rating);
  const actual = withRanks(
    [...far.values()].map(r => ({ combi: r.combi, score: progress(r), label: stageLabel(r) }))
      .sort((a, b) => b.score - a.score || (best.get(b.combi) - best.get(a.combi)) || (a.combi < b.combi ? -1 : 1)),
    x => x.score);
  const championRec = rs.find(r => r.round === 'ff' && r.result === 'win');
  const champion = championRec ? championRec.combi : null;
  // 自分の1位（同点1位を含む）に実際の優勝コンビが入っていれば「一致」
  const match = !!champion && own.some(o => o.rank === 1 && o.combi === champion);
  return { own: own.slice(0, limit), actual: actual.slice(0, limit), champion, match, total: best.size };
}
