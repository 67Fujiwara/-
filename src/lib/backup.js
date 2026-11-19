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

/**
 * フォルダを選んでもらい、次回以降のために覚える。
 * 選べなかったときは { handle: null, reason } を返す。
 * reason には理由（AbortError など）を入れる。環境によってはブラウザ側が
 * 選択を拒むことがあり、その見分けがつかないと直しようがないため。
 */
export async function pickBackupDir() {
  let handle;
  try {
    handle = await window.showDirectoryPicker({ id: 'project-board-backup', mode: 'readwrite' });
  } catch (err) {
    const name = err?.name || 'Error';
    return {
      handle: null,
      reason:
        name === 'AbortError'
          ? 'フォルダを選ばずに閉じたか、ブラウザ側が選択を受け付けませんでした（AbortError）'
          : `${name}: ${err?.message || '詳細なし'}`,
    };
  }
  await withStore('readwrite', (store) => store.put(handle, DIR_KEY));
  return { handle, reason: '' };
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

/**
 * 覚えているフォルダに今もたどり着けるか。
 * フォルダの名前を変えたり移動したりすると、許可は残ったままでも
 * 場所を見失う。その状態は選び直すまで直らないので、書く前に確かめる。
 */
export async function dirIsReachable(handle) {
  if (!handle) return false;
  try {
    for await (const _name of handle.keys()) break;
    return true;
  } catch {
    return false;
  }
}

/** 日付ごとに1ファイル。同じ日に何度書いても上書きなので、無限には増えない */
export function backupFileName(iso) {
  return `project-board_${iso}.json`;
}

/**
 * バックアップを1件書き出す。
 * どの段階で失敗したかが分かるよう、エラーに手順名と種類を添えて投げ直す。
 */
export async function writeBackup(handle, fileName, text) {
  const at = async (label, fn) => {
    try {
      return await fn();
    } catch (err) {
      const detail = `${label}で失敗（${err?.name || 'Error'}: ${err?.message || '詳細なし'}）`;
      throw new Error(detail, { cause: err });
    }
  };

  const fileHandle = await at('ファイルの作成', () => handle.getFileHandle(fileName, { create: true }));
  const writable = await at('書き込みの開始', () => fileHandle.createWritable());
  await at('書き込み', () => writable.write(text));
  await at('保存の確定', () => writable.close());
}

/* ---------- 失敗したときの調査 ---------- */

function errText(err) {
  if (!err) return '原因不明';
  return `${err.name || 'Error'}: ${err.message || '詳細なし'}`;
}

/**
 * 選ばれているフォルダに対して、書き込みの手順を1つずつ試す。
 * どこで止まるかを並べて返すので、失敗の原因を切り分けられる。
 * 作った点検ファイルは最後に消す。元のファイルには触らない。
 *
 * fresh が true のときは、覚えているフォルダではなくその場で選び直したものを調べる
 * （覚えている情報が古いのか、フォルダ自体が書けないのかを見分けるため）。
 */
export async function diagnoseBackup(handle) {
  const rows = [];
  const add = (label, ok, detail = '') => rows.push({ label, ok, detail });

  add('開き方', true, location.protocol === 'file:' ? 'ファイルを直接開いている（file://）' : location.origin);
  add('ブラウザ', true, navigator.userAgent.replace(/^Mozilla\/5\.0 /, ''));

  if (!handle) {
    add('フォルダの記憶', false, 'バックアップ先が設定されていません');
    return rows;
  }
  add('フォルダの記憶', true, handle.name || '(名前なし)');

  try {
    const state =
      typeof handle.queryPermission === 'function'
        ? await handle.queryPermission({ mode: 'readwrite' })
        : 'granted';
    add('書き込みの許可', state === 'granted', state);
    if (state !== 'granted') return rows;
  } catch (err) {
    add('書き込みの許可', false, errText(err));
    return rows;
  }

  try {
    let n = 0;
    for await (const _name of handle.keys()) {
      n += 1;
      if (n >= 500) break;
    }
    add('フォルダの読み取り', true, `${n} 件見えました`);
  } catch (err) {
    add('フォルダの読み取り', false, errText(err));
    return rows;
  }

  // 日本語を含まない単純な名前と、実際に使う名前の両方を試す
  for (const name of ['_check.txt', backupFileName('0000-00-00')]) {
    let fileHandle;
    try {
      fileHandle = await handle.getFileHandle(name, { create: true });
      add(`ファイルの作成（${name}）`, true);
    } catch (err) {
      add(`ファイルの作成（${name}）`, false, errText(err));
      continue;
    }
    try {
      const writable = await fileHandle.createWritable();
      await writable.write('check');
      await writable.close();
      add(`書き込み（${name}）`, true);
    } catch (err) {
      add(`書き込み（${name}）`, false, errText(err));
    }
    try {
      await handle.removeEntry(name);
      add(`後始末（${name}）`, true);
    } catch (err) {
      add(`後始末（${name}）`, false, errText(err));
    }
  }

  return rows;
}
