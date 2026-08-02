/**
 * プロジェクト名の右に並べる小さなリンク（18px角）。
 * URL は長いので表示せず、アイコンだけ置いて場所を取らないようにする。
 */
export default function LinkChip({ href, color, label, title, children }) {
  if (!href) return null;
  return (
    <a
      className="linkchip"
      style={{ '--chip-color': color }}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={title}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  );
}
