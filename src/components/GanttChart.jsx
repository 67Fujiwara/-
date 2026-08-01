import { useEffect, useMemo, useRef, useState } from 'react';
import { LANE_GAP, LANE_HEIGHT, ROW_PADDING } from '../constants.js';
import { buildTimeline } from '../lib/timeline.js';
import { departmentsOf } from '../lib/project.js';
import GanttRow from './GanttRow.jsx';
import TodoHoverCard from './TodoHoverCard.jsx';

const LEFT_WIDTH = 360;

/** 進行中プロジェクトを横一列（1行1プロジェクト）で並べるガントチャート */
export default function GanttChart({
  projects,
  zoom,
  selectedId,
  deptFilter,
  focusTodaySignal,
  onSelect,
  onMoveUp,
  onMoveDown,
  onMoveTop,
  onReorder,
  onAdd,
}) {
  const scrollRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [hover, setHover] = useState(null);

  const timeline = useMemo(() => buildTimeline(projects, zoom), [projects, zoom]);

  // 工程数はプロジェクトごとに違うので、一番多い行に合わせて全行の高さを揃える
  const laneCount = projects.reduce((max, p) => Math.max(max, departmentsOf(p).length), 1);
  const rowHeight = ROW_PADDING + laneCount * (LANE_HEIGHT + LANE_GAP);

  // 「今日」が画面の左から1/3くらいに来るようにスクロールする
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // scrollLeft はタイムライン座標そのもの（左カラムは sticky なので加算しない）
    const trackVisible = Math.max(120, el.clientWidth - LEFT_WIDTH);
    el.scrollLeft = Math.max(0, timeline.todayX - trackVisible / 3);
  }, [focusTodaySignal, zoom, timeline.todayX]);

  const handleDragStart = (event, index) => {
    setDragIndex(index);
    setHover(null);
    event.dataTransfer.effectAllowed = 'move';
    // Firefox はデータをセットしないとドラッグが始まらない
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragEnter = (event, index) => {
    if (dragIndex === null) return;
    event.preventDefault();
    setDropIndex(index);
  };

  const handleDrop = (event, index) => {
    event.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      onReorder(projects[dragIndex].id, index);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  // ガントのバーに乗せたときだけ、その工程の TODO を出す
  const handleBarHover = (project, dept, todos, event) => {
    if (dragIndex !== null || todos.length === 0) return;
    setHover({ project, dept, todos, x: event.clientX, y: event.clientY });
  };

  return (
    <div
      className={`gantt gantt--${zoom}`}
      style={{ '--left-w': `${LEFT_WIDTH}px`, '--day-w': `${timeline.dayWidth}px` }}
    >
      <div className="gantt__scroll" ref={scrollRef} onScroll={() => setHover(null)}>
        <div className="gantt__inner" style={{ width: LEFT_WIDTH + timeline.width }}>
          <div className="gantt__head">
            <div className="gantt__head-left">
              <span>プロジェクト / 担当</span>
              <span className="gantt__hint">ドラッグまたは ↑↓ で並べ替え</span>
            </div>
            <div className="gantt__head-track" style={{ width: timeline.width }}>
              <div className="scale scale--months">
                {timeline.months.map((m) => (
                  <div className="scale__cell" key={m.key} style={{ left: m.left, width: m.width }}>
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="scale scale--ticks">
                {timeline.ticks.map((t) => (
                  <div
                    className={`scale__cell ${t.weekend ? 'is-weekend' : ''} ${t.isToday ? 'is-today' : ''}`}
                    key={t.key}
                    style={{ left: t.left, width: t.width }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="gantt__rows">
            {projects.map((project, index) => (
              <GanttRow
                key={project.id}
                project={project}
                index={index}
                total={projects.length}
                laneCount={laneCount}
                timeline={timeline}
                rowHeight={rowHeight}
                selected={project.id === selectedId}
                deptFilter={deptFilter}
                dragging={dragIndex === index}
                dropTarget={dropIndex === index && dragIndex !== index}
                onSelect={onSelect}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onMoveTop={onMoveTop}
                onBarHover={handleBarHover}
                onHoverEnd={() => setHover(null)}
                onDragStart={handleDragStart}
                onDragEnter={handleDragEnter}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
              />
            ))}

            <div className="gantt__addrow">
              <div className="gantt__addrow-left">
                <button type="button" className="btn btn--ghost btn--block" onClick={onAdd}>
                  ＋ プロジェクトを最下行に追加
                </button>
              </div>
              <div className="gantt__addrow-track" style={{ width: timeline.width }} />
            </div>

            <div
              className="today-line"
              style={{ left: `calc(var(--left-w) + ${timeline.todayX}px)` }}
              title="今日"
            >
              <span className="today-line__flag">今日</span>
            </div>
          </div>
        </div>
      </div>

      {projects.length === 0 && (
        <p className="gantt__empty">
          進行中のプロジェクトはありません。「＋ プロジェクトを最下行に追加」から作成してください。
        </p>
      )}

      {hover && (
        <TodoHoverCard
          project={hover.project}
          dept={hover.dept}
          todos={hover.todos}
          x={hover.x}
          y={hover.y}
        />
      )}
    </div>
  );
}
