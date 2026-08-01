import { useEffect, useRef } from 'react';
import { DEPARTMENTS } from '../constants.js';
import { clampProgress, projectProgress } from '../lib/project.js';
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
}) {
  const nameRef = useRef(null);

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

  const setPhase = (deptKey, patch) => {
    onUpdate(project.id, (p) => ({
      phases: { ...p.phases, [deptKey]: { ...p.phases[deptKey], ...patch } },
    }));
  };

  const progress = projectProgress(project);

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

          {DEPARTMENTS.map((dept) => {
            const phase = project.phases[dept.key];
            const invalid = phase.start && phase.end && phase.end < phase.start;
            return (
              <div
                className="phase"
                key={dept.key}
                style={{ '--dept-color': dept.color, '--dept-soft': dept.soft }}
              >
                <div className="phase__head">
                  <span className="phase__label">{dept.label}</span>
                  <input
                    type="text"
                    className="phase__owner"
                    value={phase.owner}
                    placeholder="担当者名"
                    onChange={(e) => setPhase(dept.key, { owner: e.target.value })}
                  />
                </div>
                <div className="phase__dates">
                  <input
                    type="date"
                    value={phase.start}
                    onChange={(e) => setPhase(dept.key, { start: e.target.value })}
                  />
                  <span className="phase__tilde">〜</span>
                  <input
                    type="date"
                    value={phase.end}
                    onChange={(e) => setPhase(dept.key, { end: e.target.value })}
                  />
                </div>
                {invalid && <p className="warn">終了日が開始日より前です。日付を確認してください。</p>}
                <div className="phase__progress">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={phase.progress}
                    onChange={(e) => setPhase(dept.key, { progress: clampProgress(e.target.value) })}
                  />
                  <span className="phase__pct">{phase.progress}%</span>
                </div>
              </div>
            );
          })}
        </section>

        <section>
          <TodoList
            project={project}
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
