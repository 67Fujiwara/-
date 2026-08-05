import { useState } from 'react';
import { resolveFolderTarget } from '../lib/project.js';
import LinkChip from './LinkChip.jsx';

const COLOR = '#c2820a';

/** 小さくてもフォルダに見えるよう、奥のタブと手前の面を描き分ける */
function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        opacity="0.55"
        d="M1.2 4.2c0-1 .8-1.8 1.8-1.8h3.1c.5 0 .9.2 1.3.5l1.1 1.1H13c1 0 1.8.8 1.8 1.8v1.3H1.2V4.2Z"
      />
      <path fill="currentColor" d="M1.2 6.6h13.6v5.2c0 1-.8 1.8-1.8 1.8H3c-1 0-1.8-.8-1.8-1.8V6.6Z" />
    </svg>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // クリップボードAPIが使えない環境（古いブラウザなど）向けの代替手段
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * プロジェクトの保管フォルダへのボタン。
 * ダイレクトクラウド等の URL はクリックで開き、
 * ローカル/共有フォルダのパスはクリックでコピーする
 * （ブラウザからエクスプローラーは開けないため）。
 */
export default function FolderLink({ url }) {
  const [toast, setToast] = useState('');
  const target = resolveFolderTarget(url);
  if (!target) return null;

  if (target.kind === 'url') {
    return (
      <LinkChip
        href={target.href}
        color={COLOR}
        label="プロジェクトのフォルダを開く"
        title={`プロジェクトのフォルダを開く\n${target.href}`}
      >
        <FolderIcon />
      </LinkChip>
    );
  }

  const handleCopy = async (event) => {
    event.stopPropagation();
    const ok = await copyText(target.path);
    setToast(ok ? 'パスをコピーしました。エクスプローラーに貼り付けてください' : 'コピーできませんでした');
    window.setTimeout(() => setToast(''), 3000);
  };

  return (
    <span className="linkchip-wrap">
      <button
        type="button"
        className="linkchip"
        style={{ '--chip-color': COLOR }}
        aria-label="フォルダのパスをコピー"
        title={`フォルダのパスをコピー（エクスプローラーのアドレス欄に貼り付け）\n${target.path}`}
        onClick={handleCopy}
      >
        <FolderIcon />
      </button>
      {toast && (
        <span className="linkchip__toast" role="status">
          {toast}
        </span>
      )}
    </span>
  );
}
