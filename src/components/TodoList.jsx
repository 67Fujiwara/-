import { useMemo, useState } from 'react';
import { formatJP, todayISO } from '../lib/date.js';
import { findDepartment } from '../lib/departments.js';
import { NOTIFY_CHOICES, notifyDaysLabel } from '../lib/alerts.js';

const ALL = '__all__';
const NONE = '';
const USE_DEFAULT = '';

/** 「何日前に知らせるか」の選択欄。空＝全体設定に従う */
function NotifySelect({ value, defaultDays, onChange, className = '', disabled = false }) {
  return (
    <select
      className={`notifysel ${className}`}
      value={value === null || value === undefined ? USE_DEFAULT : String(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === USE_DEFAULT ? null : Number(e.target.value))}
      title="このTODOを何日前に知らせるか"
    >
      <option value={USE_DEFAULT}>全体設定（{notifyDaysLabel(defaultDays)}）</option>
      {NOTIFY_CHOICES.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

/** プロジェクトごとの TODO リスト。工程タブで切り替えて表示する。 */
export default function TodoList({
  project,
  departments = [],
  onAdd = () => {},
  onToggle = () => {},
  onUpdate = () => {},
  onRemove = () => {},
  defaultNotifyDays = 3,
  readOnly = false,
}) {
  const [activeDept, setActiveDept] = useState(() => departments[0]?.id ?? ALL);
  const [form, setForm] = useState({ text: '', start: '', end: '', notifyDays: null });
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // 工程が入れ替わって選択中のタブが無くなったら先頭に戻す
  const hasNoDeptTodos = project.todos.some((t) => !t.dept);
  const tabs = useMemo(() => {
    const list = departments.map((d) => ({ id: d.id, label: d.label, color: d.color }));
    if (hasNoDeptTodos || activeDept === NONE) {
      list.push({ id: NONE, label: '工程なし', color: '#94a3b8' });
    }
    list.push({ id: ALL, label: 'すべて', color: '#64748b' });
    return list;
  }, [departments, hasNoDeptTodos, activeDept]);

  const current = tabs.some((t) => t.id === activeDept) ? activeDept : (tabs[0]?.id ?? ALL);

  const countOf = (deptId) => {
    const list = deptId === ALL ? project.todos : project.todos.filter((t) => t.dept === deptId);
    return { total: list.length, done: list.filter((t) => t.done).length, list };
  };

  const { list: visible, total, done } = countOf(current);
  const rate = total === 0 ? 0 : Math.round((done / total) * 100);
  const today = todayISO();
  const invalidRange = form.start && form.end && form.end < form.start;

  const submit = (event) => {
    event.preventDefault();
    if (!form.text.trim()) return;
    // 「すべて」タブで追加したときは工程なしとして登録する
    onAdd(project.id, { ...form, dept: current === ALL ? NONE : current });
    // 続けて似たタスクを足せるよう、お知らせの設定だけ残す
    setForm((prev) => ({ text: '', start: '', end: '', notifyDays: prev.notifyDays }));
  };

  const currentTab = tabs.find((t) => t.id === current);

  return (
    <div className="todos">
      <div className="todos__head">
        <h4>TODO リスト</h4>
        <span className="todos__count">
          {done} / {total} 完了（{rate}%）
        </span>
      </div>

      <div className="todotabs" role="tablist">
        {tabs.map((tab) => {
          const c = countOf(tab.id);
          return (
            <button
              type="button"
              key={tab.id || 'none'}
              role="tab"
              aria-selected={tab.id === current}
              className={`todotab ${tab.id === current ? 'is-active' : ''}`}
              style={{ '--dept-color': tab.color }}
              onClick={() => setActiveDept(tab.id)}
            >
              {tab.label}
              <span className="todotab__count">
                {c.done}/{c.total}
              </span>
            </button>
          );
        })}
      </div>

      <div className="todos__bar">
        <span style={{ width: `${rate}%` }} />
      </div>

      {total === 0 && (
        <p className="muted">
          {current === ALL
            ? 'まだ TODO がありません。'
            : `「${currentTab?.label}」の TODO はまだありません。`}
        </p>
      )}

      <ul className="todos__list">
        {visible.map((item) => {
          const overdue = !item.done && item.end && item.end < today;
          const dept = findDepartment(departments, item.dept);
          return (
            <li key={item.id} className={`todo ${item.done ? 'is-done' : ''}`}>
              {/* 1行目は本文だけにする。日付や設定を横に並べると本文が潰れるため */}
              <div className="todo__row">
                <label className="todo__main">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={readOnly}
                    onChange={() => onToggle(project.id, item.id)}
                  />
                  <span className="todo__text">{item.text}</span>
                </label>
                {!readOnly && (
                  <button
                    type="button"
                    className="iconbtn iconbtn--danger"
                    title="削除"
                    onClick={() => onRemove(project.id, item.id)}
                  >
                    ×
                  </button>
                )}
              </div>
              {(item.start || item.end || (dept && current === ALL)) && (
                <div className="todo__meta">
                  {current === ALL && dept && (
                    <span className="todo__dept" style={{ '--dept-color': dept.color }}>
                      {dept.label}
                    </span>
                  )}
                  {(item.start || item.end) && (
                    <span className={`todo__due ${overdue ? 'is-overdue' : ''}`}>
                      {item.start ? formatJP(item.start) : '—'} 〜{' '}
                      {item.end ? formatJP(item.end) : '—'}
                    </span>
                  )}
                  {item.end &&
                    !item.done &&
                    (readOnly ? (
                      <span className="todo__notify">
                        {item.notifyDays === null || item.notifyDays === undefined
                          ? `全体設定（${notifyDaysLabel(defaultNotifyDays)}）`
                          : notifyDaysLabel(item.notifyDays)}
                      </span>
                    ) : (
                      <NotifySelect
                        className="notifysel--sm"
                        value={item.notifyDays}
                        defaultDays={defaultNotifyDays}
                        onChange={(value) => onUpdate(project.id, item.id, { notifyDays: value })}
                      />
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!readOnly && (
        <form className="todos__form" onSubmit={submit}>
          <input
            type="text"
            value={form.text}
            placeholder={
              current === ALL ? 'やることを入力（工程なしで追加）' : `「${currentTab?.label}」のやることを入力`
            }
            onChange={(e) => set({ text: e.target.value })}
          />
          <div className="todos__form-row">
            <input
              type="date"
              value={form.start}
              onChange={(e) => set({ start: e.target.value })}
              title="開始日"
            />
            <span className="todos__tilde">〜</span>
            <input
              type="date"
              value={form.end}
              onChange={(e) => set({ end: e.target.value })}
              title="終了日"
            />
            <button type="submit" className="btn btn--primary">
              追加
            </button>
          </div>
          <div className="todos__form-row todos__form-row--notify">
            <span className="todos__form-label">お知らせ</span>
            <NotifySelect
              value={form.notifyDays}
              defaultDays={defaultNotifyDays}
              onChange={(value) => set({ notifyDays: value })}
            />
            <span className="muted todos__form-hint">
              長い作業は「1週間前」、短い作業は「当日」など。次の追加にも引き継がれます
            </span>
          </div>
          {invalidRange && <p className="warn">終了日が開始日より前です。</p>}
        </form>
      )}
    </div>
  );
}
