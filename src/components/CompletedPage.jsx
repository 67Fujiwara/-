import { useMemo, useState } from 'react';
import { formatJP, toISO } from '../lib/date.js';
import { departmentsFor, phaseOf, projectRange, todoStats } from '../lib/project.js';
import DeptChip from './DeptChip.jsx';
import TodoList from './TodoList.jsx';

/** 完了プロジェクト一覧（別ページ） */
export default function CompletedPage({ projects, departments, onRestore, onDelete }) {
  const [keyword, setKeyword] = useState('');
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const owners = departments.map((d) => phaseOf(p, d.id).owner).join(' ');
      return `${p.name} ${p.client} ${owners}`.toLowerCase().includes(q);
    });
  }, [projects, departments, keyword]);

  return (
    <div className="completed">
      <div className="completed__head">
        <h2>完了プロジェクト</h2>
        <input
          type="search"
          value={keyword}
          placeholder="プロジェクト名・客先・担当者で検索"
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      {projects.length === 0 && (
        <p className="muted">
          完了したプロジェクトはまだありません。進行中ページで「✓ 完了にする」を押すとここに移動します。
        </p>
      )}
      {projects.length > 0 && filtered.length === 0 && (
        <p className="muted">該当するプロジェクトがありません。</p>
      )}

      <ul className="completed__list">
        {filtered.map((project) => {
          const range = projectRange(project, departments);
          const allDepts = departmentsFor(project, departments);
          const todo = todoStats(project);
          const open = openId === project.id;
          return (
            <li key={project.id} className="ccard">
              <div className="ccard__main">
                <div className="ccard__title">
                  <span className="ccard__check">✓</span>
                  <div>
                    <h3>{project.name}</h3>
                    <p className="ccard__sub">
                      {project.client || '客先未設定'}
                      <span className="dot">・</span>
                      完了日 {formatJP(project.completedAt)}
                      {project.launchDate && (
                        <>
                          <span className="dot">・</span>
                          立ち上げ日 {formatJP(project.launchDate)}
                        </>
                      )}
                      {range && (
                        <>
                          <span className="dot">・</span>
                          {formatJP(toISO(range.start))} 〜 {formatJP(toISO(range.end))}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="ccard__chips">
                  {allDepts.map((dept) => (
                    <DeptChip key={dept.id} dept={dept} owner={phaseOf(project, dept.id).owner} />
                  ))}
                </div>

                <div className="ccard__actions">
                  <span className="badge">
                    TODO {todo.done}/{todo.total}
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setOpenId(open ? null : project.id)}
                  >
                    {open ? '閉じる' : '詳細'}
                  </button>
                  <button type="button" className="btn" onClick={() => onRestore(project.id)}>
                    進行中に戻す
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => {
                      if (window.confirm(`「${project.name}」を完全に削除します。よろしいですか？`)) {
                        onDelete(project.id);
                      }
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>

              {open && (
                <div className="ccard__detail">
                  {project.note && <p className="ccard__note">{project.note}</p>}
                  <div className="ccard__phases">
                    {allDepts.map((dept) => {
                      const phase = phaseOf(project, dept.id);
                      return (
                        <div className="ccard__phase" key={dept.id} style={{ '--dept-color': dept.color }}>
                          <span className="ccard__phase-label">{dept.label}</span>
                          <span className="ccard__phase-owner">{phase.owner || '担当未設定'}</span>
                          <span className="ccard__phase-date">
                            {phase.start && phase.end
                              ? `${formatJP(phase.start)} 〜 ${formatJP(phase.end)}`
                              : '期間未設定'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <TodoList project={project} departments={allDepts} readOnly />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
