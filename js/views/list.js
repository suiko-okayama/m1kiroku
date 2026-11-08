// 一覧画面（起動時の画面）
import { state, getRecord, setResult, toggleFavorite, setPref } from '../store.js';
import { applyFilter, DEFAULT_FILTER, activeFilterCount, SORT_OPTIONS } from '../search.js';
import { ROUNDS, RESULTS, roundOf, resultLabel } from '../rounds.js';
import { esc, icon, stars, pageHead, toast, fmtDate, isIOS, isStandalone } from '../ui.js';
import { navigate } from '../router.js';

const PAGE = 100;        // 一度に表示する件数（多いときは「もっと見る」）
const DAY = 86400000;
let filter = null;       // 現在の検索・絞り込み・並び替え条件
let shown = PAGE;
let panelOpen = false;
let saveTimer;

export function render(el) {
  if (!filter) filter = { ...DEFAULT_FILTER, ...(state.prefs.listFilter || {}) };
  let alive = true;
  let results = [];

  el.innerHTML = `
    ${pageHead('RECORDS', '記録一覧')}
    <div class="notices"></div>
    <div class="search-box">${icon('search')}
      <input id="q" type="search" placeholder="コンビ名・感想・題材で検索" autocomplete="off" enterkeyhint="search" aria-label="キーワード検索">
    </div>
    <div class="tools">
      <button type="button" id="btn-filter" class="btn-tool" aria-expanded="${panelOpen}">${icon('sliders')}<span>絞り込み</span><span id="fcount" class="badge" hidden></span></button>
      <label class="btn-tool btn-sort">${icon('updown')}
        <select id="sort" aria-label="並び替え">${SORT_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select>
      </label>
      <button type="button" id="btn-clear" class="btn-tool">解除</button>
    </div>
    <div id="fpanel" class="fpanel" ${panelOpen ? '' : 'hidden'}></div>
    <p id="summary" class="summary"></p>
    <div id="rows"></div>
    <div class="more-wrap"><button type="button" id="more" class="btn btn-sub" hidden>もっと見る</button></div>`;

  const $ = s => el.querySelector(s);
  const rows = $('#rows'), panel = $('#fpanel'), more = $('#more');
  $('#q').value = filter.q;
  $('#sort').value = filter.sort;

  // ---- お知らせ欄 ----
  function paintNotices() {
    let h = '';
    if (isIOS() && !isStandalone()) {
      h += `<div class="notice">Safariのタブで開いています。記録は「ホーム画面に追加」したアイコンから開いて行ってください（保存場所が別々のため）。</div>`;
    }
    const base = state.prefs.lastExportAt || state.prefs.firstUseAt;
    if (state.records.length && base && Date.now() - base >= 30 * DAY) {
      h += `<div class="notice">${state.prefs.lastExportAt ? '最後のバックアップから30日以上たちました。' : 'まだバックアップを書き出していません。'} <a href="#/settings">設定で書き出す</a></div>`;
    }
    const pend = state.records.filter(r => r.result === 'pending').length;
    if (pend) {
      h += `<a class="pending-banner" href="#/pending">${icon('clock')}<span>結果待ち ${pend}件</span><span class="go">→ まとめて更新</span></a>`;
    }
    $('.notices').innerHTML = h;
  }

  // ---- 絞り込みパネル ----
  const chip = (group, value, label, on) =>
    `<button type="button" class="chip" data-group="${group}" data-value="${esc(value)}" aria-pressed="${on}">${label}</button>`;
  const ratingOpts = sel => [1, 2, 3, 4, 5].map(v => `<option value="${v}" ${v === sel ? 'selected' : ''}>★${v}</option>`).join('');
  function paintPanel() {
    const years = [...new Set([...state.records.map(r => r.year), ...filter.years])].sort((a, b) => b - a);
    panel.innerHTML = `
      <div class="fgroup"><div class="fgroup-title">大会年</div><div class="chips">
        ${years.length ? years.map(y => chip('years', y, `${y}年`, filter.years.includes(y))).join('') : '<span class="muted">記録がありません</span>'}
      </div></div>
      <div class="fgroup"><div class="fgroup-title">ラウンド</div><div class="chips">
        ${ROUNDS.map(r => chip('rounds', r.key, r.name, filter.rounds.includes(r.key))).join('')}
      </div></div>
      <div class="fgroup"><div class="fgroup-title">評価</div><div class="range">
        <select id="fmin" class="inp-dark" aria-label="評価の下限">${ratingOpts(filter.minRating)}</select><span>〜</span>
        <select id="fmax" class="inp-dark" aria-label="評価の上限">${ratingOpts(filter.maxRating)}</select>
      </div></div>
      <div class="fgroup"><div class="fgroup-title">結果</div><div class="chips">
        ${RESULTS.map(x => chip('results', x.key, x.label, filter.results.includes(x.key))).join('')}
      </div></div>
      <div class="fgroup"><div class="fgroup-title">記録日</div><div class="range">
        <input type="date" id="dfrom" class="inp-dark" value="${esc(filter.dateFrom)}" aria-label="開始日"><span>〜</span>
        <input type="date" id="dto" class="inp-dark" value="${esc(filter.dateTo)}" aria-label="終了日">
      </div></div>
      <div class="fgroup"><div class="chips">${chip('fav', '1', `${icon('heart', 14)} 推しのみ`, filter.favOnly)}</div></div>`;
  }

  // ---- 一覧の行 ----
  function rowHtml(r) {
    const fav = state.favorites.has(r.combi);
    const res = r.result === 'pending'
      ? `<span class="tag-pending">${icon('clock', 12)}結果待ち</span>`
      : `<span class="res res-${r.result}">${esc(resultLabel(r.round, r.result, true))}</span>`;
    const firstLine = (r.comment || '').split('\n').find(s => s.trim()) || '';
    const sub = [r.topic ? `「${esc(r.topic)}」` : '', esc(firstLine)].filter(Boolean).join(' ');
    return `<div class="tr rec" data-id="${esc(r.id)}">
      <div class="th rec-round">${esc(roundOf(r.round).name)}</div>
      <div class="td rec-body">
        <div class="rec-top">
          <span class="rec-name">${esc(r.combi)}</span>
          <button type="button" class="fav ${fav ? 'on' : ''}" data-act="fav" aria-pressed="${fav}" aria-label="推しマーク">${icon('heart', 18)}</button>
          ${res}
        </div>
        <div class="rec-meta">${stars(r.rating)}<span>${r.year}年大会</span><span class="rec-date">${fmtDate(r.createdAt)}</span></div>
        ${sub ? `<div class="rec-comment">${sub}</div>` : ''}
        ${r.result === 'pending' ? `<div class="quick">
          <button type="button" data-act="win">${esc(resultLabel(r.round, 'win', true))}</button>
          <button type="button" data-act="lose">${esc(resultLabel(r.round, 'lose', true))}</button></div>` : ''}
      </div></div>`;
  }

  function paintRows() {
    if (!state.records.length) {
      rows.innerHTML = `<div class="empty"><p>まだ記録がありません。</p><a class="btn btn-main" href="#/entry">最初の記録をつける</a></div>`;
      more.hidden = true;
      return;
    }
    if (!results.length) {
      rows.innerHTML = '<div class="empty"><p>条件に合う記録がありません。</p></div>';
      more.hidden = true;
      return;
    }
    const byYear = filter.sort === 'yearround'; // このときだけ「2026年大会」の見出しで区切る
    let html = '', prevYear = null, open = false;
    for (const r of results.slice(0, shown)) {
      if (byYear && r.year !== prevYear) {
        if (open) html += '</div>';
        html += `<h2 class="year-head">${r.year}年大会</h2><div class="tbl">`;
        prevYear = r.year; open = true;
      } else if (!open) {
        html += '<div class="tbl">'; open = true;
      }
      html += rowHtml(r);
    }
    if (open) html += '</div>';
    rows.innerHTML = html;
    more.hidden = results.length <= shown;
    more.textContent = `もっと見る（残り${results.length - shown}件）`;
  }

  function update(keepShown = false) {
    results = applyFilter(state.records, filter, state.favorites);
    if (!keepShown) shown = PAGE;
    const n = results.length;
    const avg = n ? (results.reduce((s, r) => s + r.rating, 0) / n).toFixed(1) : '-';
    $('#summary').textContent = `該当${n}件・平均★${avg}`;
    const c = activeFilterCount(filter);
    $('#fcount').hidden = c === 0;
    $('#fcount').textContent = c;
    $('#btn-clear').disabled = c === 0 && !filter.q;
    paintRows();
    // 条件は保存して、次に開いたときも引き継ぐ
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => setPref('listFilter', filter), 300);
  }

  paintNotices();
  paintPanel();
  update(true);

  // ---- 操作 ----
  $('#q').addEventListener('input', e => { filter.q = e.target.value; update(); });
  $('#q').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) e.target.blur(); });
  $('#sort').addEventListener('change', e => { filter.sort = e.target.value; update(); });
  $('#btn-filter').addEventListener('click', e => {
    panelOpen = !panelOpen;
    panel.hidden = !panelOpen;
    e.currentTarget.setAttribute('aria-expanded', panelOpen);
  });
  $('#btn-clear').addEventListener('click', () => {
    filter = { ...DEFAULT_FILTER, sort: filter.sort };
    $('#q').value = '';
    paintPanel(); update();
  });
  more.addEventListener('click', () => { shown += PAGE; paintRows(); });

  panel.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const g = b.dataset.group;
    if (g === 'fav') {
      filter.favOnly = !filter.favOnly;
    } else {
      const v = g === 'years' ? Number(b.dataset.value) : b.dataset.value;
      const arr = filter[g];
      filter[g] = arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
    }
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
    update();
  });
  panel.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'fmin' || t.id === 'fmax') {
      let lo = Number($('#fmin').value), hi = Number($('#fmax').value);
      if (lo > hi) { if (t.id === 'fmin') hi = lo; else lo = hi; $('#fmin').value = lo; $('#fmax').value = hi; }
      filter.minRating = lo; filter.maxRating = hi;
    } else if (t.id === 'dfrom') filter.dateFrom = t.value;
    else if (t.id === 'dto') filter.dateTo = t.value;
    else return;
    update();
  });

  rows.addEventListener('click', async e => {
    const rowEl = e.target.closest('.rec'); if (!rowEl) return;
    const id = rowEl.dataset.id;
    const r = getRecord(id); if (!r) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'fav') {
      const on = await toggleFavorite(r.combi);
      toast(on ? `${r.combi} を推しにしました` : `${r.combi} の推しを外しました`);
      update(true);
    } else if (act === 'win' || act === 'lose') {
      await setResult(id, act);
      toast(`${r.combi}：${resultLabel(r.round, act, true)}`, {
        actionLabel: '元に戻す', duration: 5000,
        onAction: async () => { await setResult(id, 'pending'); if (alive) { paintNotices(); update(true); } },
      });
      paintNotices(); update(true);
    } else {
      navigate('#/detail/' + encodeURIComponent(id));
    }
  });

  return () => { alive = false; };
}
