import { useEffect, useRef, useState } from 'react';
import { clampProgress, departmentsOf, phaseOf, phaseProgress, projectProgress } from '../lib/project.js';
import TodoList from './TodoList.jsx';

/** 選択中プロジェクトの詳細（担当・工程・TODO）を編集するサイドパネル */
export default function ProjectDrawer({
  project,
  isNew,
  onClose,
  onUpdate,
  onComplete,
  onDelete,
  onAddTodo,
  onToggleTodo,
  onRemoveTodo,
  onAddDept,
  onUpdateDept,
  onMoveDept,
  onRemoveDept,
}) {
  const nameRef = useRef(null);
  const [newDeptLabel, setNewDeptLabel] = useState('');

  useEffect(() => {
    if (isNew && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [isNew, project?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!project) return null;

  const departments = departmentsOf(project);
  const progress = projectProgress(project);

  const setPhase = (deptId, patch) => {
    onUpdate(project.id, (p) => ({
      phases: { ...p.phases, [deptId]: { ...phaseOf(p, deptId), ...patch } },
    }));
  };

  const submitDept = (event) => {
    event.preventDefault();
    onAddDept(project.id, newDeptLabel.trim() || '新しい工程');
    setNewDeptLabel('');
  };

  return (
    <aside className="drawer" role="dialog" aria-label="プロジェクト詳細">
      <header className="drawer__head">
        <div>
          <span className="drawer__eyebrow">プロジェクト詳細</span>
          <h3>{project.name}</h3>
        </div>
        <button type="button" className="iconbtn iconbtn--lg" onClick={onClose} title="閉じる（Esc）">
          ×
        </button>
      </header>

      <div className="drawer__body">
        <section className="field-group">
          <label className="field">
            <span>プロジェクト名</span>
            <input
              ref={nameRef}
              type="text"
              value={project.name}
              onChange={(e) => onUpdate(project.id, { name: e.target.value })}
            />
          </label>
          <label className="field">
            <span>客先 / 部門</span>
            <input
              type="text"
              value={project.client}
              placeholder="例）株式会社◯◯"
              onChange={(e) => onUpdate(project.id, { client: e.target.value })}
            />
          </label>
          <label className="field">
            <span>立ち上げ日</span>
            <input
              type="date"
              value={project.launchDate}
              onChange={(e) => onUpdate(project.id, { launchDate: e.target.value })}
            />
          </label>
          <label className="field">
            <span>メモ</span>
            <textarea
              rows={2}
              value={project.note}
              placeholder="優先理由・注意点など"
              onChange={(e) => onUpdate(project.id, { note: e.target.value })}
            />
          </label>
        </section>

        <section>
          <div className="section-head">
            <h4>担当と工程</h4>
            <span className="badge">全体進捗 {progress}%</span>
          </div>
          <p className="section-note">
            工程はこのプロジェクトだけのものです。追加・削除しても他のプロジェクトには影響しません。
          </p>

          {departments.map((dept, index) => {
            const phase = phaseOf(project, dept.id);
            const prog = phaseProgress(project, dept.id);
            const invalid = phase.start && phase.end && phase.end < phase.start;
            return (
              <div className="phase" key={dept.id} style={{ '--dept-color': dept.color }}>
                <div className="phase__head">
                  <input
                    type="color"
                    className="phase__color"
                    value={dept.color}
                    title="色を変更"
                    onChange={(e) => onUpdateDept(project.id, dept.id, { color: e.target.value })}
                  />
                  <input
                    type="text"
                    className="phase__name"
                    value={dept.label}
                    title="工程名"
                    onChange={(e) => onUpdateDept(project.id, dept.id, { label: e.target.value })}
                  />
                  <span className="phase__tools">
                    <button
                      type="button"
                      className="iconbtn"
                      title="1つ上へ"
                      disabled={index === 0}
                      onClick={() => onMoveDept(project.id, dept.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="iconbtn"
                      title="1つ下へ"
                      disabled={index === departments.length - 1}
                      onClick={() => onMoveDept(project.id, dept.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="iconbtn iconbtn--danger"
                      title="この工程を削除"
                      onClick={() => {
                        if (
                          window.confirm(
                            `「${project.name}」から工程「${dept.label}」を削除します。\n担当者・期間も削除され、この工程の TODO は「工程なし」になります。\n（他のプロジェクトには影響しません）`
                          )
                        ) {
                          onRemoveDept(project.id, dept.id);
                        }
                      }}
                    >
                      ×
                    </button>
                  </span>
                </div>

                <div className="phase__owner-row">
                  <span className="phase__sublabel">担当</span>
                  <input
                    type="text"
                    className="phase__owner"
                    value={phase.owner}
                    placeholder="担当者名"
                    onChange={(e) => setPhase(dept.id, { owner: e.target.value })}
                  />
                </div>

                <div className="phase__dates">
                  <input
                    type="date"
                    value={phase.start}
                    onChange={(e) => setPhase(dept.id, { start: e.target.value })}
                  />
                  <span className="phase__tilde">〜</span>
                  <input
                    type="date"
                    value={phase.end}
                    onChange={(e) => setPhase(dept.id, { end: e.target.value })}
                  />
                </div>
                {invalid && <p className="warn">終了日が開始日より前です。日付を確認してください。</p>}

                <div className="phase__progress">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={prog.value}
                    disabled={prog.auto}
                    onChange={(e) => setPhase(dept.id, { progress: clampProgress(e.target.value) })}
                  />
                  <span className="phase__pct">{prog.value}%</span>
                </div>
                <p className="phase__hint">
                  {prog.auto
                    ? `この工程の TODO ${prog.done}/${prog.total} から自動計算しています`
                    : 'この工程の TODO を追加すると、進捗は自動計算になります'}
                </p>
              </div>
            );
          })}

          {departments.length === 0 && (
            <p className="muted">工程がありません。下の入力欄から追加してください。</p>
          )}

          <form className="phaseadd" onSubmit={submitDept}>
            <input
              type="text"
              value={newDeptLabel}
              placeholder="工程名（例：修正対応、据付、試運転）"
              onChange={(e) => setNewDeptLabel(e.target.value)}
            />
            <button type="submit" className="btn btn--primary">
              ＋ 工程を追加
            </button>
          </form>
        </section>

        <section>
          <TodoList
            project={project}
            departments={departments}
            onAdd={onAddTodo}
            onToggle={onToggleTodo}
            onRemove={onRemoveTodo}
          />
        </section>
      </div>

      <footer className="drawer__foot">
        <button type="button" className="btn btn--primary" onClick={() => onComplete(project.id)}>
          ✓ 完了にする
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            if (window.confirm(`「${project.name}」を削除します。よろしいですか？`)) {
              onDelete(project.id);
            }
          }}
        >
          削除
        </button>
      </footer>
    </aside>
  );
}
