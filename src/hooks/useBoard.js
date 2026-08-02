import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadProjects, saveProjects } from '../lib/storage.js';
import { createDepartment } from '../lib/departments.js';
import {
  assignmentsOf,
  createId,
  createProject,
  departmentsOf,
  emptyAssignment,
  emptyPhase,
} from '../lib/project.js';
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

  /** ドラッグ&ドロップ用: 進行中リスト内のインデックス指定で並べ替える */
  const moveProjectToIndex = useCallback((id, toIndex) => {
    setProjects((prev) => {
      const from = prev.filter((p) => !p.completedAt).findIndex((p) => p.id === id);
      if (from < 0) return prev;
      return reorderActive(prev, from, toIndex);
    });
  }, []);

  /** 読み込んだデータで全体を置き換える（JSON 読み込み用） */
  const replaceProjects = useCallback((next) => setProjects(next), []);

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

  /**
   * 工程を追加する。同じ名前の工程が既にある場合は列を増やさず、
   * その工程に担当（＋期間）を1件足す。
   */
  const addDepartment = useCallback(
    (projectId, label) => {
      const name = label.trim();
      updateProject(projectId, (p) => {
        const existing = departmentsOf(p).find((d) => d.label.trim() === name);
        if (existing) {
          return {
            phases: {
              ...p.phases,
              [existing.id]: [...assignmentsOf(p, existing.id), emptyAssignment()],
            },
          };
        }
        const dept = createDepartment(departmentsOf(p), name || '新しい工程');
        return {
          departments: [...departmentsOf(p), dept],
          phases: { ...p.phases, [dept.id]: emptyPhase() },
        };
      });
    },
    [updateProject]
  );

  /* ---------- 担当（工程の中の1本のバー） ---------- */

  const addAssignment = useCallback(
    (projectId, deptId) => {
      updateProject(projectId, (p) => ({
        phases: { ...p.phases, [deptId]: [...assignmentsOf(p, deptId), emptyAssignment()] },
      }));
    },
    [updateProject]
  );

  const updateAssignment = useCallback(
    (projectId, deptId, assignmentId, patch) => {
      updateProject(projectId, (p) => ({
        phases: {
          ...p.phases,
          [deptId]: assignmentsOf(p, deptId).map((a) =>
            a.id === assignmentId ? { ...a, ...patch } : a
          ),
        },
      }));
    },
    [updateProject]
  );

  const removeAssignment = useCallback(
    (projectId, deptId, assignmentId) => {
      updateProject(projectId, (p) => {
        const rest = assignmentsOf(p, deptId).filter((a) => a.id !== assignmentId);
        // 最後の1件は消さず、空欄として残す
        return {
          phases: { ...p.phases, [deptId]: rest.length > 0 ? rest : [emptyAssignment()] },
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
  };
}
