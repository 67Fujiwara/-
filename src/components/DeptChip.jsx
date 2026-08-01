/** 工程バッジ（担当者名つき）。担当未設定なら薄く表示する。 */
export default function DeptChip({ dept, owner, dimmed = false }) {
  if (!dept) return null;
  return (
    <span
      className={`dept-chip ${dimmed ? 'is-dimmed' : ''} ${owner ? '' : 'is-empty'}`}
      style={{ '--dept-color': dept.color }}
      title={`${dept.label}: ${owner || '担当未設定'}`}
    >
      <span className="dept-chip__label">{dept.label}</span>
      <span className="dept-chip__owner">{owner || '—'}</span>
    </span>
  );
}
