// 画面の切り替え（URLの # 以降で、どの画面を出すかを決める）
// 例： #/list → 一覧、 #/detail/abc → id が abc の記録の詳細

export function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return { name: parts[0] || 'list', id: parts[1] ? decodeURIComponent(parts[1]) : null };
}

// 指定の画面へ移動。同じ画面を指定した場合は描き直す
export function navigate(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

// いま name の画面を表示中なら描き直す（「元に戻す」の後などに使う）
export function refreshIf(name) {
  if (parseHash().name === name) navigate(location.hash || '#/list');
}
