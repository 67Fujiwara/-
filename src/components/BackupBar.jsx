import { useState } from 'react';
import { useAutoBackup } from '../hooks/useAutoBackup.js';

function formatStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 最後のバックアップから何日経ったか（不明なら null） */
function daysSince(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/**
 * 自動バックアップの状態表示と設定。
 * データはブラウザの中にしか無いので、共有フォルダなどに JSON を残しておくための機能。
 */
export default function BackupBar({ projects }) {
  const {
    status,
    dirName,
    lastAt,
    error,
    note,
    chooseFolder,
    grant,
    disable,
    backupNow,
    downloadNow,
    diagnose,
  } = useAutoBackup(projects);
  const [report, setReport] = useState(null);

  const runDiagnose = async () => {
    setReport([{ label: '調査中…', ok: true, detail: '' }]);
    setReport(await diagnose());
  };

  const copyReport = async () => {
    const text = (report || [])
      .map((r) => `${r.ok ? 'OK ' : 'NG '} ${r.label}${r.detail ? ' / ' + r.detail : ''}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('この内容をコピーして貼り付けてください', text);
    }
  };

  if (status === 'unsupported') return null;

  if (status === 'off') {
    const stale = daysSince(lastAt);
    return (
      <div className={`backup ${stale === null || stale >= 1 ? 'backup--warn' : ''}`}>
        <span className="backup__icon" aria-hidden="true">
          !
        </span>
        <span className="backup__text">
          データはこのブラウザの中だけに保存されています。
          <b>バックアップ先フォルダ</b>を決めると自動で書き出します。
          フォルダが使えない環境では「ダウンロードで保存」でも構いません。
          {lastAt && <> 　最終: {formatStamp(lastAt)}</>}
          {note && <> 　{note}</>}
        </span>
        <button type="button" className="btn btn--sm btn--primary" onClick={downloadNow}>
          ダウンロードで保存
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={chooseFolder}>
          バックアップ先を選ぶ
        </button>
      </div>
    );
  }

  if (status === 'need-permission') {
    return (
      <div className="backup backup--warn">
        <span className="backup__icon" aria-hidden="true">
          !
        </span>
        <span className="backup__text">
          バックアップ先（<b>{dirName}</b>）への書き込み許可が必要です。
          {lastAt && <>　最後のバックアップ: {formatStamp(lastAt)}</>}
        </span>
        <button type="button" className="btn btn--sm btn--primary" onClick={grant}>
          許可して書き出す
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={disable}>
          やめる
        </button>
      </div>
    );
  }

  // フォルダの名前が変わった・移動した・消えた場合。選び直す以外に直しようがない
  if (status === 'missing') {
    return (
      <div className="backup backup--error">
        <span className="backup__icon" aria-hidden="true">
          !
        </span>
        <span className="backup__text">
          バックアップ先のフォルダ（<b>{dirName || '設定済み'}</b>）が見つかりません。
          名前を変えた・移動した・削除した場合は、<b>選び直すまで元に戻りません</b>。
          {lastAt && <> 　最終: {formatStamp(lastAt)}</>}
          {note && <> 　{note}</>}
        </span>
        <button type="button" className="btn btn--sm btn--primary" onClick={chooseFolder}>
          フォルダを選び直す
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={downloadNow}>
          ダウンロードで保存
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={disable}>
          停止
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="backup backup--error">
        <span className="backup__icon" aria-hidden="true">
          !
        </span>
        <span className="backup__text">
          バックアップに失敗しました: {error}
          <br />
          現在の設定先: <b>{dirName || '（未設定）'}</b>
          {note && <> 　{note}</>}
        </span>
        <button type="button" className="btn btn--sm btn--primary" onClick={downloadNow}>
          ダウンロードで保存
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={backupNow}>
          再試行
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={chooseFolder}>
          フォルダを選び直す
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={runDiagnose}>
          詳しく調べる
        </button>
        {report && (
          <div className="backup__report">
            <ul>
              {report.map((r) => (
                <li key={r.label} className={r.ok ? 'is-ok' : 'is-ng'}>
                  <span className="backup__report-mark">{r.ok ? '✓' : '×'}</span>
                  <span>
                    {r.label}
                    {r.detail && <em>{r.detail}</em>}
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn--sm btn--ghost" onClick={copyReport}>
              結果をコピー
            </button>
          </div>
        )}
      </div>
    );
  }

  const stale = daysSince(lastAt);
  // 選び直しに失敗したときは、正常表示のままでも気づけるようにする
  const hasNote = Boolean(note);
  return (
    <div className={`backup ${hasNote || (stale !== null && stale >= 3) ? 'backup--warn' : ''}`}>
      <span className="backup__icon backup__icon--ok" aria-hidden="true">
        ✓
      </span>
      <span className="backup__text">
        バックアップ先: <b>{dirName}</b>
        {status === 'saving' ? (
          <>　書き出し中…</>
        ) : (
          lastAt && <>　最終: {formatStamp(lastAt)}</>
        )}
        {note && <>　{note}</>}
      </span>
      <button type="button" className="btn btn--sm btn--ghost" onClick={backupNow}>
        今すぐ書き出す
      </button>
      <button type="button" className="btn btn--sm btn--ghost" onClick={chooseFolder}>
        変更
      </button>
      <button type="button" className="btn btn--sm btn--ghost" onClick={disable}>
        停止
      </button>
    </div>
  );
}
