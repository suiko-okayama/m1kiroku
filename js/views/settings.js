// 設定画面（バックアップ・全データ削除など）
import { state, setPref, mergeIn, replaceAll, deleteAll } from '../store.js';
import { exportBackup, parseBackup } from '../backup.js';
import { makeTestRecords } from '../testdata.js';
import { esc, pageHead, toast, dialog, confirmDialog, alertDialog, fmtDateTime, showGuide } from '../ui.js';
import { navigate } from '../router.js';

export function render(el) {
  const last = state.prefs.lastExportAt;
  el.innerHTML = `${pageHead('SETTINGS', '設定')}
    <div class="set-list">
      <div class="set-item">
        <div class="set-name">バックアップの書き出し</div>
        <div class="set-body">
          <p>全記録と推しコンビを1つのファイルにまとめます。iPhoneでは共有シートから「"ファイル"に保存」やメールを選べます。</p>
          <p class="note">最後の書き出し：${last ? fmtDateTime(last) : 'まだありません'}</p>
          <button type="button" id="exp" class="btn btn-sub">書き出す</button>
        </div>
      </div>
      <div class="set-item">
        <div class="set-name">バックアップの読み込み</div>
        <div class="set-body">
          <p>書き出したファイルを選んで復元します。「追加」か「全部置き換え」を選べます。</p>
          <input type="file" id="imp-file" hidden>
          <button type="button" id="imp" class="btn btn-sub">ファイルを選ぶ</button>
        </div>
      </div>
      <div class="set-item">
        <div class="set-name">保存の状態</div>
        <div class="set-body">
          <p>記録 ${state.records.length}件 ／ 推しコンビ ${state.favorites.size}組</p>
          <p class="note" id="persist">ブラウザへの保護の依頼：確認中…</p>
        </div>
      </div>
      <div class="set-item">
        <div class="set-name">使い方の案内</div>
        <div class="set-body">
          <p>ホーム画面への追加方法など、最初に出た案内をもう一度表示します。</p>
          <button type="button" id="guide" class="btn btn-sub">案内を見る</button>
        </div>
      </div>
      <div class="set-item">
        <div class="set-name">テスト用データ</div>
        <div class="set-body">
          <p>動作確認のため、架空のコンビの記録を20件追加します（本番の記録を始める前に「全データ削除」で消してください）。</p>
          <button type="button" id="test" class="btn btn-sub">20件追加する</button>
        </div>
      </div>
      <div class="set-item">
        <div class="set-name">全データ削除</div>
        <div class="set-body">
          <p>すべての記録と推しコンビを削除します。元に戻せないので、先にバックアップを書き出してください。</p>
          <button type="button" id="wipe" class="btn btn-sub danger-line">全データを削除</button>
        </div>
      </div>
    </div>`;

  const $ = s => el.querySelector(s);

  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then(ok => {
      $('#persist').textContent = `ブラウザへの保護の依頼：${ok ? '許可済み（自動では消されにくい状態）' : '未許可（ホーム画面から使うと許可されやすくなります）'}`;
    }).catch(() => {});
  } else {
    $('#persist').textContent = 'ブラウザへの保護の依頼：このブラウザは非対応';
  }

  // 書き出し（共有シートはタップ直後でないと開けないので、先に他の待ち時間を入れない）
  $('#exp').addEventListener('click', async () => {
    if (!state.records.length && !(await confirmDialog('記録が0件です', '空のバックアップを書き出しますか？', '書き出す'))) return;
    const ok = await exportBackup(state.records, state.favorites);
    if (ok) {
      await setPref('lastExportAt', Date.now());
      toast('書き出しました');
      navigate('#/settings');
    }
  });

  // 読み込み
  $('#imp').addEventListener('click', () => $('#imp-file').click());
  $('#imp-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let data;
    try {
      data = parseBackup(await file.text());
    } catch (err) {
      await alertDialog('読み込めませんでした', err.message);
      return;
    }
    const notes = [];
    if (data.skipped) notes.push(`形式が正しくない${data.skipped}件は読み飛ばします。`);
    if (data.newer) notes.push('このファイルは新しい版のアプリで作られています。一部の項目が読み込まれない可能性があります。');
    const mode = await dialog({
      title: '読み込み方法を選んでください',
      html: `<div class="modal-body"><p>${esc(file.name)}</p><p>記録 ${data.records.length}件、推しコンビ ${data.favorites.length}組が入っています。</p>
        ${notes.map(n => `<p class="note">${esc(n)}</p>`).join('')}
        <p><b>追加</b>：今の記録を残したまま加えます（同じ記録は上書き）。<br><b>全部置き換え</b>：今の記録を消して、ファイルの内容だけにします。</p></div>`,
      buttons: [
        { label: '追加（同じidは上書き）', value: 'merge', kind: 'btn-main' },
        { label: '全部置き換え', value: 'replace', kind: 'btn-danger' },
        { label: 'キャンセル', value: null },
      ],
    });
    if (!mode) return;
    if (mode === 'replace' && !(await confirmDialog('全部置き換えますか？', `今ある記録${state.records.length}件はすべて消えて、ファイルの内容に置き換わります。`, '置き換える', true))) return;
    if (mode === 'merge') await mergeIn(data.records, data.favorites);
    else await replaceAll(data.records, data.favorites);
    toast(`${data.records.length}件を読み込みました`);
    navigate('#/settings');
  });

  $('#guide').addEventListener('click', () => showGuide());

  $('#test').addEventListener('click', async () => {
    if (!(await confirmDialog('テスト用データを追加しますか？', '架空のコンビの記録を20件追加します。', '追加する'))) return;
    await mergeIn(makeTestRecords(20), []);
    toast('テスト用データを20件追加しました');
    navigate('#/settings');
  });

  // 全データ削除（2回確認）
  $('#wipe').addEventListener('click', async () => {
    if (!(await confirmDialog('全データを削除しますか？', `記録${state.records.length}件と推しコンビをすべて削除します。先にバックアップの書き出しをおすすめします。`, '次へ', true))) return;
    if (!(await confirmDialog('本当に削除しますか？', 'この操作は元に戻せません。', 'すべて削除する', true))) return;
    await deleteAll();
    toast('全データを削除しました');
    navigate('#/settings');
  });
}
