import { useMemo, useState } from 'react';
import { formatJP, todayISO } from '../lib/date.js';
import { findDepartment } from '../lib/departments.js';

const ALL = '__all__';
const NONE = '';

/** プロジェクトごとの TODO リスト。工程タブで切り替えて表示する。 */
export default function TodoList({
  project,
  departments = [],
  onAdd = () => {},
  onToggle = () => {},
  onRemove = () => {},
  readOnly = false,
}) {
  const [activeDept, setActiveDept] = useState(() => departments[0]?.id ?? ALL);
  const [form, setForm] = useState({ text: '', start: '', end: '' });
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
    setForm({ text: '', start: '', end: '' });
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
              <label className="todo__main">
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={readOnly}
                  onChange={() => onToggle(project.id, item.id)}
                />
                <span className="todo__text">{item.text}</span>
              </label>
              <span className="todo__tags">
                {current === ALL && dept && (
                  <span className="todo__dept" style={{ '--dept-color': dept.color }}>
                    {dept.label}
                  </span>
                )}
                {(item.start || item.end) && (
                  <span className={`todo__due ${overdue ? 'is-overdue' : ''}`}>
                    {item.start ? formatJP(item.start) : '—'} 〜 {item.end ? formatJP(item.end) : '—'}
                  </span>
                )}
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
              </span>
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
          {invalidRange && <p className="warn">終了日が開始日より前です。</p>}
        </form>
      )}
    </div>
  );
}
