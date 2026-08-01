import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadBoard, saveBoard } from '../lib/storage.js';
import { createDepartment } from '../lib/departments.js';
import { createId, createProject, emptyPhase } from '../lib/project.js';
import { todayISO } from '../lib/date.js';

/** 進行中プロジェクトだけを並べ替える（完了プロジェクトの位置は動かさない） */
function reorderActive(list, fromIndex, toIndex) {
  const slots = [];
  const items = [];
  list.forEach((project, index) => {
    if (!project.completedAt) {
      slots.push(index);
      items.push(project);
    }
  });
  if (fromIndex < 0 || fromIndex >= items.length) return list;
  const target = Math.min(items.length - 1, Math.max(0, toIndex));
  if (target === fromIndex) return list;

  const [moved] = items.splice(fromIndex, 1);
  items.splice(target, 0, moved);

  const next = list.slice();
  slots.forEach((slot, i) => {
    next[slot] = items[i];
  });
  return next;
}

export function useBoard() {
  const [board, setBoard] = useState(loadBoard);
  const { departments, projects } = board;

  useEffect(() => {
    saveBoard(board);
  }, [board]);

  const setProjects = useCallback((updater) => {
    setBoard((prev) => ({
      ...prev,
      projects: typeof updater === 'function' ? updater(prev.projects) : updater,
    }));
  }, []);

  const activeProjects = useMemo(() => projects.filter((p) => !p.completedAt), [projects]);
  const completedProjects = useMemo(
    () =>
      projects
        .filter((p) => p.completedAt)
        .slice()
        .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)),
    [projects]
  );

  /* ---------- プロジェクト ---------- */

  const addProject = useCallback(
    (input) => {
      const project = createProject(input, departments);
      // 新規プロジェクトは必ず最下行に追加する
      setProjects((prev) => [...prev, project]);
      return project.id;
    },
    [departments, setProjects]
  );

  const updateProject = useCallback(
    (id, patch) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p))
      );
    },
    [setProjects]
  );

  const removeProject = useCallback(
    (id) => setProjects((prev) => prev.filter((p) => p.id !== id)),
    [setProjects]
  );

  const completeProject = useCallback(
    (id) => setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, completedAt: todayISO() } : p))),
    [setProjects]
  );

  const restoreProject = useCallback(
    (id) => {
      // 復帰したプロジェクトは進行中の最下行に戻す
      setProjects((prev) => {
        const target = prev.find((p) => p.id === id);
        if (!target) return prev;
        return [...prev.filter((p) => p.id !== id), { ...target, completedAt: null }];
      });
    },
    [setProjects]
  );

  const moveProject = useCallback(
    (id, delta) => {
      setProjects((prev) => {
        const from = prev.filter((p) => !p.completedAt).findIndex((p) => p.id === id);
        if (from < 0) return prev;
        return reorderActive(prev, from, from + delta);
      });
    },
    [setProjects]
  );

  const moveProjectToTop = useCallback(
    (id) => {
      setProjects((prev) => {
        const from = prev.filter((p) => !p.completedAt).findIndex((p) => p.id === id);
        if (from < 0) return prev;
        return reorderActive(prev, from, 0);
      });
    },
    [setProjects]
  );

  /** ドラッグ&ドロップ用: 進行中リスト内のインデックス指定で並べ替える */
  const moveProjectToIndex = useCallback(
    (id, toIndex) => {
      setProjects((prev) => {
        const from = prev.filter((p) => !p.completedAt).findIndex((p) => p.id === id);
        if (from < 0) return prev;
        return reorderActive(prev, from, toIndex);
      });
    },
    [setProjects]
  );

  /* ---------- TODO ---------- */

  const addTodo = useCallback(
    (projectId, { text, dept = '', start = '', end = '' }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      updateProject(projectId, (p) => ({
        todos: [...p.todos, { id: createId('t'), text: trimmed, done: false, dept, start, end }],
      }));
    },
    [updateProject]
  );

  const toggleTodo = useCallback(
    (projectId, todoId) => {
      updateProject(projectId, (p) => ({
        todos: p.todos.map((t) => (t.id === todoId ? { ...t, done: !t.done } : t)),
      }));
    },
    [updateProject]
  );

  const removeTodo = useCallback(
    (projectId, todoId) => {
      updateProject(projectId, (p) => ({ todos: p.todos.filter((t) => t.id !== todoId) }));
    },
    [updateProject]
  );

  /* ---------- 工程（担当区分） ---------- */

  const addDepartment = useCallback((label) => {
    setBoard((prev) => {
      const dept = createDepartment(prev.departments, label);
      return {
        departments: [...prev.departments, dept],
        projects: prev.projects.map((p) => ({
          ...p,
          phases: { ...p.phases, [dept.id]: emptyPhase() },
        })),
      };
    });
  }, []);

  const updateDepartment = useCallback((id, patch) => {
    setBoard((prev) => ({
      ...prev,
      departments: prev.departments.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }, []);

  const moveDepartment = useCallback((id, delta) => {
    setBoard((prev) => {
      const list = prev.departments.slice();
      const from = list.findIndex((d) => d.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= list.length) return prev;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...prev, departments: list };
    });
  }, []);

  /** 工程を削除する。各プロジェクトの担当・期間・TODOの紐づけも一緒に外す。 */
  const removeDepartment = useCallback((id) => {
    setBoard((prev) => {
      if (prev.departments.length <= 1) return prev;
      return {
        departments: prev.departments.filter((d) => d.id !== id),
        projects: prev.projects.map((p) => {
          const phases = { ...p.phases };
          delete phases[id];
          return {
            ...p,
            phases,
            todos: p.todos.map((t) => (t.dept === id ? { ...t, dept: '' } : t)),
          };
        }),
      };
    });
  }, []);

  return {
    departments,
    projects,
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
  };
}
