import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadProjects, saveProjects } from '../lib/storage.js';
import { createDepartment } from '../lib/departments.js';
import { createId, createProject, departmentsOf, emptyPhase } from '../lib/project.js';
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
  const [projects, setProjects] = useState(loadProjects);

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

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

  const addProject = useCallback((input) => {
    const project = createProject(input);
    // 新規プロジェクトは必ず最下行に追加する
    setProjects((prev) => [...prev, project]);
    return project.id;
  }, []);

  const updateProject = useCallback((id, patch) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p))
    );
  }, []);

  const removeProject = useCallback((id) => setProjects((prev) => prev.filter((p) => p.id !== id)), []);

  const completeProject = useCallback(
    (id) => setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, completedAt: todayISO() } : p))),
    []
  );

  const restoreProject = useCallback((id) => {
    // 復帰したプロジェクトは進行中の最下行に戻す
    setProjects((prev) => {
      const target = prev.find((p) => p.id === id);
      if (!target) return prev;
      return [...prev.filter((p) => p.id !== id), { ...target, completedAt: null }];
    });
  }, []);

  const moveProject = useCallback((id, delta) => {
    setProjects((prev) => {
      const from = prev.filter((p) => !p.completedAt).findIndex((p) => p.id === id);
      if (from < 0) return prev;
      return reorderActive(prev, from, from + delta);
    });
  }, []);

  const moveProjectToTop = useCallback((id) => {
    setProjects((prev) => {
      const from = prev.filter((p) => !p.completedAt).findIndex((p) => p.id === id);
      if (from < 0) return prev;
      return reorderActive(prev, from, 0);
    });
  }, []);

  /** ドラッグ&ドロップ用: 進行中リスト内のインデックス指定で並べ替える */
  const moveProjectToIndex = useCallback((id, toIndex) => {
    setProjects((prev) => {
      const from = prev.filter((p) => !p.completedAt).findIndex((p) => p.id === id);
      if (from < 0) return prev;
      return reorderActive(prev, from, toIndex);
    });
  }, []);

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

  /* ---------- 工程（担当区分）: すべてプロジェクト単位 ---------- */

  const addDepartment = useCallback(
    (projectId, label) => {
      updateProject(projectId, (p) => {
        const dept = createDepartment(departmentsOf(p), label);
        return {
          departments: [...departmentsOf(p), dept],
          phases: { ...p.phases, [dept.id]: emptyPhase() },
        };
      });
    },
    [updateProject]
  );

  const updateDepartment = useCallback(
    (projectId, deptId, patch) => {
      updateProject(projectId, (p) => ({
        departments: departmentsOf(p).map((d) => (d.id === deptId ? { ...d, ...patch } : d)),
      }));
    },
    [updateProject]
  );

  const moveDepartment = useCallback(
    (projectId, deptId, delta) => {
      updateProject(projectId, (p) => {
        const list = departmentsOf(p).slice();
        const from = list.findIndex((d) => d.id === deptId);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= list.length) return {};
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
        return { departments: list };
      });
    },
    [updateProject]
  );

  /** 工程を削除する。担当者・期間も消え、その工程の TODO は「工程なし」に戻る。 */
  const removeDepartment = useCallback(
    (projectId, deptId) => {
      updateProject(projectId, (p) => {
        const phases = { ...p.phases };
        delete phases[deptId];
        return {
          departments: departmentsOf(p).filter((d) => d.id !== deptId),
          phases,
          todos: p.todos.map((t) => (t.dept === deptId ? { ...t, dept: '' } : t)),
        };
      });
    },
    [updateProject]
  );

  return {
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
