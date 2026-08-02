import { useCallback, useEffect, useMemo, useState } from 'react';
import { ZOOM_LEVELS } from './constants.js';
import { useBoard } from './hooks/useBoard.js';
import { addDays, today, toISO } from './lib/date.js';
import { departmentsOf } from './lib/project.js';
import GanttChart from './components/GanttChart.jsx';
import ProjectDrawer from './components/ProjectDrawer.jsx';
import CompletedPage from './components/CompletedPage.jsx';
import DeptFilterMenu from './components/DeptFilterMenu.jsx';
import DataTransfer from './components/DataTransfer.jsx';

export default function App() {
  const {
    projects,
    activeProjects,
    completedProjects,
    addProject,
    updateProject,
    removeProject,
    completeProject,
    restoreProject,
    moveProjectToIndex,
    replaceProjects,
    addTodo,
    toggleTodo,
    removeTodo,
    addDepartment,
    addAssignment,
    updateAssignment,
    removeAssignment,
    updateDepartment,
    moveDepartment,
    removeDepartment,
  } = useBoard();

  const [page, setPage] = useState('active');
  const [zoom, setZoom] = useState('week');
  const [deptFilters, setDeptFilters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newProjectId, setNewProjectId] = useState(null);
  const [focusTodaySignal, setFocusTodaySignal] = useState(0);

  const selected = useMemo(
    () => activeProjects.find((p) => p.id === selectedId) || null,
    [activeProjects, selectedId]
  );

  // 選択中のプロジェクトが完了・削除されたら詳細パネルを閉じる
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  // 工程はプロジェクトごとに持つので、強調の選択肢は全プロジェクトの工程名をまとめて作る
  // （同じ名前の工程は、プロジェクトが違っても1つにまとめ、使用プロジェクト数を添える）
  const filterDepartments = useMemo(() => {
    const map = new Map();
    for (const project of activeProjects) {
      for (const dept of departmentsOf(project)) {
        const found = map.get(dept.label);
        if (found) found.count += 1;
        else map.set(dept.label, { label: dept.label, color: dept.color, count: 1 });
      }
    }
    return [...map.values()];
  }, [activeProjects]);

  // 無くなった工程名で絞り込んだままにならないようにする
  useEffect(() => {
    setDeptFilters((prev) => {
      const next = prev.filter((label) => filterDepartments.some((d) => d.label === label));
      return next.length === prev.length ? prev : next;
    });
  }, [filterDepartments]);

  const toggleDeptFilter = useCallback((label) => {
    setDeptFilters((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }, []);

  const handleAdd = useCallback(() => {
    const base = today();
    // 追加直後でもガントに現れるよう、先頭工程に今日から2週間を仮置きする
    const id = addProject({ name: '新規プロジェクト' });
    setPage('active');
    setSelectedId(id);
    setNewProjectId(id);
    // createProject 内で既定の工程が作られるので、その先頭に仮の期間を入れる
    updateProject(id, (p) => {
      const first = departmentsOf(p)[0];
      if (!first) return {};
      return {
        phases: {
          ...p.phases,
          [first.id]: { ...p.phases[first.id], start: toISO(base), end: toISO(addDays(base, 13)) },
        },
      };
    });
  }, [addProject, updateProject]);

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

        <div className="topbar__actions">
          <DataTransfer
            projects={projects}
            onImport={(next) => {
              replaceProjects(next);
              setSelectedId(null);
              setPage('active');
            }}
          />
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
        </div>
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
            <DeptFilterMenu
              departments={filterDepartments}
              selected={deptFilters}
              onToggle={toggleDeptFilter}
              onClear={() => setDeptFilters([])}
            />
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
            zoom={zoom}
            selectedId={selectedId}
            deptFilters={deptFilters}
            focusTodaySignal={focusTodaySignal}
            onSelect={(id) => {
              setSelectedId(id);
              setNewProjectId(null);
            }}
            onReorder={moveProjectToIndex}
          />
        ) : (
          <CompletedPage
            projects={completedProjects}
            onRestore={restoreProject}
            onDelete={removeProject}
          />
        )}
      </main>

      {selected && (
        <ProjectDrawer
          project={selected}
          isNew={selected.id === newProjectId}
          onClose={() => setSelectedId(null)}
          onUpdate={updateProject}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onAddTodo={addTodo}
          onToggleTodo={toggleTodo}
          onRemoveTodo={removeTodo}
          onAddDept={addDepartment}
          onAddAssignment={addAssignment}
          onUpdateAssignment={updateAssignment}
          onRemoveAssignment={removeAssignment}
          onUpdateDept={updateDepartment}
          onMoveDept={moveDepartment}
          onRemoveDept={removeDepartment}
        />
      )}
    </div>
  );
}
