import { diffDays, parseDate, today } from './date.js';
import { clampNotifyDays, departmentsOf } from './project.js';

const KEY = 'project-gantt-board:dueAlert';

export const DEFAULT_DAYS = 3;
export const MAX_DAYS = 60;

/**
 * 「何日前に知らせるか」の選べる値。
 * 期間の長いタスクは 1週間前、短いタスクは当日、のように TODO ごとに変えられる。
 */
export const NOTIFY_CHOICES = [
  { value: 0, label: '当日' },
  { value: 1, label: '1日前' },
  { value: 3, label: '3日前' },
  { value: 7, label: '1週間前' },
  { value: 14, label: '2週間前' },
  { value: 30, label: '1か月前' },
];

/** 全体設定の「何日前」。0〜60日の整数に丸める */
export function clampDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(0, Math.round(n)));
}

/** その TODO に実際に使われる「何日前」。個別設定が無ければ全体設定 */
export function effectiveNotifyDays(todo, defaultDays) {
  const own = clampNotifyDays(todo?.notifyDays);
  return own === null ? clampDays(defaultDays) : own;
}

export function notifyDaysLabel(days) {
  const found = NOTIFY_CHOICES.find((c) => c.value === days);
  return found ? found.label : `${days}日前`;
}

export function loadAlertSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      // 既定は「知らせる」。明示的に false のときだけ止める
      enabled: raw.enabled !== false,
      days: clampDays(raw.days ?? DEFAULT_DAYS),
      // 開始日のお知らせも既定でオン
      notifyStart: raw.notifyStart !== false,
      // 1日1回にするための「最後に出した日」
      lastShown: typeof raw.lastShown === 'string' ? raw.lastShown : '',
    };
  } catch {
    return { enabled: true, days: DEFAULT_DAYS, notifyStart: true, lastShown: '' };
  }
}

export function saveAlertSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくても表示自体はできるので、失敗しても止めない
  }
}

/** 進行中プロジェクトの未完了 TODO を、工程の情報つきで取り出す */
function* pendingTodos(projects) {
  for (const project of projects) {
    if (project.completedAt) continue;
    const deptById = new Map(departmentsOf(project).map((d) => [d.id, d]));
    for (const todo of project.todos) {
      if (todo.done) continue;
      yield {
        key: `${project.id}:${todo.id}`,
        projectId: project.id,
        projectName: project.name,
        client: project.client,
        dept: deptById.get(todo.dept) || null,
        text: todo.text,
        todo,
      };
    }
  }
}

/**
 * 期限（終了日）が近い、または過ぎている未完了 TODO。
 * 何日前から対象にするかは TODO ごとの設定を優先し、無ければ defaultDays を使う。
 * 期限切れは日数の設定に関係なく必ず含める。締め切りが早い順。
 */
export function collectDueTodos(projects, defaultDays) {
  const base = today();
  const rows = [];

  for (const entry of pendingTodos(projects)) {
    const { todo } = entry;
    if (!todo.end) continue;
    const end = parseDate(todo.end);
    if (!end) continue;
    const left = diffDays(base, end);
    const notifyDays = effectiveNotifyDays(todo, defaultDays);
    if (left > notifyDays) continue;
    rows.push({ ...entry, end: todo.end, left, notifyDays });
  }

  rows.sort((a, b) => a.left - b.left || a.projectName.localeCompare(b.projectName, 'ja'));
  return rows;
}

/**
 * 開始日が来た（または過ぎた）未完了 TODO。開始日が早い順。
 * すでに期限のお知らせに出ているものは、二重に出さないため除く。
 */
export function collectStartingTodos(projects, excludeKeys = []) {
  const base = today();
  const skip = new Set(excludeKeys);
  const rows = [];

  for (const entry of pendingTodos(projects)) {
    const { todo } = entry;
    if (!todo.start || skip.has(entry.key)) continue;
    const start = parseDate(todo.start);
    if (!start) continue;
    const passed = diffDays(start, base);
    if (passed < 0) continue;
    rows.push({ ...entry, start: todo.start, end: todo.end, passed });
  }

  rows.sort((a, b) => b.passed - a.passed || a.projectName.localeCompare(b.projectName, 'ja'));
  return rows;
}

/** プロジェクトごとにまとめる（並び順は元のまま） */
export function groupByProject(rows) {
  const groups = [];
  const index = new Map();
  for (const row of rows) {
    let group = index.get(row.projectId);
    if (!group) {
      group = { id: row.projectId, name: row.projectName, client: row.client, items: [] };
      index.set(row.projectId, group);
      groups.push(group);
    }
    group.items.push(row);
  }
  return groups;
}

/** 残り日数の表示（過ぎているものは「◯日超過」） */
export function leftLabel(left) {
  if (left < 0) return `${-left}日超過`;
  if (left === 0) return '今日まで';
  return `あと${left}日`;
}

/** 開始日からの経過の表示 */
export function startLabel(passed) {
  if (passed === 0) return '今日から';
  return `${passed}日前に開始`;
}
