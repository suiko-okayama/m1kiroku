// ラウンドの定義（SPEC 第4章）。並び順＝大会の進行順。
// win / lose は詳細画面などで使う正式な表示、winShort / loseShort は一覧などの短い表示。
export const ROUNDS = [
  { key: 'r1', name: '1回戦', abbr: '1回', win: '通過', lose: '敗退' },
  { key: 'r2', name: '2回戦', abbr: '2回', win: '通過', lose: '敗退' },
  { key: 'r3', name: '3回戦', abbr: '3回', win: '通過', lose: '敗退' },
  { key: 'qf', name: '準々決勝', abbr: '準々', win: '通過', lose: '敗退' },
  { key: 'sf', name: '準決勝', abbr: '準決', win: '通過（決勝進出）', lose: '敗退（敗者復活戦へ）', winShort: '通過', loseShort: '敗退' },
  { key: 'wc', name: '敗者復活戦', abbr: '敗復', win: '通過（決勝進出）', lose: '敗退', winShort: '通過' },
  { key: 'f1', name: '決勝ファーストラウンド', abbr: '決勝', win: '最終決戦進出', lose: '敗退' },
  { key: 'ff', name: '決勝最終決戦', abbr: '最終', win: '優勝', lose: '準優勝' },
];

export const ROUND_INDEX = Object.fromEntries(ROUNDS.map((r, i) => [r.key, i]));
export const ROUND_KEYS = new Set(ROUNDS.map(r => r.key));

// 結果は内部では win / lose / pending の3つだけで持つ
export const RESULTS = [
  { key: 'win', label: '勝ち上がり' },
  { key: 'lose', label: '敗退' },
  { key: 'pending', label: '結果待ち' },
];

export function roundOf(key) {
  return ROUNDS[ROUND_INDEX[key]] || ROUNDS[0];
}

// ラウンドに応じた結果の表示文言
export function resultLabel(roundKey, result, short = false) {
  if (result === 'pending') return '結果待ち';
  const r = roundOf(roundKey);
  if (result === 'win') return (short && r.winShort) || r.win;
  return (short && r.loseShort) || r.lose;
}
