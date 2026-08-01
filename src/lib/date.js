const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' をローカルタイムの Date に変換する（タイムゾーンずれを避けるため自前でパースする） */
export function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function todayISO() {
  return toISO(today());
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** a から b までの日数。夏時間などで時差が出ても丸めて日数にする。 */
export function diffDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** 週の開始（月曜） */
export function startOfWeek(date) {
  const day = date.getDay(); // 0=日
  const back = (day + 6) % 7;
  return addDays(date, -back);
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export function formatMD(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatYM(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function formatJP(iso) {
  const d = parseDate(iso);
  if (!d) return '未設定';
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** 期間（両端を含む）の日数 */
export function spanDays(startISO, endISO) {
  const s = parseDate(startISO);
  const e = parseDate(endISO);
  if (!s || !e) return 0;
  return diffDays(s, e) + 1;
}
