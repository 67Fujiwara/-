import { DEFAULT_DEPARTMENTS, SCHEMA_VERSION, STORAGE_KEY } from '../constants.js';
import { normalizeDepartments } from './departments.js';
import { normalizeProject } from './project.js';
import { sampleProjects } from './sampleData.js';

/**
 * 保存データを読み込む。工程はプロジェクトごとに持つ形式（v3）。
 * 旧形式も読み込める。
 *   v1: プロジェクトの配列だけ            → 既定の工程を各プロジェクトに複製
 *   v2: { departments, projects }        → 共通工程 + 専用工程を各プロジェクトの工程として統合
 */
export function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return sampleProjects();
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.map((p) => normalizeProject(p, DEFAULT_DEPARTMENTS));
    }

    if (parsed && Array.isArray(parsed.projects)) {
      // v2 の共通工程は、各プロジェクトの工程の土台として引き継ぐ
      const shared = parsed.departments
        ? normalizeDepartments(parsed.departments)
        : DEFAULT_DEPARTMENTS;
      return parsed.projects.map((p) => normalizeProject(p, shared));
    }

    return sampleProjects();
  } catch (err) {
    console.warn('保存データを読み込めませんでした。初期データを表示します。', err);
    return sampleProjects();
  }
}

export function saveProjects(projects) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, projects }));
    return true;
  } catch (err) {
    console.warn('保存に失敗しました。', err);
    return false;
  }
}
