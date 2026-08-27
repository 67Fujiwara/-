import { useCallback, useEffect, useState } from 'react';
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
function Groups({ rows, onSelectProject, onToggle, isDone, renderRight }) {
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
        {group.items.map((row) => {
          const done = isDone(row);
          return (
            <li className={`duelist__item ${done ? 'is-done' : ''}`} key={row.key}>
              <input
                type="checkbox"
                className="duelist__check"
                checked={done}
                title="完了にする"
                onChange={() => onToggle(row)}
              />
              <DeptTag dept={row.dept} />
              <span className="duelist__text">{row.text || '（内容なし）'}</span>
              {renderRight(row)}
            </li>
          );
        })}
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
  onToggleTodo,
  onClose,
}) {
  // このポップアップで完了にした行。閉じるまでは一覧に残して、
  // 押し間違えてもその場で戻せるようにする
  const [completed, setCompleted] = useState([]);

  const isDone = useCallback(
    (row) => completed.some((c) => c.row.key === row.key),
    [completed]
  );

  const toggle = useCallback(
    (section, row) => {
      onToggleTodo(row.projectId, row.todo.id);
      setCompleted((prev) =>
        prev.some((c) => c.row.key === row.key)
          ? prev.filter((c) => c.row.key !== row.key)
          : [...prev, { section, row }]
      );
    },
    [onToggleTodo]
  );

  /** 完了にして一覧から外れた行を、元の並び順のまま戻す */
  const withCompleted = (rows, section, order) => {
    const extra = completed
      .filter((c) => c.section === section && !rows.some((r) => r.key === c.row.key))
      .map((c) => c.row);
    if (extra.length === 0) return rows;
    return [...rows, ...extra].sort(
      (a, b) => order(a) - order(b) || a.projectName.localeCompare(b.projectName, 'ja')
    );
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const overdue = dueRows.filter((r) => r.left < 0).length;
  const total = dueRows.length + startRows.length;
  const shownStart = withCompleted(startRows, 'start', (r) => -r.passed);
  const shownDue = withCompleted(dueRows, 'due', (r) => r.left);
  const nothingShown = shownStart.length + shownDue.length === 0;

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
          {nothingShown && <p className="muted">対象の TODO はありません。</p>}

          {notifyStart && shownStart.length > 0 && (
            <>
              <h4 className="duesection">今日から始める TODO（{startRows.length}）</h4>
              <Groups
                rows={shownStart}
                onSelectProject={onSelectProject}
                onToggle={(row) => toggle('start', row)}
                isDone={isDone}
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

          {shownDue.length > 0 && (
            <>
              <h4 className="duesection">期限が近い TODO（{dueRows.length}）</h4>
              <Groups
                rows={shownDue}
                onSelectProject={onSelectProject}
                onToggle={(row) => toggle('due', row)}
                isDone={isDone}
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
