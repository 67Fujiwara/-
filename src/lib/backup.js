/**
 * 自動バックアップの土台。
 *
 * ブラウザに保存したデータ（localStorage）は、別のブラウザで開いたり
 * 閲覧データを消したりすると見えなくなる。それを防ぐために、
 * 指定したフォルダへ JSON を書き出しておく。
 *
 * フォルダの指定は「フォルダハンドル」として IndexedDB に覚えておく。
 * パス文字列では権限が付かないので、ハンドルそのものを保存する必要がある。
 */

const DB_NAME = 'project-board';
const DB_VERSION = 1;
const STORE = 'settings';
const DIR_KEY = 'backupDir';

/** Chrome / Edge のみ対応（Firefox・Safari には showDirectoryPicker が無い） */
export function isBackupSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.showDirectoryPicker === 'function' &&
    typeof window.indexedDB !== 'undefined'
  );
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore(mode, run) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req?.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      })
  );
}

/** 覚えているバックアップ先フォルダ（未設定なら null） */
export async function loadBackupDir() {
  try {
    return (await withStore('readonly', (store) => store.get(DIR_KEY))) || null;
  } catch {
    return null;
  }
}

/** フォルダを選んでもらい、次回以降のために覚える。キャンセル時は null */
export async function pickBackupDir() {
  let handle;
  try {
    handle = await window.showDirectoryPicker({ id: 'project-board-backup', mode: 'readwrite' });
  } catch (err) {
    if (err?.name === 'AbortError') return null;
    throw err;
  }
  await withStore('readwrite', (store) => store.put(handle, DIR_KEY));
  return handle;
}

export async function forgetBackupDir() {
  try {
    await withStore('readwrite', (store) => store.delete(DIR_KEY));
  } catch {
    // 覚えていない状態にできれば十分なので、失敗しても何もしない
  }
}

/**
 * 書き込み権限の状態を返す（'granted' | 'prompt' | 'denied'）。
 * request が true のときだけ許可を求める。求めるにはクリック等の操作が必要なので、
 * 起動時の自動処理では false のまま呼ぶこと。
 */
export async function dirPermission(handle, request = false) {
  if (!handle) return 'denied';
  const options = { mode: 'readwrite' };
  try {
    // 許可の仕組みを持たないハンドル（確認が不要なもの）は、そのまま書ける
    if (typeof handle.queryPermission !== 'function') return 'granted';
    const current = await handle.queryPermission(options);
    if (current === 'granted') return 'granted';
    if (current === 'denied' && !request) return 'denied';
    if (!request || typeof handle.requestPermission !== 'function') return 'prompt';
    return await handle.requestPermission(options);
  } catch {
    return 'denied';
  }
}

/** 日付ごとに1ファイル。同じ日に何度書いても上書きなので、無限には増えない */
export function backupFileName(iso) {
  return `project-board_${iso}.json`;
}

export async function writeBackup(handle, fileName, text) {
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}
