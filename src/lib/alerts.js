import { diffDays, parseDate, today } from './date.js';
import { departmentsOf } from './project.js';

const KEY = 'project-gantt-board:dueAlert';

export const DEFAULT_DAYS = 3;
export const MAX_DAYS = 60;

/** 何日前から知らせるか。0〜60日の整数に丸める */
export function clampDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(0, Math.round(n)));
}

export function loadAlertSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      // 既定は「知らせる」。明示的に false のときだけ止める
      enabled: raw.enabled !== false,
      days: clampDays(raw.days ?? DEFAULT_DAYS),
      // 1日1回にするための「最後に出した日」
      lastShown: typeof raw.lastShown === 'string' ? raw.lastShown : '',
    };
  } catch {
    return { enabled: true, days: DEFAULT_DAYS, lastShown: '' };
  }
}

export function saveAlertSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくても表示自体はできるので、失敗しても止めない
  }
}

/**
 * 期限（TODO の終了日）が近い、または過ぎている未完了 TODO を集める。
 * days は「何日前から対象にするか」。期限切れは日数に関係なく必ず含める。
 * 締め切りが早い順に並べて返す。
 */
export function collectDueTodos(projects, days) {
  const base = today();
  const limit = clampDays(days);
  const rows = [];

  for (const project of projects) {
    if (project.completedAt) continue;
    const deptById = new Map(departmentsOf(project).map((d) => [d.id, d]));

    for (const todo of project.todos) {
      if (todo.done || !todo.end) continue;
      const end = parseDate(todo.end);
      if (!end) continue;
      const left = diffDays(base, end);
      if (left > limit) continue;
      rows.push({
        key: `${project.id}:${todo.id}`,
        projectId: project.id,
        projectName: project.name,
        client: project.client,
        dept: deptById.get(todo.dept) || null,
        text: todo.text,
        end: todo.end,
        left,
      });
    }
  }

  rows.sort((a, b) => a.left - b.left || a.projectName.localeCompare(b.projectName, 'ja'));
  return rows;
}

/** プロジェクトごとにまとめる（並び順は締め切りが早い順のまま） */
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
