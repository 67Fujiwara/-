import { DEFAULT_DEPARTMENTS } from '../constants.js';
import { parseDate, spanDays, todayISO } from './date.js';
import { normalizeDepartments } from './departments.js';

export function createId(prefix = 'p') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 1つの工程に紐づく「担当者 + 期間」。同じ工程に複数持てる。 */
export function emptyAssignment() {
  return { id: createId('a'), owner: '', start: '', end: '', progress: 0 };
}

export function emptyPhase() {
  return [emptyAssignment()];
}

export function emptyPhases(departments) {
  return Object.fromEntries(departments.map((d) => [d.id, emptyPhase()]));
}

/** 保存データの担当を配列に整える（旧形式は担当1件として読み込む） */
function normalizeAssignments(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const result = list.map((a) => ({
    id: typeof a?.id === 'string' && a.id ? a.id : createId('a'),
    owner: typeof a?.owner === 'string' ? a.owner : '',
    start: typeof a?.start === 'string' ? a.start : '',
    end: typeof a?.end === 'string' ? a.end : '',
    progress: clampProgress(a?.progress),
  }));
  // 工程には最低1件の担当欄を持たせる（未入力でもよい）
  return result.length > 0 ? result : [emptyAssignment()];
}

/** 工程はプロジェクトごとに持つ。新規作成時は既定の工程を写して初期値にする。 */
export function createProject(input = {}) {
  const departments = normalizeDepartments(input.departments);
  return {
    id: createId(),
    name: input.name?.trim() || '新規プロジェクト',
    client: input.client?.trim() || '',
    note: input.note?.trim() || '',
    launchDate: input.launchDate || '',
    slackUrl: input.slackUrl || '',
    folderUrl: input.folderUrl || '',
    fusionUrl: input.fusionUrl || '',
    departments,
    phases: { ...emptyPhases(departments), ...(input.phases || {}) },
    todos: input.todos || [],
    completedAt: null,
    createdAt: todayISO(),
  };
}

/**
 * 保存データを現在のスキーマに合わせて補正する。
 * 旧データ（工程が全プロジェクト共通だった頃）は、共通工程 + そのプロジェクト固有工程を
 * まとめてこのプロジェクトの工程として引き継ぐ。
 */
export function normalizeProject(raw, fallbackDepartments = DEFAULT_DEPARTMENTS) {
  const departments =
    Array.isArray(raw?.departments) && raw.departments.length > 0
      ? normalizeDepartments(raw.departments)
      : normalizeDepartments([
          ...fallbackDepartments,
          ...normalizeDepartments(raw?.customDepartments, false),
        ]);
  const phases = {};
  // 工程定義にあるものと、保存済みデータに残っているものの両方を残す
  const phaseIds = new Set([...departments.map((d) => d.id), ...Object.keys(raw?.phases || {})]);
  for (const id of phaseIds) {
    phases[id] = normalizeAssignments(raw?.phases?.[id]);
  }
  return {
    id: raw?.id || createId(),
    name: raw?.name || '無題プロジェクト',
    client: raw?.client || '',
    note: raw?.note || '',
    launchDate: typeof raw?.launchDate === 'string' ? raw.launchDate : '',
    slackUrl: typeof raw?.slackUrl === 'string' ? raw.slackUrl : '',
    folderUrl: typeof raw?.folderUrl === 'string' ? normalizeFolderUrl(raw.folderUrl) : '',
    fusionUrl: typeof raw?.fusionUrl === 'string' ? raw.fusionUrl : '',
    departments,
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
          // 何日前に知らせるか。未設定（null）なら全体設定に従う
          notifyDays: clampNotifyDays(t?.notifyDays),
        }))
      : [],
    completedAt: typeof raw?.completedAt === 'string' ? raw.completedAt : null,
    createdAt: raw?.createdAt || todayISO(),
  };
}

/**
 * TODO ごとの「何日前に知らせるか」。
 * null は「全体設定に従う」。数値は 0〜60 日に丸める。
 */
export function clampNotifyDays(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(60, Math.max(0, Math.round(n)));
}

export function clampProgress(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * リンクとして開いてよい URL かどうか。
 * javascript: などのスキームを踏まないよう http/https だけを許可する。
 */
export function isSafeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const { protocol } = new URL(url.trim());
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** リンクにしてはいけないスキーム */
const BLOCKED_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'blob:']);

/**
 * フォルダの指定を解釈する。
 *   { kind: 'url',  href }  … ダイレクトクラウド等のURL。クリックで開く
 *   { kind: 'path', path }  … Windowsのフォルダパス。ブラウザでは開けないのでコピーさせる
 *   null                    … 開けない形式
 *
 * file:// のリンクはブラウザ内のフォルダ一覧が出るだけでエクスプローラーは開かないため、
 * ローカルのパスは「開く」ではなく「コピーする」扱いにしている。
 */
export function resolveFolderTarget(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  // UNC パス（\\サーバー名\共有名\...）とドライブレター（D:\... / D:/...）
  if (/^\\\\[^\\]/.test(raw) || /^[A-Za-z]:[\\/]/.test(raw)) {
    return { kind: 'path', path: raw };
  }

  try {
    const { protocol } = new URL(raw);
    if (BLOCKED_SCHEMES.has(protocol)) return null;
    // file:// を直接書かれた場合も、パスとして扱う
    if (protocol === 'file:') {
      return { kind: 'path', path: raw };
    }
    // http/https のほか、専用アプリのリンク（xxx://）もそのまま開けるようにする
    return { kind: 'url', href: raw };
  } catch {
    return null;
  }
}

/**
 * Windows のフォルダパスを openfolder: のリンクに変換する。
 * tools/openfolder-protocol.reg を入れた PC では、これがクリックで開ける。
 *
 * `openfolder://D:/…` と書くとブラウザが「D:」をホスト名とみなし、
 * ドライブレターのコロンを落として `openfolder://D/…` に書き換えてしまう。
 * そのため `//` を付けず `openfolder:D:/…` の形にしている。
 */
export function toOpenFolderUrl(path) {
  const raw = typeof path === 'string' ? path.trim() : '';
  if (!/^[A-Za-z]:[\\/]/.test(raw)) return null;
  return `openfolder:${raw.replace(/\\/g, '/')}`;
}

/**
 * 旧形式（`openfolder://D:/…` / コロンが落ちた `openfolder://D/…`）を
 * 現行の `openfolder:D:/…` に直す。保存データの読み込み時に通す。
 */
export function normalizeFolderUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const m = /^openfolder:\/+([A-Za-z])(:?)([\\/].*)$/.exec(raw);
  if (!m) return raw;
  return `openfolder:${m[1]}:${m[3].replace(/\\/g, '/')}`;
}

/** このプロジェクトの工程一覧 */
export function departmentsOf(project) {
  return project?.departments || [];
}

/** その工程に登録されている担当（＋期間）の一覧 */
export function assignmentsOf(project, deptId) {
  const value = project?.phases?.[deptId];
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/**
 * 期間が重ならない担当は同じ段にまとめる。
 * 列（レーン）を無駄に増やさず、重なったときだけ段が増える。
 */
export function packAssignments(assignments) {
  const dated = assignments
    .filter((a) => a.start && a.end)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

  const rows = [];
  for (const a of dated) {
    // 末尾が自分の開始より前に終わっている段があれば、そこに並べる
    const row = rows.find((r) => r[r.length - 1].end < a.start);
    if (row) row.push(a);
    else rows.push([a]);
  }
  return rows;
}

/** ガント上でその工程が使う段数（最低1段） */
export function laneCountOf(project, deptId) {
  return Math.max(1, packAssignments(assignmentsOf(project, deptId)).length);
}

export function todosOfDept(project, deptId) {
  return project.todos.filter((t) => t.dept === deptId);
}

/**
 * 工程の進捗。その工程の TODO が1件でもあれば TODO の完了率を使い（自動）、
 * 無ければ手入力した値を使う（手動）。
 */
export function phaseProgress(project, deptId) {
  const todos = todosOfDept(project, deptId);
  if (todos.length === 0) return { auto: false, done: 0, total: 0 };
  const done = todos.filter((t) => t.done).length;
  return {
    value: Math.round((done / todos.length) * 100),
    auto: true,
    done,
    total: todos.length,
  };
}

/**
 * 工程の進捗を、期間の早い担当から順に割り当てる。
 *
 * 同じ工程にバーが複数あるとき、全部を同じ割合で塗るとどこまで進んだのか
 * 分からない。そこで完了した日数分を先のバーから順に埋めていき、
 * 前のバーが 100% になってから次のバーが伸びるようにする。
 * 返り値は「担当ID → 進捗の割合（0〜1）」。
 */
function allocateDeptProgress(project, deptId, deptValue) {
  const dated = assignmentsOf(project, deptId)
    .filter((a) => a.start && a.end)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

  const daysOf = (a) => Math.max(1, spanDays(a.start, a.end));
  const totalDays = dated.reduce((sum, a) => sum + daysOf(a), 0);
  // 完了とみなす日数を、工程全体の進捗から求める
  let remaining = (totalDays * clampProgress(deptValue)) / 100;

  const ratios = new Map();
  for (const a of dated) {
    const days = daysOf(a);
    const filled = Math.min(days, Math.max(0, remaining));
    remaining -= filled;
    ratios.set(a.id, filled / days);
  }
  return ratios;
}

/**
 * 担当ごとの進捗。工程に TODO があれば、その完了率を期間の早い担当から順に
 * 割り当てる（自動）。無ければ担当ごとに手入力した値を使う。
 *
 * value は表示用に丸めた整数、exact は丸める前の値（全体進捗の集計に使う）。
 */
export function assignmentProgress(project, deptId, assignment) {
  const dept = phaseProgress(project, deptId);
  if (!dept.auto) {
    const value = clampProgress(assignment?.progress);
    return { value, exact: value, auto: false, done: 0, total: 0 };
  }
  // 期間が入っていない担当は割り当てようがないので、工程全体の値をそのまま出す
  if (!assignment?.start || !assignment?.end) return { ...dept, exact: dept.value };

  const ratio = allocateDeptProgress(project, deptId, dept.value).get(assignment.id) ?? 0;
  return { ...dept, value: Math.round(ratio * 100), exact: ratio * 100 };
}

/** 日付が入っている担当だけを、工程とセットで返す */
export function scheduledAssignments(project) {
  return departmentsOf(project).flatMap((dept) =>
    assignmentsOf(project, dept.id)
      .filter((a) => a.start && a.end)
      .map((assignment) => ({ dept, assignment }))
  );
}

/** プロジェクト全体の期間（立ち上げ日も含む。日付が1つも無ければ null） */
export function projectRange(project) {
  let start = null;
  let end = null;
  const extend = (d) => {
    if (!d) return;
    if (!start || d < start) start = d;
    if (!end || d > end) end = d;
  };
  for (const { assignment } of scheduledAssignments(project)) {
    extend(parseDate(assignment.start));
    extend(parseDate(assignment.end));
  }
  extend(parseDate(project.launchDate));
  if (!start || !end) return null;
  return { start, end };
}

/** 工程の日数で重み付けした全体進捗（%） */
export function projectProgress(project) {
  const scheduled = scheduledAssignments(project);
  if (scheduled.length === 0) {
    // 工程に日付が無い場合は TODO の完了率をそのまま全体進捗とする
    const { total, done } = todoStats(project);
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }
  let weighted = 0;
  let total = 0;
  for (const { dept, assignment } of scheduled) {
    const days = Math.max(1, spanDays(assignment.start, assignment.end));
    // 丸める前の値で集計する。バーごとに丸めると全体の数字がずれるため
    weighted += assignmentProgress(project, dept.id, assignment).exact * days;
    total += days;
  }
  return total === 0 ? 0 : Math.round(weighted / total);
}

export function todoStats(project) {
  const total = project.todos.length;
  const done = project.todos.filter((t) => t.done).length;
  return { total, done, remaining: total - done };
}
