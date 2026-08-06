import { DEFAULT_DEPARTMENTS, SCHEMA_VERSION, STORAGE_KEY } from '../constants.js';
import { normalizeDepartments } from './departments.js';
import { normalizeProject } from './project.js';
import { sampleProjects } from './sampleData.js';

/**
 * 起動した時点で保存データがあったか。
 * 起動直後に saveProjects() がサンプルデータを書き込むので、
 * この判定はモジュールの読み込み時（＝画面が動き出す前）に済ませておく。
 * 自動バックアップが「サンプル表示中のデータ」で正しいバックアップを
 * 上書きしてしまわないようにするために使う。
 */
const startedWithStoredData = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
})();

export function hadStoredDataAtStartup() {
  return startedWithStoredData;
}

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

/** 書き出し用の JSON 文字列（人が見ても分かるように整形する） */
export function toExportJson(projects) {
  return JSON.stringify(
    { version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), projects },
    null,
    2
  );
}

/**
 * 読み込んだ JSON をプロジェクト配列に変換する。
 * 書き出し形式のほか、旧形式（配列だけ／共通工程つき）もそのまま読める。
 * 内容が違う場合は例外を投げるので、呼び出し側でメッセージを出すこと。
 */
export function parseImportedJson(text) {
  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : parsed?.projects;
  if (!Array.isArray(list)) {
    throw new Error('プロジェクトの一覧が見つかりません。このアプリで書き出したファイルを選んでください。');
  }
  const shared = parsed?.departments ? normalizeDepartments(parsed.departments) : DEFAULT_DEPARTMENTS;
  return list.map((p) => normalizeProject(p, shared));
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
