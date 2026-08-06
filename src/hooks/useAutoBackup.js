import { useCallback, useEffect, useRef, useState } from 'react';
import { todayISO } from '../lib/date.js';
import { hadStoredDataAtStartup, toExportJson } from '../lib/storage.js';
import {
  backupFileName,
  dirPermission,
  forgetBackupDir,
  isBackupSupported,
  loadBackupDir,
  pickBackupDir,
  writeBackup,
} from '../lib/backup.js';

const LAST_KEY = 'project-gantt-board:lastBackup';
/** 入力が落ち着いてから書き出すまでの待ち時間 */
const IDLE_MS = 3 * 60 * 1000;

function readLast() {
  try {
    return localStorage.getItem(LAST_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * 起動時と、編集が落ち着いたタイミングで、指定フォルダに JSON を書き出す。
 *
 * status:
 *   'unsupported'      … このブラウザでは使えない
 *   'off'              … バックアップ先が未設定
 *   'need-permission'  … 設定済みだが、書き込み許可を取り直す必要がある
 *   'ready'            … 使える状態（lastAt に最後に書けた日時が入る）
 *   'saving' / 'error'
 */
export function useAutoBackup(projects) {
  const [status, setStatus] = useState(() => (isBackupSupported() ? 'off' : 'unsupported'));
  const [dirName, setDirName] = useState('');
  const [lastAt, setLastAt] = useState(readLast);
  const [error, setError] = useState('');

  const handleRef = useRef(null);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  // サンプル表示中に本物のバックアップを上書きしないよう、
  // 保存データが無い状態で起動した場合は、何か編集されるまで書き出さない
  const allowWriteRef = useRef(hadStoredDataAtStartup());

  const runBackup = useCallback(async ({ force = false } = {}) => {
    const handle = handleRef.current;
    if (!handle || (!allowWriteRef.current && !force)) return false;
    setStatus('saving');
    try {
      if ((await dirPermission(handle)) !== 'granted') {
        setStatus('need-permission');
        return false;
      }
      const text = toExportJson(projectsRef.current);
      await writeBackup(handle, backupFileName(todayISO()), text);
      const stamp = new Date().toISOString();
      try {
        localStorage.setItem(LAST_KEY, stamp);
      } catch {
        // 記録できなくてもバックアップ自体は成功しているので続行する
      }
      setLastAt(stamp);
      setError('');
      setStatus('ready');
      return true;
    } catch (err) {
      setError(err?.message || '書き出しに失敗しました');
      setStatus('error');
      return false;
    }
  }, []);

  // 起動時: 覚えているフォルダを読み、許可が生きていればそのまま書き出す
  useEffect(() => {
    if (!isBackupSupported()) return;
    let cancelled = false;
    (async () => {
      const handle = await loadBackupDir();
      if (cancelled || !handle) return;
      handleRef.current = handle;
      setDirName(handle.name || '');
      if ((await dirPermission(handle)) === 'granted') await runBackup();
      else if (!cancelled) setStatus('need-permission');
    })();
    return () => {
      cancelled = true;
    };
  }, [runBackup]);

  // 編集が止まってしばらくしたら、その日のファイルを上書きする
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return undefined;
    }
    // 一度でも編集されたら、サンプル起動でも書き出してよい
    allowWriteRef.current = true;
    if (!handleRef.current) return undefined;
    const timer = window.setTimeout(() => {
      runBackup();
    }, IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [projects, runBackup]);

  const chooseFolder = useCallback(async () => {
    try {
      const handle = await pickBackupDir();
      if (!handle) return;
      handleRef.current = handle;
      setDirName(handle.name || '');
      allowWriteRef.current = true;
      await runBackup({ force: true });
    } catch (err) {
      setError(err?.message || 'フォルダを設定できませんでした');
      setStatus('error');
    }
  }, [runBackup]);

  /** 許可を取り直す（クリックから呼ぶこと） */
  const grant = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    if ((await dirPermission(handle, true)) === 'granted') await runBackup();
    else setStatus('need-permission');
  }, [runBackup]);

  const disable = useCallback(async () => {
    await forgetBackupDir();
    handleRef.current = null;
    setDirName('');
    setError('');
    setStatus('off');
  }, []);

  const backupNow = useCallback(() => runBackup({ force: true }), [runBackup]);

  return { status, dirName, lastAt, error, chooseFolder, grant, disable, backupNow };
}
