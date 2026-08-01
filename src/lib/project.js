import { DEPARTMENTS } from '../constants.js';
import { parseDate, spanDays, todayISO } from './date.js';

export function createId(prefix = 'p') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyPhases() {
  return Object.fromEntries(
    DEPARTMENTS.map((d) => [d.key, { owner: '', start: '', end: '', progress: 0 }])
  );
}

export function createProject(input = {}) {
  return {
    id: createId(),
    name: input.name?.trim() || '新規プロジェクト',
    client: input.client?.trim() || '',
    note: input.note?.trim() || '',
    phases: { ...emptyPhases(), ...(input.phases || {}) },
    todos: input.todos || [],
    completedAt: null,
    createdAt: todayISO(),
  };
}

/** 保存データを現在のスキーマに合わせて補正する（古いデータ・壊れたデータ対策） */
export function normalizeProject(raw) {
  const phases = {};
  for (const dept of DEPARTMENTS) {
    const p = raw?.phases?.[dept.key] || {};
    phases[dept.key] = {
      owner: typeof p.owner === 'string' ? p.owner : '',
      start: typeof p.start === 'string' ? p.start : '',
      end: typeof p.end === 'string' ? p.end : '',
      progress: clampProgress(p.progress),
    };
  }
  return {
    id: raw?.id || createId(),
    name: raw?.name || '無題プロジェクト',
    client: raw?.client || '',
    note: raw?.note || '',
    phases,
    todos: Array.isArray(raw?.todos)
      ? raw.todos.map((t) => ({
          id: t?.id || createId('t'),
          text: t?.text || '',
          done: Boolean(t?.done),
          dept: DEPARTMENTS.some((d) => d.key === t?.dept) ? t.dept : '',
          due: typeof t?.due === 'string' ? t.due : '',
        }))
      : [],
    completedAt: typeof raw?.completedAt === 'string' ? raw.completedAt : null,
    createdAt: raw?.createdAt || todayISO(),
  };
}

export function clampProgress(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** 日付が入っている工程だけを返す */
export function scheduledPhases(project) {
  return DEPARTMENTS.map((dept) => ({ dept, phase: project.phases[dept.key] })).filter(
    ({ phase }) => phase && phase.start && phase.end
  );
}

/** プロジェクト全体の期間（日付未設定なら null） */
export function projectRange(project) {
  const scheduled = scheduledPhases(project);
  if (scheduled.length === 0) return null;
  let start = null;
  let end = null;
  for (const { phase } of scheduled) {
    const s = parseDate(phase.start);
    const e = parseDate(phase.end);
    if (!s || !e) continue;
    if (!start || s < start) start = s;
    if (!end || e > end) end = e;
  }
  if (!start || !end) return null;
  return { start, end };
}

/** 工程の日数で重み付けした全体進捗（%） */
export function projectProgress(project) {
  const scheduled = scheduledPhases(project);
  if (scheduled.length === 0) return 0;
  let weighted = 0;
  let total = 0;
  for (const { phase } of scheduled) {
    const days = Math.max(1, spanDays(phase.start, phase.end));
    weighted += clampProgress(phase.progress) * days;
    total += days;
  }
  return total === 0 ? 0 : Math.round(weighted / total);
}

export function todoStats(project) {
  const total = project.todos.length;
  const done = project.todos.filter((t) => t.done).length;
  return { total, done, remaining: total - done };
}

/** 担当者が1人でも登録されている部署 */
export function assignedDepartments(project) {
  return DEPARTMENTS.filter((d) => {
    const phase = project.phases[d.key];
    return phase && (phase.owner || (phase.start && phase.end));
  });
}
