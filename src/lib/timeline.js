import { ZOOM_LEVELS } from '../constants.js';
import {
  addDays,
  addMonths,
  diffDays,
  formatMD,
  isWeekend,
  parseDate,
  startOfMonth,
  startOfWeek,
  today,
} from './date.js';
import { projectRange } from './project.js';

const MIN_SPAN_DAYS = 35;

/** 表示対象プロジェクトから、目盛り付きのタイムライン情報を組み立てる */
export function buildTimeline(projects, zoom, departments) {
  const { dayWidth } = ZOOM_LEVELS[zoom] || ZOOM_LEVELS.week;
  const base = today();

  let min = null;
  let max = null;
  for (const project of projects) {
    const range = projectRange(project, departments);
    if (!range) continue;
    if (!min || range.start < min) min = range.start;
    if (!max || range.end > max) max = range.end;
  }
  // 日付が1件も無いときは今日を中心に表示する
  if (!min || !max) {
    min = addDays(base, -7);
    max = addDays(base, 28);
  }
  // 今日が常に見えるように範囲を広げる
  if (base < min) min = base;
  if (base > max) max = base;

  let start = startOfWeek(addDays(min, -7));
  let end = addDays(max, 10);
  if (diffDays(start, end) < MIN_SPAN_DAYS) {
    end = addDays(start, MIN_SPAN_DAYS);
  }

  const totalDays = diffDays(start, end) + 1;
  const width = totalDays * dayWidth;

  const xForDate = (date) => diffDays(start, date) * dayWidth;
  const xForISO = (iso) => {
    const d = parseDate(iso);
    return d ? xForDate(d) : 0;
  };

  return {
    start,
    end,
    totalDays,
    dayWidth,
    width,
    xForDate,
    xForISO,
    /** 期間バーの位置とサイズ（両端の日を含む） */
    barFor(startISO, endISO) {
      const s = parseDate(startISO);
      const e = parseDate(endISO);
      if (!s || !e) return null;
      const left = xForDate(s);
      const barWidth = Math.max(dayWidth * 0.8, (diffDays(s, e) + 1) * dayWidth);
      return { left, width: barWidth };
    },
    todayX: xForDate(base),
    months: buildMonthGroups(start, totalDays, dayWidth, zoom),
    ticks: buildTicks(start, totalDays, dayWidth, zoom, base),
  };
}

/** 目盛りの1段上に出す見出し。月表示のときだけ「年」でまとめる。 */
function buildMonthGroups(start, totalDays, dayWidth, zoom) {
  const groups = [];
  const end = addDays(start, totalDays - 1);
  const step = zoom === 'month' ? 12 : 1;
  let cursor =
    zoom === 'month' ? new Date(start.getFullYear(), 0, 1) : startOfMonth(start);

  while (cursor <= end) {
    const next = addMonths(cursor, step);
    const from = cursor < start ? start : cursor;
    const to = addDays(next, -1) > end ? end : addDays(next, -1);
    groups.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label:
        zoom === 'month'
          ? `${cursor.getFullYear()}年`
          : `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`,
      left: diffDays(start, from) * dayWidth,
      width: (diffDays(from, to) + 1) * dayWidth,
    });
    cursor = next;
  }
  return groups;
}

function buildTicks(start, totalDays, dayWidth, zoom, base) {
  const ticks = [];
  const end = addDays(start, totalDays - 1);

  if (zoom === 'day') {
    for (let i = 0; i < totalDays; i += 1) {
      const date = addDays(start, i);
      ticks.push({
        key: `d${i}`,
        label: String(date.getDate()),
        left: i * dayWidth,
        width: dayWidth,
        weekend: isWeekend(date),
        isToday: diffDays(base, date) === 0,
      });
    }
    return ticks;
  }

  if (zoom === 'week') {
    let cursor = startOfWeek(start);
    while (cursor <= end) {
      const from = cursor < start ? start : cursor;
      const to = addDays(cursor, 6) > end ? end : addDays(cursor, 6);
      const weekEnd = addDays(cursor, 6);
      ticks.push({
        key: `w${cursor.getTime()}`,
        label: formatMD(from),
        left: diffDays(start, from) * dayWidth,
        width: (diffDays(from, to) + 1) * dayWidth,
        weekend: false,
        isToday: base >= cursor && base <= weekEnd,
      });
      cursor = addDays(cursor, 7);
    }
    return ticks;
  }

  let cursor = startOfMonth(start);
  while (cursor <= end) {
    const nextMonth = addMonths(cursor, 1);
    const from = cursor < start ? start : cursor;
    const to = addDays(nextMonth, -1) > end ? end : addDays(nextMonth, -1);
    ticks.push({
      key: `m${cursor.getTime()}`,
      label: `${cursor.getMonth() + 1}月`,
      left: diffDays(start, from) * dayWidth,
      width: (diffDays(from, to) + 1) * dayWidth,
      weekend: false,
      isToday: base >= cursor && base < nextMonth,
    });
    cursor = nextMonth;
  }
  return ticks;
}
