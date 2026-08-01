import { isSafeUrl } from '../lib/project.js';

/**
 * Slack スレッドへのリンク。
 * URL は長いので表示せず、アイコン1つ分の幅だけを使う（URL はツールチップで確認できる）。
 */
export default function SlackLink({ url, className = '' }) {
  if (!isSafeUrl(url)) return null;
  return (
    <a
      className={`slack-link ${className}`}
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={`Slack のスレッドを開く\n${url}`}
      aria-label="Slack のスレッドを開く"
      onClick={(e) => e.stopPropagation()}
    >
      #
    </a>
  );
}
