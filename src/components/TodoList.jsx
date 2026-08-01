import { useState } from 'react';
import { formatJP, todayISO } from '../lib/date.js';
import { findDepartment } from '../lib/departments.js';

const emptyForm = { text: '', dept: '', start: '', end: '' };

/** プロジェクトごとの TODO リスト（開始日〜終了日つき） */
export default function TodoList({
  project,
  departments = [],
  onAdd = () => {},
  onToggle = () => {},
  onRemove = () => {},
  readOnly = false,
}) {
  const [form, setForm] = useState(emptyForm);
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const submit = (event) => {
    event.preventDefault();
    if (!form.text.trim()) return;
    onAdd(project.id, form);
    // 続けて入力しやすいよう、部署の選択は残す
    setForm({ ...emptyForm, dept: form.dept });
  };

  const done = project.todos.filter((t) => t.done).length;
  const total = project.todos.length;
  const rate = total === 0 ? 0 : Math.round((done / total) * 100);
  const today = todayISO();
  const invalidRange = form.start && form.end && form.end < form.start;

  return (
    <div className="todos">
      <div className="todos__head">
        <h4>TODO リスト</h4>
        <span className="todos__count">
          {done} / {total} 完了（{rate}%）
        </span>
      </div>

      <div className="todos__bar">
        <span style={{ width: `${rate}%` }} />
      </div>

      {total === 0 && <p className="muted">まだ TODO がありません。</p>}

      <ul className="todos__list">
        {project.todos.map((item) => {
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
                {dept && (
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
            placeholder="やることを入力"
            onChange={(e) => set({ text: e.target.value })}
          />
          <div className="todos__form-row">
            <select value={form.dept} onChange={(e) => set({ dept: e.target.value })} title="担当工程">
              <option value="">工程なし</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
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
