import { DEFAULT_DEPARTMENTS, DEPT_COLOR_PALETTE } from '../constants.js';

export function createDepartmentId() {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** まだ使われていない色を優先して返す */
export function nextColor(departments) {
  const used = new Set(departments.map((d) => d.color));
  return DEPT_COLOR_PALETTE.find((c) => !used.has(c)) || DEPT_COLOR_PALETTE[departments.length % DEPT_COLOR_PALETTE.length];
}

export function createDepartment(departments, label = '新しい工程') {
  return { id: createDepartmentId(), label, color: nextColor(departments) };
}

/** 保存データの工程定義を補正する。空・壊れている場合は初期値に戻す。 */
export function normalizeDepartments(list) {
  if (!Array.isArray(list)) return DEFAULT_DEPARTMENTS.map((d) => ({ ...d }));
  const seen = new Set();
  const result = [];
  for (const raw of list) {
    const id = typeof raw?.id === 'string' && raw.id ? raw.id : createDepartmentId();
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      label: typeof raw?.label === 'string' && raw.label.trim() ? raw.label.trim() : '無題の工程',
      color: /^#[0-9a-fA-F]{6}$/.test(raw?.color) ? raw.color : DEPT_COLOR_PALETTE[result.length % DEPT_COLOR_PALETTE.length],
    });
  }
  return result.length > 0 ? result : DEFAULT_DEPARTMENTS.map((d) => ({ ...d }));
}

export function findDepartment(departments, id) {
  return departments.find((d) => d.id === id) || null;
}
