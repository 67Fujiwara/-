import { isSafeUrl } from '../lib/project.js';
import LinkChip from './LinkChip.jsx';

/** Slack スレッドへのリンク */
export default function SlackLink({ url }) {
  if (!isSafeUrl(url)) return null;
  return (
    <LinkChip
      href={url}
      color="#4a154b"
      label="Slack のスレッドを開く"
      title={`Slack のスレッドを開く\n${url}`}
    >
      #
    </LinkChip>
  );
}
