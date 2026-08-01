import { parseDate, spanDays, todayISO } from './date.js';

export function createId(prefix = 'p') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyPhase() {
  return { owner: '', start: '', end: '', progress: 0 };
}

export function emptyPhases(departments) {
  return Object.fromEntries(departments.map((d) => [d.id, emptyPhase()]));
}

export function createProject(input = {}, departments = []) {
  return {
    id: createId(),
    name: input.name?.trim() || '新規プロジェクト',
    client: input.client?.trim() || '',
    note: input.note?.trim() || '',
    launchDate: input.launchDate || '',
    phases: { ...emptyPhases(departments), ...(input.phases || {}) },
    todos: input.todos || [],
    completedAt: null,
    createdAt: todayISO(),
  };
}

/** 保存データを現在のスキーマに合わせて補正する（古いデータ・壊れたデータ対策） */
export function normalizeProject(raw, departments = []) {
  const phases = {};
  // 工程定義にあるものと、保存済みデータに残っているものの両方を残す
  const phaseIds = new Set([...departments.map((d) => d.id), ...Object.keys(raw?.phases || {})]);
  for (const id of phaseIds) {
    const p = raw?.phases?.[id] || {};
    phases[id] = {
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
    launchDate: typeof raw?.launchDate === 'string' ? raw.launchDate : '',
    phases,
    todos: Array.isArray(raw?.todos)
      ? raw.todos.map((t) => ({
          id: t?.id || createId('t'),
          text: t?.text || '',
          done: Boolean(t?.done),
          dept: typeof t?.dept === 'string' ? t.dept : '',
          // 旧スキーマの due（期限）は終了日として引き継ぐ
          start: typeof t?.start === 'string' ? t.start : '',
          end: typeof t?.end === 'string' ? t.end : typeof t?.due === 'string' ? t.due : '',
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

export function phaseOf(project, deptId) {
  return project.phases?.[deptId] || emptyPhase();
}

export function todosOfDept(project, deptId) {
  return project.todos.filter((t) => t.dept === deptId);
}

/**
 * 工程の進捗。その工程の TODO が1件でもあれば TODO の完了率を使い（自動）、
 * 無ければ手入力した値を使う（手動）。
 */
export function phaseProgress(project, deptId) {
  const phase = phaseOf(project, deptId);
  const todos = todosOfDept(project, deptId);
  if (todos.length === 0) {
    return { value: clampProgress(phase.progress), auto: false, done: 0, total: 0 };
  }
  const done = todos.filter((t) => t.done).length;
  return {
    value: Math.round((done / todos.length) * 100),
    auto: true,
    done,
    total: todos.length,
  };
}

/** 日付が入っている工程だけを返す */
export function scheduledPhases(project, departments) {
  return departments
    .map((dept) => ({ dept, phase: phaseOf(project, dept.id) }))
    .filter(({ phase }) => phase.start && phase.end);
}

/** プロジェクト全体の期間（立ち上げ日も含む。日付が1つも無ければ null） */
export function projectRange(project, departments) {
  let start = null;
  let end = null;
  const extend = (d) => {
    if (!d) return;
    if (!start || d < start) start = d;
    if (!end || d > end) end = d;
  };
  for (const { phase } of scheduledPhases(project, departments)) {
    extend(parseDate(phase.start));
    extend(parseDate(phase.end));
  }
  extend(parseDate(project.launchDate));
  if (!start || !end) return null;
  return { start, end };
}

/** 工程の日数で重み付けした全体進捗（%） */
export function projectProgress(project, departments) {
  const scheduled = scheduledPhases(project, departments);
  if (scheduled.length === 0) {
    // 工程に日付が無い場合は TODO の完了率をそのまま全体進捗とする
    const { total, done } = todoStats(project);
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }
  let weighted = 0;
  let total = 0;
  for (const { dept, phase } of scheduled) {
    const days = Math.max(1, spanDays(phase.start, phase.end));
    weighted += phaseProgress(project, dept.id).value * days;
    total += days;
  }
  return total === 0 ? 0 : Math.round(weighted / total);
}

export function todoStats(project) {
  const total = project.todos.length;
  const done = project.todos.filter((t) => t.done).length;
  return { total, done, remaining: total - done };
}
