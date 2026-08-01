import { useState } from 'react';
import { DEPARTMENTS, DEPT_MAP } from '../constants.js';
import { formatJP, todayISO } from '../lib/date.js';

/** プロジェクトごとの TODO リスト */
export default function TodoList({
  project,
  onAdd = () => {},
  onToggle = () => {},
  onRemove = () => {},
  readOnly = false,
}) {
  const [text, setText] = useState('');
  const [dept, setDept] = useState('');
  const [due, setDue] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    onAdd(project.id, text, dept, due);
    setText('');
    setDue('');
  };

  const done = project.todos.filter((t) => t.done).length;
  const total = project.todos.length;
  const rate = total === 0 ? 0 : Math.round((done / total) * 100);
  const today = todayISO();

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
          const overdue = !item.done && item.due && item.due < today;
          const deptInfo = DEPT_MAP[item.dept];
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
                {deptInfo && (
                  <span
                    className="todo__dept"
                    style={{ '--dept-color': deptInfo.color, '--dept-soft': deptInfo.soft }}
                  >
                    {deptInfo.label}
                  </span>
                )}
                {item.due && (
                  <span className={`todo__due ${overdue ? 'is-overdue' : ''}`}>
                    〆 {formatJP(item.due)}
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
            value={text}
            placeholder="やることを入力"
            onChange={(e) => setText(e.target.value)}
          />
          <div className="todos__form-row">
            <select value={dept} onChange={(e) => setDept(e.target.value)} title="担当部署">
              <option value="">部署なし</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} title="期限" />
            <button type="submit" className="btn btn--primary">
              追加
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
