import { STORAGE_KEY } from '../constants.js';
import { normalizeProject } from './project.js';
import { sampleProjects } from './sampleData.js';

export function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return sampleProjects();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return sampleProjects();
    return parsed.map(normalizeProject);
  } catch (err) {
    console.warn('保存データを読み込めませんでした。初期データを表示します。', err);
    return sampleProjects();
  }
}

export function saveProjects(projects) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch (err) {
    console.warn('保存に失敗しました。', err);
    return false;
  }
}

export function clearProjects() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('保存データを削除できませんでした。', err);
  }
}
