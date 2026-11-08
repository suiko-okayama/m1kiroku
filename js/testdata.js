// 動作確認用のテストデータ（架空のコンビ名）。毎回同じ内容になるよう、決まった種から乱数を作る
import { ROUNDS } from './rounds.js';
import { newId } from './store.js';

function seeded(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ['ポテトサラダ', 'かもめ通信', 'ネオンテトラ', '三丁目ブラザーズ', 'さよならモンスター',
  'ミルクティー革命', 'ハイボール兄弟', 'なつやすみ', 'ＡＢＣシアター', 'ﾏｼﾞｶﾙﾊﾞﾅﾅ'];
const TOPICS = ['コンビニ', '結婚式', 'タクシー', '面接', '引っ越し', '病院', '合コン', '修学旅行', ''];

export function makeTestRecords(count = 20) {
  const rnd = seeded(2026);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const now = Date.now();
  const out = [];
  for (let i = 0; i < count; i++) {
    const rating = 1 + Math.floor(rnd() * 5);
    const roll = rnd();
    // ★が高いほど勝ち上がりやすくしておく。15%は結果待ち
    const result = roll < 0.15 ? 'pending' : rnd() < rating * 0.18 ? 'win' : 'lose';
    const createdAt = now - Math.floor(rnd() * 60) * 86400000 - Math.floor(rnd() * 86400000);
    out.push({
      id: newId(),
      combi: pick(NAMES),
      year: pick([2024, 2025, 2026]),
      round: pick(ROUNDS).key,
      rating, result,
      topic: pick(TOPICS),
      comment: `（テストデータ${i + 1}）\nつかみが良かった。後半の展開が読めた。`,
      createdAt,
      updatedAt: createdAt,
    });
  }
  return out;
}
