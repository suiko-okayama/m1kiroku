// 記録画面（新規・編集）
import { state, getRecord, saveRecord, newId, combiNames, setPref, delPref } from '../store.js';
import { ROUNDS, roundOf, resultLabel } from '../rounds.js';
import { norm } from '../search.js';
import { esc, pageHead, toast, dialog, confirmDialog, alertDialog, toLocalInput, fromLocalInput } from '../ui.js';
import { navigate } from '../router.js';

const MIN_YEAR = 2001;

export function render(el, { id }) {
  const editing = id ? getRecord(id) : null;
  if (id && !editing) {
    el.innerHTML = `${pageHead('EDIT', '記録を編集')}<p class="empty">記録が見つかりません。</p>`;
    return;
  }

  // ---- 入力値の初期値 ----
  const curYear = new Date().getFullYear();
  const last = state.prefs.lastEntry || {};
  let f;
  let restored = false;
  if (editing) {
    f = { combi: editing.combi, year: editing.year, round: editing.round, rating: editing.rating,
      result: editing.result, topic: editing.topic || '', comment: editing.comment || '' };
  } else {
    // 大会年・ラウンドは前回の値を引き継ぐ（初回は今年・1回戦）
    f = { combi: '', year: last.year || curYear, round: last.round || ROUNDS[0].key,
      rating: 0, result: 'pending', topic: '', comment: '' };
    const d = state.prefs.draft;
    if (d && d.fields) { Object.assign(f, d.fields); restored = true; }
  }
  const years = [];
  for (let y = Math.max(curYear, f.year); y >= MIN_YEAR; y--) years.push(y);

  el.innerHTML = `
    ${pageHead(editing ? 'EDIT' : 'ENTRY', editing ? '記録を編集' : 'ネタを記録')}
    <form id="entry-form" class="entry" novalidate autocomplete="off">
      <div class="tbl">
        <div class="tr" data-field="combi">
          <label class="th" for="f-combi">コンビ名<span class="req">必須</span></label>
          <div class="td combi-wrap">
            <input id="f-combi" class="inp" type="text" maxlength="60" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="例：〇〇〇〇">
            <ul id="suggest" class="suggest" hidden></ul>
          </div>
        </div>
        <div class="tr">
          <label class="th" for="f-year">大会年<span class="req">必須</span></label>
          <div class="td"><select id="f-year" class="inp">${years.map(y => `<option value="${y}">${y}年</option>`).join('')}</select></div>
        </div>
      </div>

      <h2 class="field-head">ラウンド<span class="req">必須</span></h2>
      <div class="tiles" id="f-round">${ROUNDS.map(r => `<button type="button" class="tile" data-v="${r.key}"></button>`).join('')}</div>

      <div class="tbl">
        <div class="tr" data-field="rating">
          <div class="th">評価<span class="req">必須</span></div>
          <div class="td"><div class="star-input" id="f-rating" role="radiogroup" aria-label="評価">
            ${[1, 2, 3, 4, 5].map(v => `<button type="button" role="radio" data-v="${v}" aria-label="★${v}">★</button>`).join('')}
          </div></div>
        </div>
        <div class="tr">
          <div class="th">結果<span class="req">必須</span></div>
          <div class="td"><div class="seg" id="f-result"></div></div>
        </div>
        <div class="tr">
          <label class="th" for="f-topic">ネタの題材</label>
          <div class="td"><input id="f-topic" class="inp" type="text" maxlength="40" placeholder="例：コンビニ" enterkeyhint="done"></div>
        </div>
        <div class="tr">
          <label class="th" for="f-comment">感想</label>
          <div class="td"><textarea id="f-comment" class="inp" rows="4" maxlength="1000"></textarea><div class="counter" id="f-count"></div></div>
        </div>
        ${editing ? `<div class="tr"><label class="th" for="f-created">記録日時</label>
          <div class="td"><input id="f-created" class="inp" type="datetime-local"></div></div>` : ''}
      </div>

      <p id="missing" class="missing" aria-live="polite"></p>
      <div class="form-actions">
        <button type="button" id="cancel" class="btn btn-sub">キャンセル</button>
        <button type="submit" id="save" class="btn btn-main">保存</button>
      </div>
      ${editing ? '' : '<p class="hint">記録日時は保存したときに自動で入ります。入力中の内容は自動で下書き保存されます。</p>'}
    </form>`;

  const $ = s => el.querySelector(s);
  const form = $('#entry-form');
  const inCombi = $('#f-combi');
  const suggest = $('#suggest');

  // ---- 値を画面に反映 ----
  inCombi.value = f.combi;
  $('#f-year').value = String(f.year);
  $('#f-topic').value = f.topic;
  $('#f-comment').value = f.comment;
  if (editing) $('#f-created').value = toLocalInput(editing.createdAt);

  function paintRound() {
    el.querySelectorAll('.tile').forEach(b => {
      const on = b.dataset.v === f.round;
      b.setAttribute('aria-pressed', on);
      b.innerHTML = `${on ? '<span class="tag">SELECT</span>' : ''}${esc(roundOf(b.dataset.v).name)}`;
    });
    paintResult();
  }
  function paintRating() {
    el.querySelectorAll('#f-rating button').forEach(b => {
      const on = Number(b.dataset.v) <= f.rating;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', Number(b.dataset.v) === f.rating);
    });
  }
  function paintResult() {
    $('#f-result').innerHTML = ['win', 'lose', 'pending'].map(v =>
      `<button type="button" data-v="${v}" aria-pressed="${f.result === v}">${esc(resultLabel(f.round, v))}</button>`).join('');
  }
  function paintCount() { $('#f-count').textContent = `${f.comment.length} / 1000`; }

  // 必須項目のチェック。足りないときは保存ボタンを押せなくし、何が足りないかを出す
  function validate() {
    const miss = [];
    if (!f.combi.trim()) miss.push('コンビ名');
    if (!(f.rating >= 1)) miss.push('評価');
    $('#save').disabled = miss.length > 0;
    $('#missing').textContent = miss.length ? `あと「${miss.join('」「')}」を入力すると保存できます` : '';
    el.querySelectorAll('[data-field]').forEach(r =>
      r.classList.toggle('is-missing', (r.dataset.field === 'combi' && !f.combi.trim()) || (r.dataset.field === 'rating' && !f.rating)));
    return miss.length === 0;
  }

  paintRound(); paintRating(); paintCount(); validate();

  // ---- 下書きの自動保存（新規のときだけ） ----
  let dirty = false;
  let finished = false;
  const hasContent = () => f.combi.trim() || f.rating || f.topic.trim() || f.comment.trim();
  function changed() { dirty = true; validate(); }
  async function flushDraft() {
    if (editing || finished || !dirty) return;
    dirty = false;
    try {
      if (hasContent()) await setPref('draft', { fields: { ...f }, savedAt: Date.now() });
      else await delPref('draft');
    } catch (e) { console.error(e); }
  }
  const timer = setInterval(flushDraft, 1000);
  const onVis = () => { if (document.visibilityState === 'hidden') flushDraft(); };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', flushDraft);

  if (restored) {
    toast('下書きから再開しました', {
      actionLabel: '破棄する', duration: 5000,
      onAction: async () => { finished = true; await delPref('draft'); navigate('#/entry'); },
    });
  }

  // ---- コンビ名の候補（前方一致を先に、次に部分一致） ----
  const names = combiNames();
  function showSuggest() {
    const q = norm(f.combi.trim());
    if (!q) { suggest.hidden = true; return; }
    const pre = [], part = [];
    for (const n of names) {
      const k = norm(n);
      if (k === q) continue;
      if (k.startsWith(q)) pre.push(n); else if (k.includes(q)) part.push(n);
    }
    const list = [...pre, ...part].slice(0, 8);
    suggest.innerHTML = list.map(n => `<li><button type="button" data-name="${esc(n)}">${esc(n)}</button></li>`).join('');
    suggest.hidden = list.length === 0;
  }
  inCombi.addEventListener('input', () => { f.combi = inCombi.value; changed(); showSuggest(); });
  inCombi.addEventListener('focus', showSuggest);
  inCombi.addEventListener('blur', () => setTimeout(() => { suggest.hidden = true; }, 150));
  suggest.addEventListener('pointerdown', e => e.preventDefault()); // タップ中に入力欄から外れないように
  suggest.addEventListener('click', e => {
    const b = e.target.closest('button[data-name]');
    if (!b) return;
    f.combi = b.dataset.name; inCombi.value = f.combi;
    suggest.hidden = true; changed(); inCombi.blur();
  });

  // Enterキーで勝手に保存されないようにする
  el.querySelectorAll('input.inp').forEach(i => i.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); i.blur(); }
  }));

  $('#f-year').addEventListener('change', e => { f.year = Number(e.target.value); changed(); });
  $('#f-round').addEventListener('click', e => {
    const b = e.target.closest('.tile'); if (!b) return;
    f.round = b.dataset.v; paintRound(); changed();
  });
  $('#f-rating').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    f.rating = Number(b.dataset.v); paintRating(); changed();
  });
  $('#f-result').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    f.result = b.dataset.v; paintResult(); changed();
  });
  $('#f-topic').addEventListener('input', e => { f.topic = e.target.value; changed(); });
  $('#f-comment').addEventListener('input', e => { f.comment = e.target.value; paintCount(); changed(); });

  // ---- キャンセル ----
  $('#cancel').addEventListener('click', async () => {
    if (editing) { navigate('#/detail/' + encodeURIComponent(editing.id)); return; }
    if (hasContent() && !(await confirmDialog('入力中の内容を破棄しますか？', '下書きも消えます。', '破棄する', true))) return;
    finished = true;
    await delPref('draft');
    navigate('#/list');
  });

  // ---- 保存 ----
  let saving = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (saving || !validate()) return;
    saving = true;
    const now = Date.now();
    const data = { combi: f.combi.trim(), year: f.year, round: f.round, rating: f.rating,
      result: f.result, topic: f.topic.trim(), comment: f.comment };
    let rec;
    if (editing) {
      const v = $('#f-created').value;
      const createdAt = v && v !== toLocalInput(editing.createdAt) ? (fromLocalInput(v) ?? editing.createdAt) : editing.createdAt;
      rec = { ...editing, ...data, createdAt, updatedAt: now };
    } else {
      rec = { id: newId(), ...data, createdAt: now, updatedAt: now };
    }
    try {
      await saveRecord(rec);
    } catch (err) {
      saving = false;
      await alertDialog('保存できませんでした', String(err && err.message || err));
      return;
    }
    finished = true;
    if (editing) {
      toast('保存しました');
      navigate('#/detail/' + encodeURIComponent(rec.id));
      return;
    }
    await delPref('draft');
    await setPref('lastEntry', { year: f.year, round: f.round });
    const next = await dialog({
      title: '保存しました',
      message: `${rec.combi}（${rec.year}年 ${roundOf(rec.round).name}）`,
      buttons: [{ label: '一覧へ戻る', value: 'list' }, { label: '続けて記録', value: 'next', kind: 'btn-main' }],
    });
    if (next === 'next') { navigate('#/entry'); window.scrollTo(0, 0); }
    else navigate('#/list');
  });

  // 開いたらすぐコンビ名を入力できるように
  if (!editing) requestAnimationFrame(() => inCombi.focus());

  // 画面を離れるときの後片付け
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', flushDraft);
    flushDraft();
  };
}
