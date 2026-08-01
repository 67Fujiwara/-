import { DEPARTMENTS } from '../constants.js';
import { formatJP, toISO } from '../lib/date.js';
import { projectProgress, projectRange, todoStats } from '../lib/project.js';
import DeptChip from './DeptChip.jsx';

/** ガントチャートの1行 = 1プロジェクト。行の中に部署ごとのレーンを重ねて表示する。 */
export default function GanttRow({
  project,
  index,
  total,
  timeline,
  selected,
  deptFilter,
  dragging,
  dropTarget,
  onSelect,
  onMoveUp,
  onMoveDown,
  onMoveTop,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}) {
  const range = projectRange(project);
  const progress = projectProgress(project);
  const todo = todoStats(project);
  const band = range ? timeline.barFor(toISO(range.start), toISO(range.end)) : null;

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
          <span className="grow__order-btns">
            <button
              type="button"
              className="iconbtn"
              title="最優先（一番上）へ"
              disabled={index === 0}
              onClick={() => onMoveTop(project.id)}
            >
              ⤒
            </button>
            <button
              type="button"
              className="iconbtn"
              title="1つ上へ"
              disabled={index === 0}
              onClick={() => onMoveUp(project.id)}
            >
              ↑
            </button>
            <button
              type="button"
              className="iconbtn"
              title="1つ下へ"
              disabled={index === total - 1}
              onClick={() => onMoveDown(project.id)}
            >
              ↓
            </button>
          </span>
        </div>

        <div className="grow__meta">
          {project.client && <span className="grow__client">{project.client}</span>}
          <span className="grow__progress">進捗 {progress}%</span>
          {todo.total > 0 && (
            <span className={`grow__todo ${todo.remaining === 0 ? 'is-done' : ''}`}>
              TODO {todo.done}/{todo.total}
            </span>
          )}
        </div>

        <div className="grow__chips">
          {DEPARTMENTS.map((dept) => (
            <DeptChip
              key={dept.key}
              deptKey={dept.key}
              owner={project.phases[dept.key]?.owner}
              dimmed={Boolean(deptFilter) && deptFilter !== dept.key}
              size="sm"
            />
          ))}
        </div>
      </div>

      <div className="grow__track" style={{ width: timeline.width }} onClick={() => onSelect(project.id)}>
        {band && (
          <div className="span-band" style={{ left: band.left, width: band.width }}>
            <span className="span-band__label">
              {range ? `${formatJP(toISO(range.start))} 〜 ${formatJP(toISO(range.end))}` : ''}
            </span>
          </div>
        )}

        <div className="lanes">
          {DEPARTMENTS.map((dept) => {
            const phase = project.phases[dept.key];
            const bar = phase && phase.start && phase.end ? timeline.barFor(phase.start, phase.end) : null;
            const dimmed = Boolean(deptFilter) && deptFilter !== dept.key;
            return (
              <div className="lane" key={dept.key}>
                {bar && (
                  <div
                    className={`bar ${dimmed ? 'is-dimmed' : ''}`}
                    style={{
                      left: bar.left,
                      width: bar.width,
                      '--dept-color': dept.color,
                      '--dept-soft': dept.soft,
                    }}
                    title={`${dept.label} ${phase.owner || '担当未設定'}\n${formatJP(phase.start)} 〜 ${formatJP(
                      phase.end
                    )}\n進捗 ${phase.progress}%`}
                  >
                    <span className="bar__fill" style={{ width: `${phase.progress}%` }} />
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
