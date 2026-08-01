import { SCHEMA_VERSION, STORAGE_KEY } from '../constants.js';
import { normalizeDepartments } from './departments.js';
import { normalizeProject } from './project.js';
import { sampleBoard } from './sampleData.js';

/**
 * 保存データを読み込む。
 * v1（プロジェクトの配列のみ）で保存されたデータは、初期の4工程を補って読み込む。
 */
export function loadBoard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return sampleBoard();
    const parsed = JSON.parse(raw);

    // v1: プロジェクトの配列がそのまま入っている
    if (Array.isArray(parsed)) {
      const departments = normalizeDepartments(null);
      return { departments, projects: parsed.map((p) => normalizeProject(p, departments)) };
    }

    if (parsed && Array.isArray(parsed.projects)) {
      const departments = normalizeDepartments(parsed.departments);
      return { departments, projects: parsed.projects.map((p) => normalizeProject(p, departments)) };
    }

    return sampleBoard();
  } catch (err) {
    console.warn('保存データを読み込めませんでした。初期データを表示します。', err);
    return sampleBoard();
  }
}

export function saveBoard(board) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, departments: board.departments, projects: board.projects })
    );
    return true;
  } catch (err) {
    console.warn('保存に失敗しました。', err);
    return false;
  }
}
