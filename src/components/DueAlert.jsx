import { useEffect } from 'react';
import { formatJP } from '../lib/date.js';
import { MAX_DAYS, groupByProject, leftLabel } from '../lib/alerts.js';

/**
 * 期限が近い TODO のお知らせ。
 * 起動時に1日1回だけ自動で出し、ツールバーのボタンからいつでも開き直せる。
 */
export default function DueAlert({ rows, days, enabled, onChangeDays, onChangeEnabled, onSelectProject, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const groups = groupByProject(rows);
  const overdue = rows.filter((r) => r.left < 0).length;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="duealert-title">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel">
        <header className="modal__head">
          <div>
            <p className="modal__eyebrow">TODO のお知らせ</p>
            <h3 id="duealert-title">
              期限が近い TODO {rows.length} 件
              {overdue > 0 && <span className="modal__badge">期限切れ {overdue}</span>}
            </h3>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </header>

        <div className="modal__controls">
          <label className="modal__control">
            <span>何日前から知らせる</span>
            <input
              type="number"
              min="0"
              max={MAX_DAYS}
              value={days}
              onChange={(e) => onChangeDays(e.target.value)}
            />
            <span>日前</span>
          </label>
          <label className="modal__control modal__control--check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onChangeEnabled(e.target.checked)}
            />
            <span>起動時に知らせる（1日1回）</span>
          </label>
        </div>

        <div className="modal__body">
          {rows.length === 0 ? (
            <p className="muted">対象の TODO はありません。</p>
          ) : (
            groups.map((group) => (
              <section className="duegroup" key={group.id}>
                <button
                  type="button"
                  className="duegroup__head"
                  onClick={() => onSelectProject(group.id)}
                  title="このプロジェクトを開きます"
                >
                  <span className="duegroup__name">{group.name}</span>
                  {group.client && <span className="duegroup__client">{group.client}</span>}
                </button>
                <ul className="duelist">
                  {group.items.map((row) => (
                    <li className="duelist__item" key={row.key}>
                      {row.dept ? (
                        <span
                          className="duelist__dept"
                          style={{ '--chip-color': row.dept.color }}
                        >
                          {row.dept.label}
                        </span>
                      ) : (
                        <span className="duelist__dept duelist__dept--none">工程なし</span>
                      )}
                      <span className="duelist__text">{row.text || '（内容なし）'}</span>
                      <span className="duelist__date">{formatJP(row.end)}</span>
                      <span className={`duelist__left ${row.left < 0 ? 'is-over' : row.left === 0 ? 'is-today' : ''}`}>
                        {leftLabel(row.left)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <footer className="modal__foot">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            閉じる
          </button>
        </footer>
      </div>
    </div>
  );
}
