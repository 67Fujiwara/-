import { useEffect, useRef } from 'react';
import {
  clampProgress,
  departmentsFor,
  phaseOf,
  phaseProgress,
  projectProgress,
} from '../lib/project.js';
import TodoList from './TodoList.jsx';

/** 選択中プロジェクトの詳細（担当・工程・TODO）を編集するサイドパネル */
export default function ProjectDrawer({
  project,
  departments,
  isNew,
  onClose,
  onUpdate,
  onComplete,
  onDelete,
  onAddTodo,
  onToggleTodo,
  onRemoveTodo,
  onOpenDeptSettings,
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

  const setPhase = (deptId, patch) => {
    onUpdate(project.id, (p) => ({
      phases: { ...p.phases, [deptId]: { ...phaseOf(p, deptId), ...patch } },
    }));
  };

  const progress = projectProgress(project, departments);
  const allDepts = departmentsFor(project, departments);
  const customIds = new Set((project.customDepartments || []).map((d) => d.id));

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
            <div className="section-head__right">
              <span className="badge">全体進捗 {progress}%</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenDeptSettings}>
                工程を編集
              </button>
            </div>
          </div>

          {allDepts.map((dept) => {
            const phase = phaseOf(project, dept.id);
            const prog = phaseProgress(project, dept.id);
            const invalid = phase.start && phase.end && phase.end < phase.start;
            return (
              <div className="phase" key={dept.id} style={{ '--dept-color': dept.color }}>
                <div className="phase__head">
                  <span className="phase__label">
                    {dept.label}
                    {customIds.has(dept.id) && (
                      <span className="phase__own" title="このプロジェクトだけの工程">
                        専用
                      </span>
                    )}
                  </span>
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
        </section>

        <section>
          <TodoList
            project={project}
            departments={allDepts}
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
