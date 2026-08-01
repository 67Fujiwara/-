import { useEffect, useRef, useState } from 'react';

/**
 * 「工程で強調」の選択メニュー。
 * 工程が増えてもツールバーが横に伸びないよう、ボタン1つ + ドロップダウンにしている。
 * 複数の工程を同時に強調できる。
 */
export default function DeptFilterMenu({ departments, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const first = departments.find((d) => d.label === selected[0]);
  const summary =
    selected.length === 0 ? 'すべて' : selected.length === 1 ? selected[0] : `${selected[0]} 他${selected.length - 1}`;

  return (
    <div className="filtermenu" ref={rootRef}>
      <button
        type="button"
        className={`filtermenu__btn ${selected.length > 0 ? 'is-on' : ''}`}
        style={first ? { '--dept-color': first.color } : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {selected.length > 0 && <span className="swatch" style={{ background: first?.color }} />}
        <span className="filtermenu__summary">{summary}</span>
        <span className="filtermenu__caret">▾</span>
      </button>

      {open && (
        <div className="filtermenu__panel" role="dialog" aria-label="工程で強調">
          <div className="filtermenu__head">
            <span>強調する工程を選ぶ</span>
            <button
              type="button"
              className="filtermenu__clear"
              disabled={selected.length === 0}
              onClick={onClear}
            >
              解除
            </button>
          </div>

          {departments.length === 0 && <p className="muted">工程がありません。</p>}

          <ul className="filtermenu__list">
            {departments.map((dept) => {
              const on = selected.includes(dept.label);
              return (
                <li key={dept.label}>
                  <label className={`filtermenu__item ${on ? 'is-on' : ''}`} style={{ '--dept-color': dept.color }}>
                    <input type="checkbox" checked={on} onChange={() => onToggle(dept.label)} />
                    <span className="swatch" style={{ background: dept.color }} />
                    <span className="filtermenu__label">{dept.label}</span>
                    <span className="filtermenu__count" title="この工程を持つプロジェクト数">
                      {dept.count}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
