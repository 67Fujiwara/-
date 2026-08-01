import { DEPT_MAP } from '../constants.js';

/** 部署バッジ（担当者名つき）。担当未設定なら薄く表示する。 */
export default function DeptChip({ deptKey, owner, dimmed = false, size = 'md' }) {
  const dept = DEPT_MAP[deptKey];
  if (!dept) return null;
  return (
    <span
      className={`dept-chip dept-chip--${size} ${dimmed ? 'is-dimmed' : ''} ${owner ? '' : 'is-empty'}`}
      style={{ '--dept-color': dept.color, '--dept-soft': dept.soft }}
      title={`${dept.label}: ${owner || '担当未設定'}`}
    >
      <span className="dept-chip__label">{dept.label}</span>
      <span className="dept-chip__owner">{owner || '—'}</span>
    </span>
  );
}
