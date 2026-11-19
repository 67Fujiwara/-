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
    return (
      <div className="backup backup--warn">
        <span className="backup__icon" aria-hidden="true">
          !
        </span>
        <span className="backup__text">
          データはこのブラウザの中だけに保存されています。
          <b>バックアップ先フォルダ</b>を決めておくと、自動で書き出します。
        </span>
        <button type="button" className="btn btn--sm btn--primary" onClick={chooseFolder}>
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

  if (status === 'error') {
    return (
      <div className="backup backup--error">
        <span className="backup__icon" aria-hidden="true">
          !
        </span>
        <span className="backup__text">
          バックアップに失敗しました: {error}
          <br />
          このフォルダに書けない場合は、ローカルのフォルダを選び直すか、
          「ダウンロードで保存」で手元に残してください。
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
  return (
    <div className={`backup ${stale !== null && stale >= 3 ? 'backup--warn' : ''}`}>
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
