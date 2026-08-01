import { useEffect, useState } from 'react';

/** 工程（担当区分）の追加・改名・色変更・並べ替え・削除 */
export default function DeptSettingsModal({
  departments,
  onAdd,
  onUpdate,
  onMove,
  onRemove,
  onClose,
}) {
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    onAdd(newLabel.trim() || '新しい工程');
    setNewLabel('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label="工程の設定"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__head">
          <div>
            <h3>工程の設定</h3>
            <p className="muted">
              ここで追加した工程は、すべてのプロジェクトの行に表示されます。日付を入れたプロジェクトだけバーが描かれます。
            </p>
          </div>
          <button type="button" className="iconbtn iconbtn--lg" onClick={onClose} title="閉じる（Esc）">
            ×
          </button>
        </header>

        <div className="modal__body">
          <ul className="deptlist">
            {departments.map((dept, index) => (
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
                    disabled={index === departments.length - 1}
                    onClick={() => onMove(dept.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="iconbtn iconbtn--danger"
                    title="削除"
                    disabled={departments.length <= 1}
                    onClick={() => {
                      if (
                        window.confirm(
                          `工程「${dept.label}」を削除します。\n各プロジェクトのこの工程の担当者・期間も削除され、この工程が付いた TODO は「工程なし」になります。よろしいですか？`
                        )
                      ) {
                        onRemove(dept.id);
                      }
                    }}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <form className="deptadd" onSubmit={submit}>
            <input
              type="text"
              value={newLabel}
              placeholder="追加する工程名（例：修正対応、据付、試運転）"
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <button type="submit" className="btn btn--primary">
              ＋ 追加
            </button>
          </form>
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
