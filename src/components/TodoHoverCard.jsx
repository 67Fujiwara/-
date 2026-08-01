import { formatJP, todayISO } from '../lib/date.js';
import { findDepartment } from '../lib/departments.js';
import { todoStats } from '../lib/project.js';

const CARD_WIDTH = 320;

/**
 * ガントの行にマウスを乗せたときに出す TODO 一覧。
 * 画面からはみ出さないよう、マウス位置を基準に上下左右を切り替える。
 */
export default function TodoHoverCard({ project, departments, x, y }) {
  const { total, done } = todoStats(project);
  if (total === 0) return null;

  // 未完了を先に、その中は終了日が早い順に並べる
  const sorted = project.todos.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.end || '9999-99-99').localeCompare(b.end || '9999-99-99');
  });

  const today = todayISO();
  const maxHeight = Math.min(360, window.innerHeight - 24);
  const left = Math.max(12, Math.min(x + 18, window.innerWidth - CARD_WIDTH - 12));
  const top = Math.max(12, Math.min(y + 18, window.innerHeight - maxHeight - 12));

  return (
    <div className="hovercard" style={{ left, top, width: CARD_WIDTH, maxHeight }}>
      <div className="hovercard__head">
        <span className="hovercard__title">{project.name}</span>
        <span className="hovercard__count">
          TODO {done}/{total}
        </span>
      </div>
      <ul className="hovercard__list">
        {sorted.map((item) => {
          const dept = findDepartment(departments, item.dept);
          const overdue = !item.done && item.end && item.end < today;
          return (
            <li key={item.id} className={`hovercard__item ${item.done ? 'is-done' : ''}`}>
              <span className="hovercard__mark">{item.done ? '✓' : '□'}</span>
              <span className="hovercard__body">
                <span className="hovercard__text">{item.text}</span>
                <span className="hovercard__meta">
                  {dept && (
                    <span className="hovercard__dept" style={{ '--dept-color': dept.color }}>
                      {dept.label}
                    </span>
                  )}
                  {(item.start || item.end) && (
                    <span className={`hovercard__date ${overdue ? 'is-overdue' : ''}`}>
                      {item.start ? formatJP(item.start) : '—'} 〜 {item.end ? formatJP(item.end) : '—'}
                      {overdue ? '（期限超過）' : ''}
                    </span>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
