import { toFolderHref } from '../lib/project.js';
import LinkChip from './LinkChip.jsx';

/** プロジェクトの保管フォルダ（ダイレクトクラウド等）へのリンク */
export default function FolderLink({ url }) {
  const href = toFolderHref(url);
  if (!href) return null;
  return (
    <LinkChip
      href={href}
      color="#c2820a"
      label="プロジェクトのフォルダを開く"
      title={`プロジェクトのフォルダを開く\n${url}`}
    >
      {/* 小さくてもフォルダに見えるよう、奥のタブと手前の面を描き分ける */}
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          opacity="0.55"
          d="M1.2 4.2c0-1 .8-1.8 1.8-1.8h3.1c.5 0 .9.2 1.3.5l1.1 1.1H13c1 0 1.8.8 1.8 1.8v1.3H1.2V4.2Z"
        />
        <path
          fill="currentColor"
          d="M1.2 6.6h13.6v5.2c0 1-.8 1.8-1.8 1.8H3c-1 0-1.8-.8-1.8-1.8V6.6Z"
        />
      </svg>
    </LinkChip>
  );
}
