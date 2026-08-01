import { formatJP, toISO } from '../lib/date.js';
import {
  departmentsOf,
  phaseOf,
  phaseProgress,
  projectProgress,
  projectRange,
  todoStats,
  todosOfDept,
} from '../lib/project.js';
import DeptChip from './DeptChip.jsx';
import SlackLink from './SlackLink.jsx';

/** ガントチャートの1行 = 1プロジェクト。行の中に工程ごとのレーンを並べて表示する。 */
export default function GanttRow({
  project,
  index,
  timeline,
  rowHeight,
  selected,
  deptFilters,
  dragging,
  dropTarget,
  onSelect,
  onBarHover,
  onHoverEnd,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}) {
  const allDepts = departmentsOf(project);
  const range = projectRange(project);
  const progress = projectProgress(project);
  const todo = todoStats(project);
  const band = range ? timeline.barFor(toISO(range.start), toISO(range.end)) : null;
  const launchX = project.launchDate ? timeline.xForISO(project.launchDate) : null;
  const isDimmed = (dept) => deptFilters.length > 0 && !deptFilters.includes(dept.label);

  const rowClass = [
    'grow',
    selected ? 'is-selected' : '',
    dragging ? 'is-dragging' : '',
    dropTarget ? 'is-drop-target' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rowClass}
      style={{ minHeight: rowHeight }}
      onDragEnter={(e) => onDragEnter(e, index)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, index)}
    >
      <div
        className="grow__left"
        draggable
        onDragStart={(e) => onDragStart(e, index)}
        onDragEnd={onDragEnd}
      >
        <div className="grow__head">
          <span className="grow__handle" title="ドラッグで並べ替え">
            ⠿
          </span>
          <span className="grow__rank" title={`表示順 ${index + 1} 番目`}>
            {index + 1}
          </span>
          <button type="button" className="grow__name" onClick={() => onSelect(project.id)}>
            {project.name}
          </button>
          <SlackLink url={project.slackUrl} />
        </div>

        <div className="grow__meta">
          {project.client && <span className="grow__client">{project.client}</span>}
          <span className="grow__progress">進捗 {progress}%</span>
          {project.launchDate && (
            <span className="grow__launch" title="立ち上げ日">
              ◆ {formatJP(project.launchDate)}
            </span>
          )}
          {todo.total > 0 && (
            <span className={`grow__todo ${todo.remaining === 0 ? 'is-done' : ''}`}>
              TODO {todo.done}/{todo.total}
            </span>
          )}
        </div>

        <div className="grow__chips">
          {allDepts.map((dept) => (
            <DeptChip
              key={dept.id}
              dept={dept}
              owner={phaseOf(project, dept.id).owner}
              dimmed={isDimmed(dept)}
            />
          ))}
        </div>
      </div>

      <div className="grow__track" style={{ width: timeline.width }} onClick={() => onSelect(project.id)}>
        {band && (
          <div className="span-band" style={{ left: band.left, width: band.width }}>
            <span className="span-band__label">
              {`${formatJP(toISO(range.start))} 〜 ${formatJP(toISO(range.end))}`}
            </span>
          </div>
        )}

        {launchX !== null && (
          <div
            className="launch-marker"
            style={{ left: launchX }}
            title={`立ち上げ日 ${formatJP(project.launchDate)}`}
          >
            <span className="launch-marker__dot">◆</span>
          </div>
        )}

        <div className="lanes">
          {allDepts.map((dept) => {
            const phase = phaseOf(project, dept.id);
            const bar = phase.start && phase.end ? timeline.barFor(phase.start, phase.end) : null;
            const dimmed = isDimmed(dept);
            const prog = phaseProgress(project, dept.id);
            const deptTodos = todosOfDept(project, dept.id);
            return (
              <div className="lane" key={dept.id}>
                {bar && (
                  <div
                    className={`bar ${dimmed ? 'is-dimmed' : ''} ${deptTodos.length > 0 ? 'has-todo' : ''}`}
                    style={{ left: bar.left, width: bar.width, '--dept-color': dept.color }}
                    title={`${dept.label} ${phase.owner || '担当未設定'}\n${formatJP(phase.start)} 〜 ${formatJP(
                      phase.end
                    )}\n進捗 ${prog.value}%${prog.auto ? `（TODO ${prog.done}/${prog.total} から自動）` : ''}`}
                    onMouseEnter={(e) => onBarHover(project, dept, deptTodos, e)}
                    onMouseMove={(e) => onBarHover(project, dept, deptTodos, e)}
                    onMouseLeave={onHoverEnd}
                  >
                    <span className="bar__fill" style={{ width: `${prog.value}%` }} />
                    <span className="bar__text">
                      {dept.label}
                      {phase.owner ? ` ${phase.owner}` : ''}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
