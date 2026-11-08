// 詳細画面
import { state, getRecord, setResult, toggleFavorite, removeRecord, saveRecord } from '../store.js';
import { ROUND_INDEX, roundOf, resultLabel } from '../rounds.js';
import { esc, icon, stars, toast, confirmDialog, fmtDateTime } from '../ui.js';
import { navigate, refreshIf } from '../router.js';

const chrono = (a, b) => a.year - b.year || ROUND_INDEX[a.round] - ROUND_INDEX[b.round] || a.createdAt - b.createdAt;
const tr = (label, body) => `<div class="tr"><div class="th">${label}</div><div class="td">${body}</div></div>`;
const NONE = '<span class="muted">―</span>';

export function render(el, { id }) {
  function draw() {
    const rec = getRecord(id);
    if (!rec) {
      el.innerHTML = `<nav class="crumb"><a href="#/list">一覧</a></nav><p class="empty">記録が見つかりません（削除された可能性があります）。</p>`;
      return;
    }
    const rd = roundOf(rec.round);
    const fav = state.favorites.has(rec.combi);
    const same = state.records.filter(x => x.combi === rec.combi).sort(chrono);
    const years = [...new Set(same.map(x => x.year))].sort((a, b) => b - a);

    el.innerHTML = `
      <nav class="crumb"><a href="#/list">一覧</a><span class="sep">/</span><span>${esc(rec.combi)}</span></nav>
      <section class="combi-card">
        <div class="combi-top">
          <h1 class="combi-name">${esc(rec.combi)}</h1>
          <button type="button" id="fav" class="fav big ${fav ? 'on' : ''}" aria-pressed="${fav}" aria-label="推しマーク">${icon('heart', 24)}</button>
        </div>
        <div class="combi-sub">${rec.year}年大会　${esc(rd.name)}</div>
      </section>

      <div class="tbl">
        ${tr('大会年', `${rec.year}年`)}
        ${tr('ラウンド', esc(rd.name))}
        ${tr('評価', `${stars(rec.rating)}`)}
        ${tr('結果', `<div class="seg" id="res">${['win', 'lose', 'pending'].map(v =>
          `<button type="button" data-v="${v}" aria-pressed="${rec.result === v}">${esc(resultLabel(rec.round, v))}</button>`).join('')}</div>`)}
        ${tr('ネタの題材', rec.topic ? esc(rec.topic) : NONE)}
        ${tr('感想', rec.comment ? `<div class="comment">${esc(rec.comment)}</div>` : NONE)}
        ${tr('記録日時', `<span class="date">${fmtDateTime(rec.createdAt)}</span>`)}
        ${tr('更新日時', fmtDateTime(rec.updatedAt))}
      </div>

      <div class="detail-actions">
        <a class="btn btn-sub" href="#/entry/${encodeURIComponent(rec.id)}">${icon('pencil')}<span>編集</span></a>
        <button type="button" id="del" class="btn btn-sub">${icon('trash')}<span>削除</span></button>
      </div>

      <h2 class="sec-head">このコンビの記録 <small>${same.length}件</small></h2>
      ${years.map(y => `
        <h3 class="year-head">${y}年大会 出場情報</h3>
        <div class="tbl">${same.filter(x => x.year === y).map(x => `
          <a class="tr rec-mini ${x.id === rec.id ? 'current' : ''}" href="#/detail/${encodeURIComponent(x.id)}">
            <div class="th">${esc(roundOf(x.round).name)}</div>
            <div class="td">${stars(x.rating)}${x.topic ? ` <span class="muted">「${esc(x.topic)}」</span>` : ''} <span class="res res-${x.result}">${esc(resultLabel(x.round, x.result, true))}</span></div>
          </a>`).join('')}
        </div>`).join('')}

      ${same.length >= 2 ? `<h2 class="sec-head">★の推移</h2>${chart(same, rec.id)}` : ''}`;
  }

  draw();

  el.addEventListener('click', async e => {
    const rec = getRecord(id);
    if (!rec) return;
    if (e.target.closest('#fav')) {
      const on = await toggleFavorite(rec.combi);
      toast(on ? `${rec.combi} を推しにしました` : `${rec.combi} の推しを外しました`);
      draw();
      return;
    }
    const rb = e.target.closest('#res button');
    if (rb) {
      if (rb.dataset.v !== rec.result) {
        await setResult(id, rb.dataset.v);
        toast(`結果を「${resultLabel(rec.round, rb.dataset.v)}」にしました`);
        draw();
      }
      return;
    }
    if (e.target.closest('#del')) {
      const ok = await confirmDialog('この記録を削除しますか？', `${rec.combi}（${rec.year}年 ${roundOf(rec.round).name}）`, '削除する', true);
      if (!ok) return;
      const backup = { ...rec };
      await removeRecord(rec.id);
      navigate('#/list');
      toast('削除しました', {
        actionLabel: '元に戻す', duration: 6000,
        onAction: async () => { await saveRecord(backup); toast('元に戻しました'); refreshIf('list'); },
      });
    }
  });
}

// ★の推移の折れ線グラフ（外部ライブラリなしでSVGを手書き）
function chart(list, curId) {
  const n = list.length, step = 48, padL = 34, padR = 20, padT = 16, padB = 42, H = 190;
  const W = Math.max(320, padL + padR + (n - 1) * step);
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const x = i => padL + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = v => padT + ((5 - v) * innerH) / 4;
  let grid = '';
  for (let v = 1; v <= 5; v++) {
    grid += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="ylab" x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">★${v}</text>`;
  }
  const pts = list.map((r, i) => `${x(i)},${y(r.rating)}`).join(' ');
  const dots = list.map((r, i) =>
    `<circle class="dot ${r.id === curId ? 'cur' : ''}" cx="${x(i)}" cy="${y(r.rating)}" r="${r.id === curId ? 6 : 4.5}"/>`).join('');
  const labels = list.map((r, i) =>
    `<text class="xlab" x="${x(i)}" y="${H - padB + 16}" text-anchor="middle">${String(r.year).slice(2)}年</text>
     <text class="xlab" x="${x(i)}" y="${H - padB + 30}" text-anchor="middle">${roundOf(r.round).abbr}</text>`).join('');
  return `<div class="chart-wrap"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="★の推移">
    ${grid}<polyline class="line" points="${pts}"/>${dots}${labels}</svg></div>`;
}
