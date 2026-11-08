// 分析画面（SPEC 第7章）
import { state } from '../store.js';
import { ROUNDS, roundOf, resultLabel } from '../rounds.js';
import { scopeRecords, hitInfo, byStar, eyeScore, surprises, groupTable, rankRecords, rankCombis, yearReview } from '../stats.js';
import { esc, icon, stars, pageHead } from '../ui.js';

// 画面を離れても選んだ条件を覚えておく
const scope = { year: 0, round: '' };
let rankMode = 'record';
let reviewYear = 0;

const pct = v => (v == null ? '―' : `${Math.round(v * 100)}%`);
const num1 = v => (v == null ? '―' : v.toFixed(1));
const chap = (no, title) => `<h2 class="chap"><span class="chap-no">${String(no).padStart(2, '0')}</span><span class="chap-title">${title}</span></h2>`;
const link = r => `#/detail/${encodeURIComponent(r.id)}`;

export function render(el) {
  function draw() {
    const all = state.records;
    const years = [...new Set(all.map(r => r.year))].sort((a, b) => b - a);
    if (scope.year && !years.includes(scope.year)) scope.year = 0;

    const head = `${pageHead('ANALYSIS', '分析')}`;
    if (!all.length) {
      el.innerHTML = `${head}<div class="empty"><p>まだ記録がありません。記録がたまると、ここに分析が表示されます。</p></div>`;
      return;
    }

    const rs = scopeRecords(all, scope);
    const pendingN = rs.filter(r => r.result === 'pending').length;
    const hit = hitInfo(rs);
    const eye = eyeScore(rs);
    const stars5 = byStar(rs);
    const sur = surprises(rs);
    const roundRows = groupTable(rs, r => r.round, ROUNDS.map(r => r.key));
    const yearRows = groupTable(rs, r => r.year, years);
    const ranking = rankMode === 'record' ? rankRecords(rs) : rankCombis(rs);

    const rvYears = [...new Set(rs.map(r => r.year))].sort((a, b) => b - a);
    if (scope.year) reviewYear = scope.year;
    else if (!rvYears.includes(reviewYear)) reviewYear = rvYears[0] || 0;
    const review = reviewYear ? yearReview(rs, reviewYear) : null;

    el.innerHTML = `${head}
      <div class="scope">
        <select id="sc-year" class="inp-dark" aria-label="大会年で絞り込む">
          <option value="0">すべての年</option>${years.map(y => `<option value="${y}">${y}年大会</option>`).join('')}
        </select>
        <select id="sc-round" class="inp-dark" aria-label="ラウンドで絞り込む">
          <option value="">すべてのラウンド</option>${ROUNDS.map(r => `<option value="${r.key}">${r.name}</option>`).join('')}
        </select>
      </div>
      <p class="summary">対象 ${rs.length}件${pendingN ? `（うち結果待ち ${pendingN}件は、勝ち上がり率・的中率などの計算から除いています）` : ''}</p>

      ${!rs.length ? '<div class="empty"><p>この条件の記録はありません。</p></div>' : `

      ${chap(1, '★別の勝ち上がり率')}
      <div class="bars">
        ${stars5.map(s => `
          <div class="bar-row">
            <div class="bar-label">★${s.star}</div>
            <div class="bar"><span style="width:${s.rate == null ? 0 : Math.round(s.rate * 100)}%"></span></div>
            <div class="bar-val"><b>${pct(s.rate)}</b><small>${s.win}/${s.n}件</small></div>
          </div>`).join('')}
      </div>
      <p class="hint">★をつけた記録のうち、勝ち上がった割合です（右の数字は 勝ち上がり／結果が出た件数）。</p>

      ${chap(2, '的中率')}
      <div class="stat">
        <div class="stat-num">${pct(hit.rate)}</div>
        <div class="stat-sub">${hit.hit} / ${hit.n}件 的中</div>
      </div>
      <p class="hint">★4・5を「勝つ予想」、★1・2を「負ける予想」とみなし、結果と一致した割合です。★3は数えません。</p>

      ${chap(3, '見る目スコア')}
      <div class="stat">
        <div class="stat-num">${eye.diff == null ? '―' : (eye.diff >= 0 ? '+' : '') + eye.diff.toFixed(2)}</div>
        <div class="stat-sub">勝ち上がり 平均★${num1(eye.winAvg)} ／ 敗退 平均★${num1(eye.loseAvg)}</div>
      </div>
      <p class="hint">勝ち上がった記録と敗退した記録の、平均★の差です。差が大きいほど審査員と好みが近いといえます。</p>

      ${chap(4, '意外な結果')}
      ${sur.length ? `<div class="tbl">${sur.map(r => `
        <a class="tr rec-mini" href="${link(r)}">
          <div class="th">${esc(roundOf(r.round).name)}</div>
          <div class="td"><b class="mini-name">${esc(r.combi)}</b>${stars(r.rating)}<span class="res res-${r.result}">${esc(resultLabel(r.round, r.result, true))}</span></div>
        </a>`).join('')}</div>` : '<p class="muted">該当する記録はありません。</p>'}
      <p class="hint">★5なのに敗退した記録と、★1〜2なのに勝ち上がった記録です。タップで詳細へ。</p>

      ${chap(5, 'ラウンド別')}
      ${groupHtml('ラウンド', roundRows, k => roundOf(k).name)}

      ${chap(6, '年別')}
      ${groupHtml('大会年', yearRows, k => `${k}年`)}

      ${chap(7, 'お気に入りランキング')}
      <div class="switch" role="tablist">
        <button type="button" data-mode="record" aria-selected="${rankMode === 'record'}">1本ごと</button>
        <button type="button" data-mode="combi" aria-selected="${rankMode === 'combi'}">コンビごとの平均★</button>
      </div>
      <div class="tbl rank">${rankMode === 'record'
        ? ranking.map(x => `
          <a class="tr rank-row" href="${link(x.rec)}">
            <div class="th rank-no">${x.rank}位</div>
            <div class="td"><b class="mini-name">${esc(x.rec.combi)}</b>${stars(x.rec.rating)}<small class="muted">${x.rec.year}年 ${esc(roundOf(x.rec.round).name)}</small></div>
          </a>`).join('')
        : ranking.map(x => `
          <div class="tr rank-row">
            <div class="th rank-no">${x.rank}位</div>
            <div class="td"><b class="mini-name">${esc(x.combi)}</b><span class="avg">★${x.avg.toFixed(1)}</span><small class="muted">${x.n}本</small></div>
          </div>`).join('')}
      </div>

      ${chap(8, '年ごとの振り返り')}
      ${review ? `
        <div class="scope">
          <select id="rv-year" class="inp-dark" aria-label="振り返る大会年" ${scope.year ? 'disabled' : ''}>
            ${rvYears.map(y => `<option value="${y}">${y}年大会</option>`).join('')}
          </select>
        </div>
        ${review.match ? `<div class="crown-banner">${icon('crown', 24)}<span>自分の1位と実際の優勝（${esc(review.champion)}）が一致！</span></div>` : ''}
        <div class="review">
          <div class="review-col">
            <h3 class="review-head">自分の★ランキング</h3>
            <ol class="review-list">${review.own.map(o => `
              <li><span class="rv-rank">${o.rank}</span><span class="rv-name">${esc(o.combi)}${o.combi === review.champion && review.match ? icon('crown', 16, 'crown') : ''}</span><span class="rv-val">★${o.rating}</span></li>`).join('')}
            </ol>
          </div>
          <div class="review-col">
            <h3 class="review-head">実際に先まで進んだ順</h3>
            <ol class="review-list">${review.actual.map(a => `
              <li><span class="rv-rank">${a.rank}</span><span class="rv-name">${esc(a.combi)}${a.combi === review.champion ? icon('crown', 16, 'crown') : ''}</span><span class="rv-val small">${esc(a.label)}</span></li>`).join('')}
            </ol>
          </div>
        </div>
        <p class="hint">${review.champion ? `この年の優勝：${esc(review.champion)}` : 'この年はまだ「決勝最終決戦」で優勝の記録がありません。'}（上位10組まで表示。記録したネタの範囲で集計しています）</p>
      ` : '<p class="muted">対象の記録がありません。</p>'}
      `}`;

    const $ = s => el.querySelector(s);
    $('#sc-year').value = String(scope.year);
    $('#sc-round').value = scope.round;
    if ($('#rv-year')) $('#rv-year').value = String(reviewYear);
  }

  function groupHtml(label, rows, name) {
    if (!rows.length) return '<p class="muted">記録がありません。</p>';
    return `<table class="dt">
      <thead><tr><th>${label}</th><th>件数</th><th>平均★</th><th>的中率</th></tr></thead>
      <tbody>${rows.map(r => `<tr><th>${esc(name(r.key))}</th><td>${r.n}</td><td>${num1(r.avg)}</td><td>${pct(r.hit.rate)}${r.hit.n ? `<small>（${r.hit.hit}/${r.hit.n}）</small>` : ''}</td></tr>`).join('')}</tbody>
    </table>`;
  }

  draw();

  el.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'sc-year') scope.year = Number(t.value);
    else if (t.id === 'sc-round') scope.round = t.value;
    else if (t.id === 'rv-year') reviewYear = Number(t.value);
    else return;
    draw();
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (b) { rankMode = b.dataset.mode; draw(); }
  });
}
