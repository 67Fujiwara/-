/**
 * 工程バッジ（担当者名つき）。担当未設定なら薄く表示する。
 * ガントのバーと同じ割合で背景を塗り、一覧のまま進み具合が分かるようにしている。
 */
export default function DeptChip({ dept, owners = [], progress = 0, dimmed = false }) {
  if (!dept) return null;
  // 同じ工程に複数の担当がいる場合はまとめて表示する
  const names = owners.filter((o) => o && o.trim());
  const text = names.length > 0 ? names.join('・') : '—';
  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  return (
    <span
      className={`dept-chip ${dimmed ? 'is-dimmed' : ''} ${names.length > 0 ? '' : 'is-empty'}`}
      style={{ '--dept-color': dept.color }}
      title={`${dept.label}: ${names.length > 0 ? names.join('、') : '担当未設定'}\n進捗 ${pct}%`}
    >
      <span className="dept-chip__fill" style={{ width: `${pct}%` }} />
      <span className="dept-chip__label">{dept.label}</span>
      <span className="dept-chip__owner">{text}</span>
      <span className="dept-chip__pct">{pct}%</span>
    </span>
  );
}
