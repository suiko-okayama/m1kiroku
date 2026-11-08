// アプリの起動と、画面（ビュー）の切り替え
import { load, state, setPref } from './store.js';
import { parseHash } from './router.js';
import { icon, toast, showGuide, esc } from './ui.js';
import * as list from './views/list.js';
import * as entry from './views/entry.js';
import * as detail from './views/detail.js';
import * as pending from './views/pending.js';
import * as analysis from './views/analysis.js';
import * as settings from './views/settings.js';

const VIEWS = { list, entry, detail, pending, analysis, settings };
// どの画面のとき、下のどのタブを光らせるか
const TAB_OF = { list: 'list', detail: 'list', pending: 'list', entry: 'entry', analysis: 'analysis', settings: 'settings' };
const TABS = [
  { name: 'list', label: '一覧', icon: 'list' },
  { name: 'entry', label: '記録', icon: 'plus' },
  { name: 'analysis', label: '分析', icon: 'chart' },
  { name: 'settings', label: '設定', icon: 'settings' },
];

let current = null;
let cleanup = null;
const scrollMemo = {};

function buildTabbar() {
  document.getElementById('tabbar').innerHTML = TABS.map(t =>
    `<a class="tab" href="#/${t.name}" data-tab="${t.name}">${icon(t.icon, 24)}<span>${t.label}</span></a>`).join('');
}

// 右下の PAGE TOP ボタン（少し下にスクロールしたら出る）
function buildPageTop() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pagetop';
  b.setAttribute('aria-label', 'ページの先頭へ');
  b.innerHTML = `${icon('chevronsUp', 22)}<span>PAGE TOP</span>`;
  b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(b);
  const onScroll = () => b.classList.toggle('show', window.scrollY > 400);
  window.addEventListener('scroll', onScroll, { passive: true });
}

function route() {
  let { name, id } = parseHash();
  if (!VIEWS[name]) name = 'list';
  if (current) scrollMemo[current] = window.scrollY;
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }

  // 画面ごとに新しい入れ物を作る（前の画面の仕掛けが残らないように）
  document.body.dataset.view = name;
  const main = document.getElementById('main');
  const view = document.createElement('div');
  view.className = 'view' + (name !== current ? ' fade' : '');
  main.replaceChildren(view);
  const res = VIEWS[name].render(view, { id });
  cleanup = typeof res === 'function' ? res : null;

  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.tab === TAB_OF[name];
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });

  // スクロール位置：一覧へ戻ったときは元の位置、同じ画面の描き直しはそのまま、それ以外は先頭
  if (name === 'list' && current !== 'list') window.scrollTo(0, scrollMemo.list || 0);
  else if (name !== current) window.scrollTo(0, 0);
  current = name;
}

async function start() {
  buildTabbar();
  buildPageTop();
  try {
    await load();
  } catch (e) {
    document.getElementById('main').innerHTML =
      `<p class="empty">データを読み込めませんでした。<br>${esc(e && e.message)}</p>`;
    return;
  }
  if (!state.prefs.firstUseAt) setPref('firstUseAt', Date.now());
  // ブラウザに「このデータは消さないで」とお願いする
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  window.addEventListener('hashchange', route);
  route();

  if (!state.prefs.onboarded) {
    await showGuide();
    setPref('onboarded', true);
  }
}

// 通信なしでも起動できるようにする係（Service Worker）を登録
if ('serviceWorker' in navigator) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('新しい版を取り込みました。次に開いたときから新しい版になります', { duration: 5000 });
    hadController = true;
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(e => console.error(e));
}

window.addEventListener('unhandledrejection', e => {
  console.error(e.reason);
  toast('エラーが起きました：' + (e.reason && e.reason.message || e.reason), { duration: 5000 });
});

start();
