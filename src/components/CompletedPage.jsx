import { useMemo, useState } from 'react';
import { formatJP, toISO } from '../lib/date.js';
import { assignmentsOf, departmentsOf, projectRange, todoStats } from '../lib/project.js';
import DeptChip from './DeptChip.jsx';
import SlackLink from './SlackLink.jsx';
import FusionLink from './FusionLink.jsx';
import FolderLink from './FolderLink.jsx';
import TodoList from './TodoList.jsx';

/** 完了プロジェクト一覧（別ページ） */
export default function CompletedPage({ projects, onRestore, onDelete, defaultNotifyDays }) {
  const [keyword, setKeyword] = useState('');
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const owners = departmentsOf(p)
        .flatMap((d) => assignmentsOf(p, d.id).map((a) => a.owner))
        .join(' ');
      return `${p.name} ${p.client} ${owners}`.toLowerCase().includes(q);
    });
  }, [projects, keyword]);

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
          const range = projectRange(project);
          const allDepts = departmentsOf(project);
          const todo = todoStats(project);
          const open = openId === project.id;
          return (
            <li key={project.id} className="ccard">
              <div className="ccard__main">
                <div className="ccard__title">
                  <span className="ccard__check">✓</span>
                  <div>
                    <h3 className="ccard__name">
                      {project.name}
                      <SlackLink url={project.slackUrl} />
                      <FolderLink url={project.folderUrl} />
                      <FusionLink url={project.fusionUrl} />
                    </h3>
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
                    <DeptChip
                      key={dept.id}
                      dept={dept}
                      owners={assignmentsOf(project, dept.id).map((a) => a.owner)}
                    />
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
                    {allDepts.flatMap((dept) =>
                      assignmentsOf(project, dept.id).map((a, i) => (
                        <div
                          className="ccard__phase"
                          key={a.id}
                          style={{ '--dept-color': dept.color }}
                        >
                          <span className="ccard__phase-label">{i === 0 ? dept.label : ''}</span>
                          <span className="ccard__phase-owner">{a.owner || '担当未設定'}</span>
                          <span className="ccard__phase-date">
                            {a.start && a.end
                              ? `${formatJP(a.start)} 〜 ${formatJP(a.end)}`
                              : '期間未設定'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <TodoList
                    project={project}
                    departments={allDepts}
                    defaultNotifyDays={defaultNotifyDays}
                    readOnly
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
