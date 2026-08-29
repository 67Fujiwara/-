import { isSafeUrl } from '../lib/project.js';
import LinkChip from './LinkChip.jsx';

/**
 * Fusion（Autodesk Fusion / Fusion 360）のデータへのリンク。
 * 共有リンクは a360.co や autodesk360.com の URL になる。
 */
export default function FusionLink({ url }) {
  if (!isSafeUrl(url)) return null;
  return (
    <LinkChip
      href={url}
      color="#e8630a"
      label="Fusion のデータを開く"
      title={`Fusion のデータを開く\n${url}`}
    >
      F
    </LinkChip>
  );
}
