import { useEffect } from 'react';
import { formatJP } from '../lib/date.js';
import {
  MAX_DAYS,
  groupByProject,
  leftLabel,
  notifyDaysLabel,
  startLabel,
} from '../lib/alerts.js';

function DeptTag({ dept }) {
  if (!dept) return <span className="duelist__dept duelist__dept--none">工程なし</span>;
  return (
    <span className="duelist__dept" style={{ '--chip-color': dept.color }}>
      {dept.label}
    </span>
  );
}

/** プロジェクトごとにまとめた一覧。renderRight で右端の表示を差し替える */
function Groups({ rows, onSelectProject, renderRight }) {
  return groupByProject(rows).map((group) => (
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
            <DeptTag dept={row.dept} />
            <span className="duelist__text">{row.text || '（内容なし）'}</span>
            {renderRight(row)}
          </li>
        ))}
      </ul>
    </section>
  ));
}

/**
 * TODO のお知らせ。
 * 「今日から始める TODO」と「期限が近い TODO」を、起動時に1日1回だけまとめて出す。
 * ツールバーのボタンからはいつでも開き直せる。
 */
export default function DueAlert({
  dueRows,
  startRows,
  days,
  enabled,
  notifyStart,
  onChangeDays,
  onChangeEnabled,
  onChangeNotifyStart,
  onSelectProject,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const overdue = dueRows.filter((r) => r.left < 0).length;
  const total = dueRows.length + startRows.length;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="duealert-title">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel">
        <header className="modal__head">
          <div>
            <p className="modal__eyebrow">TODO のお知らせ</p>
            <h3 id="duealert-title">
              {total > 0 ? `${total} 件のお知らせ` : 'お知らせはありません'}
              {overdue > 0 && <span className="modal__badge">期限切れ {overdue}</span>}
            </h3>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </header>

        <div className="modal__controls">
          <label className="modal__control">
            <span>期限の何日前に知らせる（全体）</span>
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
          <label className="modal__control modal__control--check">
            <input
              type="checkbox"
              checked={notifyStart}
              onChange={(e) => onChangeNotifyStart(e.target.checked)}
            />
            <span>開始日も知らせる</span>
          </label>
        </div>
        <p className="modal__note">
          全体の設定は、TODO ごとの設定が無いものに使われます。
          TODO ごとの変更は詳細パネルの TODO リストから行えます。
        </p>

        <div className="modal__body">
          {total === 0 && <p className="muted">対象の TODO はありません。</p>}

          {notifyStart && startRows.length > 0 && (
            <>
              <h4 className="duesection">今日から始める TODO（{startRows.length}）</h4>
              <Groups
                rows={startRows}
                onSelectProject={onSelectProject}
                renderRight={(row) => (
                  <>
                    <span className="duelist__date">
                      {formatJP(row.start)}
                      {row.end && ` 〜 ${formatJP(row.end)}`}
                    </span>
                    <span className={`duelist__left ${row.passed > 0 ? 'is-today' : ''}`}>
                      {startLabel(row.passed)}
                    </span>
                  </>
                )}
              />
            </>
          )}

          {dueRows.length > 0 && (
            <>
              <h4 className="duesection">期限が近い TODO（{dueRows.length}）</h4>
              <Groups
                rows={dueRows}
                onSelectProject={onSelectProject}
                renderRight={(row) => (
                  <>
                    <span className="duelist__date" title={`${notifyDaysLabel(row.notifyDays)}に知らせる設定`}>
                      {formatJP(row.end)}
                    </span>
                    <span
                      className={`duelist__left ${
                        row.left < 0 ? 'is-over' : row.left === 0 ? 'is-today' : ''
                      }`}
                    >
                      {leftLabel(row.left)}
                    </span>
                  </>
                )}
              />
            </>
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
