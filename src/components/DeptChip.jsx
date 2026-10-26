/** 工程バッジ（担当者名つき）。担当未設定なら薄く表示する。 */
export default function DeptChip({ dept, owners = [], dimmed = false }) {
  if (!dept) return null;
  // 同じ工程に複数の担当がいる場合はまとめて表示する
  const names = owners.filter((o) => o && o.trim());
  const text = names.length > 0 ? names.join('・') : '—';
  const status = (dept.status || '').trim();
  return (
    <span
      className={[
        'dept-chip',
        dimmed ? 'is-dimmed' : '',
        names.length > 0 ? '' : 'is-empty',
        status ? 'has-status' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--dept-color': dept.color }}
      title={`${dept.label}: ${names.length > 0 ? names.join('、') : '担当未設定'}${
        status ? `\nステータス: ${status}` : ''
      }`}
    >
      <span className="dept-chip__label">{dept.label}</span>
      <span className="dept-chip__owner">{text}</span>
      {status && <span className="dept-chip__status">{status}</span>}
    </span>
  );
}
