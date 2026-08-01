import { useRef, useState } from 'react';
import { toExportJson, parseImportedJson } from '../lib/storage.js';
import { todayISO } from '../lib/date.js';

/**
 * データの書き出し／読み込み。
 * 共有フォルダ（ダイレクトクラウドなど）に JSON を置いて受け渡しする運用のためのボタン。
 */
export default function DataTransfer({ projects, onImport }) {
  const fileRef = useRef(null);
  const [message, setMessage] = useState(null);

  const notify = (text, isError = false) => {
    setMessage({ text, isError });
    window.setTimeout(() => setMessage(null), 5000);
  };

  // 日本語のファイル名はブラウザによって落ちるので ASCII にする
  const fileName = () => `project-board_${todayISO()}.json`;

  /** ダウンロードフォルダに保存する（保存先を選べないブラウザ向けの方法） */
  const downloadFile = (text) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExport = async () => {
    const text = toExportJson(projects);

    // 対応ブラウザ（Chrome / Edge）では保存先を選べる。
    // 共有フォルダの同じファイルに上書きしたい運用で便利。
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName(),
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        notify(`${projects.length} 件を保存しました`);
        return;
      } catch (err) {
        // ユーザーが保存ダイアログを閉じただけなら何もしない
        if (err?.name === 'AbortError') return;
        // それ以外（未対応・権限エラーなど）は通常のダウンロードに切り替える
      }
    }

    downloadFile(text);
    notify(`${projects.length} 件を書き出しました`);
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // 同じファイルを続けて選んでも反応するように、入力はすぐ空にする
    event.target.value = '';
    if (!file) return;

    try {
      const imported = parseImportedJson(await file.text());
      const ok = window.confirm(
        `「${file.name}」を読み込みます。\n\n` +
          `　読み込むデータ: ${imported.length} 件\n` +
          `　今のデータ: ${projects.length} 件（置き換わります）\n\n` +
          '今のデータが必要な場合は、先に「書き出し」で保存してください。'
      );
      if (!ok) return;
      onImport(imported);
      notify(`${imported.length} 件を読み込みました`);
    } catch (err) {
      notify(err instanceof SyntaxError ? 'JSON として読み取れませんでした' : err.message, true);
    }
  };

  return (
    <div className="datatransfer">
      <button type="button" className="btn btn--ghost btn--sm" onClick={handleExport} title="今のデータをJSONファイルに保存します">
        書き出し
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => fileRef.current?.click()}
        title="JSONファイルを読み込んで、今のデータを置き換えます"
      >
        読み込み
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="datatransfer__file"
        onChange={handleFile}
      />
      {message && (
        <span className={`datatransfer__msg ${message.isError ? 'is-error' : ''}`} role="status">
          {message.text}
        </span>
      )}
    </div>
  );
}
