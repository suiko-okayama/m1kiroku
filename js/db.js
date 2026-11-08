// データの保存係。ブラウザ内の小さなデータベース「IndexedDB」を使う。
//  - records … 記録（1件＝1本のネタ）
//  - kv      … その他の値（推しコンビ一覧、下書き、前回の入力値、検索条件など）
const DB_NAME = 'm1-netacho';
const DB_VERSION = 1;
let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onclose = () => { dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

function run(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

// iPhoneではアプリを長く裏に回すと接続が切れることがあるので、失敗したら1回だけつなぎ直す
async function tx(storeName, mode, fn) {
  try {
    return await run(storeName, mode, fn);
  } catch (e) {
    if (e && e.name === 'InvalidStateError') {
      dbPromise = null;
      return run(storeName, mode, fn);
    }
    throw e;
  }
}

export const getAllRecords = () => tx('records', 'readonly', s => s.getAll());
export const putRecord = r => tx('records', 'readwrite', s => { s.put(r); });
export const putRecords = rs => tx('records', 'readwrite', s => { rs.forEach(r => s.put(r)); });
export const deleteRecord = id => tx('records', 'readwrite', s => { s.delete(id); });
export const clearRecords = () => tx('records', 'readwrite', s => { s.clear(); });
export const replaceAllRecords = rs => tx('records', 'readwrite', s => { s.clear(); rs.forEach(r => s.put(r)); });

export const kvGet = k => tx('kv', 'readonly', s => s.get(k));
export const kvSet = (k, v) => tx('kv', 'readwrite', s => { s.put(v, k); });
export const kvDel = k => tx('kv', 'readwrite', s => { s.delete(k); });
