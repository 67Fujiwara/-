import { useEffect, useRef, useState } from 'react';
import {
  assignmentProgress,
  assignmentsOf,
  clampProgress,
  departmentsOf,
  isSafeUrl,
  packAssignments,
  resolveFolderTarget,
  toOpenFolderUrl,
  phaseProgress,
  projectProgress,
} from '../lib/project.js';
import TodoList from './TodoList.jsx';
import SlackLink from './SlackLink.jsx';
import FolderLink from './FolderLink.jsx';

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
  onAddAssignment,
  onUpdateAssignment,
  onRemoveAssignment,
}) {
  const nameRef = useRef(null);
  const [newDeptLabel, setNewDeptLabel] = useState('');
  const [notice, setNotice] = useState('');

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

  const submitDept = (event) => {
    event.preventDefault();
    const name = newDeptLabel.trim() || '新しい工程';
    // 同じ名前の工程が既にあるときは、列を増やさずその工程に担当を足す
    const existing = departments.find((d) => d.label.trim() === name);
    onAddDept(project.id, name);
    setNewDeptLabel('');
    setNotice(
      existing
        ? `「${existing.label}」は既にあるので、同じ列に担当を追加しました`
        : `工程「${name}」を追加しました`
    );
    window.setTimeout(() => setNotice(''), 5000);
  };

  return (
    <aside className="drawer" role="dialog" aria-label="プロジェクト詳細">
      <header className="drawer__head">
        <div>
          <span className="drawer__eyebrow">プロジェクト詳細</span>
          <h3 className="drawer__name">
            {project.name}
            <SlackLink url={project.slackUrl} />
            <FolderLink url={project.folderUrl} />
          </h3>
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
            <span>
              Slack スレッド
              <span className="field__hint">URLを貼り付け（表示はアイコンのみ）</span>
            </span>
            <input
              type="url"
              inputMode="url"
              className="field__url"
              value={project.slackUrl}
              placeholder="https://xxx.slack.com/archives/..."
              onChange={(e) => onUpdate(project.id, { slackUrl: e.target.value })}
            />
            {project.slackUrl && !isSafeUrl(project.slackUrl) && (
              <p className="warn">http:// または https:// で始まるURLを貼り付けてください。</p>
            )}
          </label>
          <label className="field">
            <span>
              プロジェクトのフォルダ
              <span className="field__hint">URL または dcboxdrive:// ならクリックで開けます</span>
            </span>
            <input
              type="text"
              className="field__url"
              value={project.folderUrl}
              placeholder="dcboxdrive://... / https://... / D:\共有\..."
              onChange={(e) => onUpdate(project.id, { folderUrl: e.target.value })}
            />
            {project.folderUrl && !resolveFolderTarget(project.folderUrl) && (
              <p className="warn">
                URL（https://…）か、Windows のフォルダパス（D:\… または \\サーバー名\…）を入れてください。
              </p>
            )}
            {resolveFolderTarget(project.folderUrl)?.kind === 'path' && (
              <div className="field__note">
                <p>
                  フォルダのパスです。ブラウザからエクスプローラーは開けないため、
                  アイコンをクリックすると<b>パスをコピー</b>します
                  （エクスプローラーのアドレス欄に貼り付け）。
                </p>
                {toOpenFolderUrl(project.folderUrl) && (
                  <p className="field__note-action">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() =>
                        onUpdate(project.id, { folderUrl: toOpenFolderUrl(project.folderUrl) })
                      }
                    >
                      1クリックで開ける形式に変換
                    </button>
                    <span>
                      1クリックで開けるようになります（各PCで
                      <code>tools/openfolder-protocol.reg</code> の登録が必要）
                    </span>
                  </p>
                )}
              </div>
            )}
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
            工程はこのプロジェクトだけのものです。1つの工程に担当を複数入れると、
            期間が重ならない限りガントの同じ列に並びます。
          </p>

          {departments.map((dept, index) => {
            const assignments = assignmentsOf(project, dept.id);
            const deptProg = phaseProgress(project, dept.id);
            const laneCount = Math.max(1, packAssignments(assignments).length);
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
                            `「${project.name}」から工程「${dept.label}」を削除します。\n担当者・期間もすべて削除され、この工程の TODO は「工程なし」になります。\n（他のプロジェクトには影響しません）`
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

                {assignments.map((assignment, ai) => {
                  const prog = assignmentProgress(project, dept.id, assignment);
                  const invalid =
                    assignment.start && assignment.end && assignment.end < assignment.start;
                  const set = (patch) =>
                    onUpdateAssignment(project.id, dept.id, assignment.id, patch);
                  return (
                    <div className="assign" key={assignment.id}>
                      <div className="assign__row">
                        <span className="phase__sublabel">
                          {assignments.length > 1 ? `担当${ai + 1}` : '担当'}
                        </span>
                        <input
                          type="text"
                          className="phase__owner"
                          value={assignment.owner}
                          placeholder="担当者名"
                          onChange={(e) => set({ owner: e.target.value })}
                        />
                        <button
                          type="button"
                          className="iconbtn iconbtn--danger"
                          title="この担当を削除"
                          disabled={assignments.length <= 1}
                          onClick={() => onRemoveAssignment(project.id, dept.id, assignment.id)}
                        >
                          ×
                        </button>
                      </div>

                      <div className="phase__dates">
                        <input
                          type="date"
                          value={assignment.start}
                          onChange={(e) => set({ start: e.target.value })}
                        />
                        <span className="phase__tilde">〜</span>
                        <input
                          type="date"
                          value={assignment.end}
                          onChange={(e) => set({ end: e.target.value })}
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
                          onChange={(e) => set({ progress: clampProgress(e.target.value) })}
                        />
                        <span className="phase__pct">{prog.value}%</span>
                      </div>
                    </div>
                  );
                })}

                <div className="phase__foot">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => onAddAssignment(project.id, dept.id)}
                  >
                    ＋ 担当を追加
                  </button>
                  <span className="phase__hint">
                    {[
                      deptProg.auto ? `TODO ${deptProg.done}/${deptProg.total} から自動計算` : null,
                      laneCount > 1
                        ? `期間が重なるため ${laneCount} 段で表示`
                        : assignments.length > 1
                          ? '同じ列に並んでいます'
                          : null,
                    ]
                      .filter(Boolean)
                      .join('・')}
                  </span>
                </div>
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
              list="dept-name-suggestions"
              onChange={(e) => setNewDeptLabel(e.target.value)}
            />
            <datalist id="dept-name-suggestions">
              {departments.map((d) => (
                <option key={d.id} value={d.label} />
              ))}
            </datalist>
            <button type="submit" className="btn btn--primary">
              ＋ 工程を追加
            </button>
          </form>
          {notice && <p className="phaseadd__notice">{notice}</p>}
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
