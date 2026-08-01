import { useCallback, useEffect, useMemo, useState } from 'react';
import { ZOOM_LEVELS } from './constants.js';
import { useBoard } from './hooks/useBoard.js';
import { addDays, today, toISO } from './lib/date.js';
import GanttChart from './components/GanttChart.jsx';
import ProjectDrawer from './components/ProjectDrawer.jsx';
import CompletedPage from './components/CompletedPage.jsx';
import DeptSettingsModal from './components/DeptSettingsModal.jsx';

export default function App() {
  const {
    departments,
    activeProjects,
    completedProjects,
    addProject,
    updateProject,
    removeProject,
    completeProject,
    restoreProject,
    moveProject,
    moveProjectToTop,
    moveProjectToIndex,
    addTodo,
    toggleTodo,
    removeTodo,
    addDepartment,
    updateDepartment,
    moveDepartment,
    removeDepartment,
    addProjectDepartment,
    updateProjectDepartment,
    moveProjectDepartment,
    removeProjectDepartment,
  } = useBoard();

  const [page, setPage] = useState('active');
  const [zoom, setZoom] = useState('week');
  const [deptFilter, setDeptFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [newProjectId, setNewProjectId] = useState(null);
  const [focusTodaySignal, setFocusTodaySignal] = useState(0);
  const [deptSettingsOpen, setDeptSettingsOpen] = useState(false);

  const selected = useMemo(
    () => activeProjects.find((p) => p.id === selectedId) || null,
    [activeProjects, selectedId]
  );

  // 選択中のプロジェクトが完了・削除されたら詳細パネルを閉じる
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  // 削除された工程で絞り込んだままにならないようにする
  useEffect(() => {
    if (deptFilter && !departments.some((d) => d.id === deptFilter)) setDeptFilter('');
  }, [deptFilter, departments]);

  const handleAdd = useCallback(() => {
    const base = today();
    const first = departments[0];
    // 追加直後でもガントに現れるよう、先頭工程に今日から2週間を仮置きする
    const id = addProject({
      name: '新規プロジェクト',
      phases: first
        ? { [first.id]: { owner: '', start: toISO(base), end: toISO(addDays(base, 13)), progress: 0 } }
        : {},
    });
    setPage('active');
    setSelectedId(id);
    setNewProjectId(id);
  }, [addProject, departments]);

  const handleComplete = useCallback(
    (id) => {
      completeProject(id);
      setSelectedId(null);
    },
    [completeProject]
  );

  const handleDelete = useCallback(
    (id) => {
      removeProject(id);
      setSelectedId(null);
    },
    [removeProject]
  );

  const todoSummary = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const p of activeProjects) {
      total += p.todos.length;
      done += p.todos.filter((t) => t.done).length;
    }
    return { done, total };
  }, [activeProjects]);

  return (
    <div className={`app ${selected ? 'app--drawer-open' : ''}`}>
      <header className="topbar">
        <div className="topbar__title">
          <h1>プロジェクト工程ボード</h1>
          <p>各工程の担当と進み具合を横一列で確認できます。</p>
        </div>

        <nav className="tabs" aria-label="ページ切り替え">
          <button
            type="button"
            className={`tab ${page === 'active' ? 'is-active' : ''}`}
            onClick={() => setPage('active')}
          >
            進行中 <span className="tab__count">{activeProjects.length}</span>
          </button>
          <button
            type="button"
            className={`tab ${page === 'completed' ? 'is-active' : ''}`}
            onClick={() => setPage('completed')}
          >
            完了 <span className="tab__count">{completedProjects.length}</span>
          </button>
        </nav>
      </header>

      {page === 'active' && (
        <div className="toolbar">
          <div className="toolbar__group">
            <span className="toolbar__label">表示単位</span>
            <div className="segmented">
              {Object.entries(ZOOM_LEVELS).map(([key, value]) => (
                <button
                  type="button"
                  key={key}
                  className={zoom === key ? 'is-active' : ''}
                  onClick={() => setZoom(key)}
                >
                  {value.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setFocusTodaySignal((n) => n + 1)}
            >
              今日へ
            </button>
          </div>

          <div className="toolbar__group">
            <span className="toolbar__label">工程で強調</span>
            <div className="segmented segmented--dept">
              <button
                type="button"
                className={deptFilter === '' ? 'is-active' : ''}
                onClick={() => setDeptFilter('')}
              >
                すべて
              </button>
              {departments.map((dept) => (
                <button
                  type="button"
                  key={dept.id}
                  className={deptFilter === dept.id ? 'is-active' : ''}
                  style={{ '--dept-color': dept.color }}
                  onClick={() => setDeptFilter(deptFilter === dept.id ? '' : dept.id)}
                >
                  <span className="swatch" style={{ background: dept.color }} />
                  {dept.label}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn--ghost" onClick={() => setDeptSettingsOpen(true)}>
              工程を編集
            </button>
          </div>

          <div className="toolbar__group toolbar__group--right">
            <span className="muted">
              TODO 全体 {todoSummary.done}/{todoSummary.total}
            </span>
            <button type="button" className="btn btn--primary" onClick={handleAdd}>
              ＋ プロジェクト追加
            </button>
          </div>
        </div>
      )}

      <main className="main">
        {page === 'active' ? (
          <GanttChart
            projects={activeProjects}
            departments={departments}
            zoom={zoom}
            selectedId={selectedId}
            deptFilter={deptFilter}
            focusTodaySignal={focusTodaySignal}
            onSelect={(id) => {
              setSelectedId(id);
              setNewProjectId(null);
            }}
            onMoveUp={(id) => moveProject(id, -1)}
            onMoveDown={(id) => moveProject(id, 1)}
            onMoveTop={moveProjectToTop}
            onReorder={moveProjectToIndex}
            onAdd={handleAdd}
          />
        ) : (
          <CompletedPage
            projects={completedProjects}
            departments={departments}
            onRestore={restoreProject}
            onDelete={removeProject}
          />
        )}
      </main>

      {selected && (
        <ProjectDrawer
          project={selected}
          departments={departments}
          isNew={selected.id === newProjectId}
          onClose={() => setSelectedId(null)}
          onUpdate={updateProject}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onAddTodo={addTodo}
          onToggleTodo={toggleTodo}
          onRemoveTodo={removeTodo}
          onOpenDeptSettings={() => setDeptSettingsOpen(true)}
        />
      )}

      {deptSettingsOpen && (
        <DeptSettingsModal
          departments={departments}
          project={selected}
          onAdd={addDepartment}
          onUpdate={updateDepartment}
          onMove={moveDepartment}
          onRemove={removeDepartment}
          onAddProjectDept={addProjectDepartment}
          onUpdateProjectDept={updateProjectDepartment}
          onMoveProjectDept={moveProjectDepartment}
          onRemoveProjectDept={removeProjectDepartment}
          onClose={() => setDeptSettingsOpen(false)}
        />
      )}
    </div>
  );
}
