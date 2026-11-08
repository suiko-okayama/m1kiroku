// 結果待ちのまとめて更新
import { state, getRecord, setResult } from '../store.js';
import { ROUNDS, roundOf, resultLabel } from '../rounds.js';
import { esc, stars, pageHead } from '../ui.js';

let sel = null; // { year, round }

const pendingList = () => state.records.filter(r => r.result === 'pending');

// その年で最近記録した結果待ちのラウンドを選ぶ
function defaultRound(year) {
  const p = pendingList().filter(r => r.year === year);
  if (!p.length) return null;
  return p.reduce((a, b) => (b.createdAt > a.createdAt ? b : a)).round;
}
function defaultSel() {
  const p = pendingList();
  if (!p.length) return null;
  const year = Math.max(...p.map(r => r.year));
  return { year, round: defaultRound(year) };
}

export function render(el) {
  let ids = []; // 選んだ時点で結果待ちだった記録（更新後も行は残して、押し直せるようにする）
  const snapshot = () => {
    ids = sel ? state.records
      .filter(r => r.year === sel.year && r.round === sel.round && r.result === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt).map(r => r.id) : [];
  };
  snapshot();
  if (!ids.length) { sel = defaultSel(); snapshot(); }

  const head = `<nav class="crumb"><a href="#/list">一覧</a><span class="sep">/</span><span>結果待ちのまとめて更新</span></nav>
    ${pageHead('RESULTS', '結果待ちのまとめて更新')}`;

  if (!sel) {
    el.innerHTML = `${head}<div class="empty"><p>結果待ちの記録はありません。</p><a class="btn btn-sub" href="#/list">一覧へ戻る</a></div>`;
    return;
  }

  el.innerHTML = `${head}
    <p class="hint">大会年とラウンドを選ぶと、その中の結果待ちだけが並びます。ボタンをタップするだけで更新されます（もう一度タップで結果待ちに戻ります）。</p>
    <div class="pick">
      <select id="py" class="inp-dark" aria-label="大会年"></select>
      <select id="pr" class="inp-dark" aria-label="ラウンド"></select>
    </div>
    <p id="psum" class="summary"></p>
    <div class="tbl" id="prows"></div>`;

  const $ = s => el.querySelector(s);

  function paintSelects() {
    const p = pendingList();
    const years = [...new Set([...p.map(r => r.year), sel.year])].sort((a, b) => b - a);
    $('#py').innerHTML = years.map(y => `<option value="${y}">${y}年</option>`).join('');
    $('#py').value = String(sel.year);
    const inYear = p.filter(r => r.year === sel.year);
    const rounds = ROUNDS.filter(r => r.key === sel.round || inYear.some(x => x.round === r.key));
    $('#pr').innerHTML = rounds.map(r => {
      const n = inYear.filter(x => x.round === r.key).length;
      return `<option value="${r.key}">${esc(r.name)}（${n}件）</option>`;
    }).join('');
    $('#pr').value = sel.round;
  }

  function paintRows() {
    const recs = ids.map(getRecord).filter(Boolean);
    const left = recs.filter(r => r.result === 'pending').length;
    $('#psum').textContent = `${sel.year}年 ${roundOf(sel.round).name}：${recs.length}件中 結果待ち ${left}件`;
    $('#prows').innerHTML = recs.length ? recs.map(r => `
      <div class="prow" data-id="${esc(r.id)}">
        <div class="pname"><b>${esc(r.combi)}</b>${stars(r.rating)}</div>
        <div class="pbtns">
          ${['win', 'lose'].map(v => `<button type="button" data-v="${v}" aria-pressed="${r.result === v}">${esc(resultLabel(r.round, v, true))}</button>`).join('')}
        </div>
      </div>`).join('') : '<div class="empty"><p>このラウンドの結果待ちはありません。</p></div>';
  }

  paintSelects();
  paintRows();

  $('#py').addEventListener('change', e => {
    const year = Number(e.target.value);
    sel = { year, round: defaultRound(year) || sel.round };
    snapshot(); paintSelects(); paintRows();
  });
  $('#pr').addEventListener('change', e => {
    sel = { ...sel, round: e.target.value };
    snapshot(); paintSelects(); paintRows();
  });
  $('#prows').addEventListener('click', async e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    const id = b.closest('.prow').dataset.id;
    const r = getRecord(id); if (!r) return;
    await setResult(id, r.result === b.dataset.v ? 'pending' : b.dataset.v);
    paintSelects(); paintRows();
  });
}
