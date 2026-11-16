/**
 * ブラウザの通常のダウンロードでファイルを保存する。
 *
 * フォルダへの直接書き込み（File System Access）は、クラウド同期ドライブなど
 * 環境によっては失敗する。そのときでも手元に残せるよう、この方法を残しておく。
 * 日本語のファイル名はブラウザによって落ちるので、呼び出し側で ASCII にすること。
 */
export function downloadTextFile(text, fileName, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
