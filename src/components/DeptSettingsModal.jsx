import { useEffect, useState } from 'react';

/** 工程の一覧（追加・改名・色変更・並べ替え・削除） */
function DeptRows({ list, onUpdate, onMove, onRemove, canDeleteLast, confirmText }) {
  return (
    <ul className="deptlist">
      {list.map((dept, index) => (
        <li className="deptlist__item" key={dept.id} style={{ '--dept-color': dept.color }}>
          <input
            type="color"
            className="deptlist__color"
            value={dept.color}
            title="色を変更"
            onChange={(e) => onUpdate(dept.id, { color: e.target.value })}
          />
          <input
            type="text"
            className="deptlist__label"
            value={dept.label}
            onChange={(e) => onUpdate(dept.id, { label: e.target.value })}
          />
          <span className="deptlist__actions">
            <button
              type="button"
              className="iconbtn"
              title="1つ上へ"
              disabled={index === 0}
              onClick={() => onMove(dept.id, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="iconbtn"
              title="1つ下へ"
              disabled={index === list.length - 1}
              onClick={() => onMove(dept.id, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="iconbtn iconbtn--danger"
              title="削除"
              disabled={!canDeleteLast && list.length <= 1}
              onClick={() => {
                if (window.confirm(confirmText(dept))) onRemove(dept.id);
              }}
            >
              ×
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function AddForm({ placeholder, onSubmit }) {
  const [label, setLabel] = useState('');
  return (
    <form
      className="deptadd"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(label.trim() || '新しい工程');
        setLabel('');
      }}
    >
      <input type="text" value={label} placeholder={placeholder} onChange={(e) => setLabel(e.target.value)} />
      <button type="submit" className="btn btn--primary">
        ＋ 追加
      </button>
    </form>
  );
}

/** 工程（担当区分）の設定。共通の工程と、プロジェクト専用の工程を分けて編集する。 */
export default function DeptSettingsModal({
  departments,
  project,
  onAdd,
  onUpdate,
  onMove,
  onRemove,
  onAddProjectDept,
  onUpdateProjectDept,
  onMoveProjectDept,
  onRemoveProjectDept,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const customDepartments = project?.customDepartments || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="工程の設定" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <div>
            <h3>工程の設定</h3>
            <p className="muted">日付を入れたプロジェクトだけ、その工程のバーが描かれます。</p>
          </div>
          <button type="button" className="iconbtn iconbtn--lg" onClick={onClose} title="閉じる（Esc）">
            ×
          </button>
        </header>

        <div className="modal__body">
          <section className="deptsection">
            <h4>すべてのプロジェクト共通の工程</h4>
            <DeptRows
              list={departments}
              onUpdate={onUpdate}
              onMove={onMove}
              onRemove={onRemove}
              canDeleteLast={false}
              confirmText={(dept) =>
                `共通の工程「${dept.label}」を削除します。\nすべてのプロジェクトのこの工程の担当者・期間も削除され、この工程が付いた TODO は「工程なし」になります。よろしいですか？`
              }
            />
            <AddForm placeholder="追加する工程名（例：据付、試運転）" onSubmit={onAdd} />
          </section>

          {project ? (
            <section className="deptsection">
              <h4>
                このプロジェクトだけの工程
                <span className="deptsection__target">{project.name}</span>
              </h4>
              {customDepartments.length === 0 && (
                <p className="muted">
                  まだありません。このプロジェクトにだけ必要な工程（例：修正対応、追加改造）をここで追加できます。
                </p>
              )}
              <DeptRows
                list={customDepartments}
                onUpdate={(id, patch) => onUpdateProjectDept(project.id, id, patch)}
                onMove={(id, delta) => onMoveProjectDept(project.id, id, delta)}
                onRemove={(id) => onRemoveProjectDept(project.id, id)}
                canDeleteLast
                confirmText={(dept) =>
                  `工程「${dept.label}」を削除します。\nこのプロジェクトのこの工程の担当者・期間も削除され、この工程が付いた TODO は「工程なし」になります。よろしいですか？`
                }
              />
              <AddForm
                placeholder="このプロジェクトだけの工程名（例：修正対応）"
                onSubmit={(label) => onAddProjectDept(project.id, label)}
              />
            </section>
          ) : (
            <p className="muted deptsection__hint">
              プロジェクト専用の工程を追加するには、対象プロジェクトを開いてから「工程を編集」を押してください。
            </p>
          )}
        </div>

        <footer className="modal__foot">
          <button type="button" className="btn" onClick={onClose}>
            閉じる
          </button>
        </footer>
      </div>
    </div>
  );
}
