// 画面づくりで何度も使う小さな道具をまとめたファイル
import { ICONS } from './icons.js';

// 入力された文字をそのままHTMLに入れると表示が崩れるので、安全な形に変換する
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function icon(name, size = 20, cls = '') {
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export function stars(n) {
  return `<span class="stars" aria-label="★${n}">${'★'.repeat(n)}<span class="stars-off">${'★'.repeat(5 - n)}</span></span>`;
}

export function pageHead(en, ja) {
  return `<header class="page-head"><h1 class="page-en">${en}</h1><p class="page-ja">${ja}</p></header>`;
}

const p2 = n => String(n).padStart(2, '0');
export function fmtDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())}`;
}
export function fmtDateTime(ms) {
  const d = new Date(ms);
  return `${fmtDate(ms)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
// 日時入力欄（datetime-local）用の形式 "2026-11-09T21:30"
export function toLocalInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
export function fromLocalInput(str) {
  const t = new Date(str).getTime();
  return Number.isNaN(t) ? null : t;
}

export const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

// 画面下に短く出るお知らせ（「元に戻す」ボタンも付けられる）
let toastTimer;
export function toast(msg, { actionLabel, onAction, duration = 2500 } = {}) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;
  const hide = () => el.classList.remove('show');
  if (actionLabel) el.querySelector('button').onclick = () => { hide(); onAction(); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, duration);
}

// 確認用の小窓。押されたボタンの value を返す（外側をタップしたら null）
export function dialog({ title = '', message = '', html = '', buttons }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      ${title ? `<h2 class="modal-title">${esc(title)}</h2>` : ''}
      ${message ? `<p class="modal-msg">${esc(message)}</p>` : ''}${html}
      <div class="modal-btns ${buttons.length > 2 ? 'stack' : ''}">
        ${buttons.map((b, i) => `<button type="button" class="btn ${b.kind || 'btn-sub'}" data-i="${i}">${esc(b.label)}</button>`).join('')}
      </div></div>`;
    const close = v => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (b) close(buttons[b.dataset.i].value);
      else if (e.target === wrap) close(null);
    });
    document.body.appendChild(wrap);
  });
}

export async function confirmDialog(title, message, okLabel = 'OK', danger = false) {
  const v = await dialog({
    title, message,
    buttons: [{ label: 'キャンセル', value: false }, { label: okLabel, value: true, kind: danger ? 'btn-danger' : 'btn-main' }],
  });
  return v === true;
}

export function alertDialog(title, message) {
  return dialog({ title, message, buttons: [{ label: 'OK', value: true, kind: 'btn-main' }] });
}

// 初回起動時の案内
export function showGuide() {
  return dialog({
    title: 'はじめに',
    html: `<div class="modal-body">
      <p>記録はこのiPhoneの中だけに保存されます（他の人には見えません）。</p>
      <p><b>大切：</b>iPhoneでは「Safariで開いたページ」と「ホーム画面に追加したアイコン」で保存場所が別々です。記録は必ず<b>ホーム画面のアイコンから開いて</b>行ってください。</p>
      <ol><li>Safariの共有ボタン（□に↑）をタップ</li><li>「ホーム画面に追加」を選ぶ</li><li>以後はホーム画面のアイコンから開く</li></ol>
      <p>機種変更などに備えて、ときどき「設定」からバックアップを書き出してください。</p></div>`,
    buttons: [{ label: 'わかった', value: true, kind: 'btn-main' }],
  });
}
