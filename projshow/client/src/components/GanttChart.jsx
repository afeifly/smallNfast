import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useProjects } from '../context/ProjectContext.jsx';
import { api } from '../api/client.js';

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 50;
const LABEL_WIDTH = 220;
const ZOOM_LEVELS = {
  month: { label: 'Month', daysPerPixel: 0.24 },     // 1 day = 4.16px
  quarter: { label: 'Quarter', daysPerPixel: 0.3 },   // 1 day = 3.3px
  year: { label: 'Year', daysPerPixel: 1.0 },        // 1 day = 1px
};
const STATUS_COLORS = {
  completed: { fill: 'var(--emerald)', stroke: '#059669' },
  'in-progress': { fill: 'var(--cyan)', stroke: '#0891b2' },
  pending: { fill: 'var(--bg-surface)', stroke: 'var(--text-muted)' },
};

function parseDate(str) {
  if (!str) return null;
  return new Date(str + 'T00:00:00');
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function daysBetween(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nestSnapshotData(snapshotData) {
  const { projects = [], tasks = [], milestones = [] } = snapshotData;
  return projects.map((p) => {
    const pTasks = tasks.filter((t) => t.project_id === p.id);
    const pMilestones = milestones.filter((m) => m.project_id === p.id);
    return {
      ...p,
      tasks: pTasks,
      milestones: pMilestones,
    };
  });
}

export default function GanttChart() {
  const { projects, updateTask, setSelectedProject, isSharedView } = useProjects();
  const [zoom, setZoom] = useState('year');
  const [dragState, setDragState] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const chartAreaRef = useRef(null);

  // Time Travel states
  const [snapshots, setSnapshots] = useState([]);
  const [activeSnapshot, setActiveSnapshot] = useState(null);
  const [isTimeTraveling, setIsTimeTraveling] = useState(false);
  const [travelDateLabel, setTravelDateLabel] = useState('');
  const [draggedTodayX, setDraggedTodayX] = useState(null);

  // Selected task row state
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Hovered milestone state
  const [hoveredMilestone, setHoveredMilestone] = useState(null);

  // Resizable label column width state
  const [labelWidth, setLabelWidth] = useState(220);

  // Load history snapshots on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const list = await api.getHistoryList();
        const full = await Promise.all(
          list.map((item) => api.getHistorySnapshot(item.id))
        );
        full.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setSnapshots(full);
      } catch (err) {
        console.error('Failed to load history snapshots:', err);
      }
    }
    loadHistory();
  }, []);

  // Measure container width to ensure chart fills available space
  useEffect(() => {
    const measure = () => {
      if (chartAreaRef.current) {
        setContainerWidth(chartAreaRef.current.clientWidth);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const zoomConfig = ZOOM_LEVELS[zoom];

  const displayProjects = useMemo(() => {
    let rawList = [];
    if (activeSnapshot) {
      rawList = nestSnapshotData(activeSnapshot.data);
    } else {
      rawList = projects;
    }

    const active = rawList.filter((p) => p.status === 'active').sort((a, b) => {
      const getFarthest = (proj) => {
        const tasks = proj.tasks || [];
        let maxTime = 0;
        for (const t of tasks) {
          if (t.end_date) {
            const time = new Date(t.end_date).getTime();
            if (time > maxTime) maxTime = time;
          }
          if (t.start_date) {
            const time = new Date(t.start_date).getTime();
            if (time > maxTime) maxTime = time;
          }
        }
        return maxTime;
      };
      const timeA = getFarthest(a);
      const timeB = getFarthest(b);
      if (timeA !== timeB) return timeB - timeA; // Farthest first
      return new Date(b.created_at) - new Date(a.created_at);
    });

    const others = rawList.filter((p) => p.status !== 'active');
    return [...active, ...others];
  }, [projects, activeSnapshot]);

  // Flatten into rows: project headers + tasks
  const { rows, globalStart, globalEnd } = useMemo(() => {
    const rowList = [];
    const allDates = [];

    for (const project of displayProjects) {
      const tasks = project.tasks || [];
      const milestones = project.milestones || [];
      if (tasks.length === 0 && milestones.length === 0) continue;

      rowList.push({ type: 'project', project, id: `p-${project.id}` });
      for (const task of tasks) {
        rowList.push({ type: 'task', task, project, id: `t-${task.id}` });
        if (task.start_date) allDates.push(parseDate(task.start_date));
        if (task.end_date) allDates.push(parseDate(task.end_date));
      }
      for (const ms of milestones) {
        if (ms.date) allDates.push(parseDate(ms.date));
      }
    }

    if (allDates.length === 0) {
      const now = new Date();
      return { rows: rowList, globalStart: addDays(now, -30), globalEnd: addDays(now, 180) };
    }

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    return {
      rows: rowList,
      globalStart: addDays(minDate, -14),
      globalEnd: addDays(maxDate, 30),
    };
  }, [displayProjects]);

  const totalDays = daysBetween(globalStart, globalEnd);
  const basePixelsPerDay = 1 / zoomConfig.daysPerPixel;
  // Ensure chart is at least as wide as the container
  const minPixelsPerDay = containerWidth > 0 && totalDays > 0
    ? containerWidth / totalDays
    : 0;
  const pixelsPerDay = Math.max(basePixelsPerDay, minPixelsPerDay);
  const chartWidth = Math.max(totalDays * pixelsPerDay, containerWidth);
  const chartHeight = HEADER_HEIGHT + rows.length * ROW_HEIGHT;

  function dateToX(date) {
    return daysBetween(globalStart, date) * pixelsPerDay;
  }

  function xToDate(x) {
    const days = Math.round(x / pixelsPerDay);
    return addDays(globalStart, days);
  }

  // Generate grid lines based on zoom level
  const gridLines = useMemo(() => {
    const lines = [];
    const labels = [];
    const d = new Date(globalStart);

    if (zoom === 'month') {
      d.setDate(1);
      if (d < globalStart) d.setMonth(d.getMonth() + 1);

      while (d <= globalEnd) {
        const x = dateToX(d);
        lines.push(
          <line key={`gl-${d.getTime()}`} x1={x} y1={0} x2={x} y2={chartHeight}
            stroke="var(--gantt-grid-line)" strokeWidth="1" />
        );
        const isJan = d.getMonth() === 0;
        const monthLabel = isJan
          ? `Jan '${d.getFullYear().toString().slice(-2)}`
          : d.toLocaleString('en', { month: 'short' });
        labels.push(
          <text key={`glt-${d.getTime()}`} x={x + 4} y={16}
            fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-primary)">
            {monthLabel}
          </text>
        );
        d.setMonth(d.getMonth() + 1);
      }
    } else if (zoom === 'quarter') {
      // Align to start of current quarter (month 0, 3, 6, 9)
      const qMonth = Math.floor(d.getMonth() / 3) * 3;
      d.setMonth(qMonth);
      d.setDate(1);
      if (d < globalStart) d.setMonth(d.getMonth() + 3);

      while (d <= globalEnd) {
        const x = dateToX(d);
        lines.push(
          <line key={`gl-${d.getTime()}`} x1={x} y1={0} x2={x} y2={chartHeight}
            stroke="var(--gantt-grid-line)" strokeWidth="1.5" />
        );
        const qNum = Math.floor(d.getMonth() / 3) + 1;
        const yearLabel = d.getFullYear().toString().slice(-2);
        labels.push(
          <text key={`glt-${d.getTime()}`} x={x + 4} y={16}
            fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-primary)" fontWeight="500">
            {`Q${qNum} '${yearLabel}`}
          </text>
        );
        d.setMonth(d.getMonth() + 3);
      }
    } else if (zoom === 'year') {
      d.setMonth(0);
      d.setDate(1);
      if (d < globalStart) d.setFullYear(d.getFullYear() + 1);

      while (d <= globalEnd) {
        const x = dateToX(d);
        lines.push(
          <line key={`gl-${d.getTime()}`} x1={x} y1={0} x2={x} y2={chartHeight}
            stroke="var(--gantt-grid-line)" strokeWidth="2" />
        );
        labels.push(
          <text key={`glt-${d.getTime()}`} x={x + 4} y={16}
            fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-primary)" fontWeight="600">
            {d.getFullYear()}
          </text>
        );
        d.setFullYear(d.getFullYear() + 1);
      }
    }
    return { lines, labels };
  }, [globalStart, globalEnd, chartHeight, pixelsPerDay, zoom]);

  // Today line
  const todayX = dateToX(new Date());

  // Scroll to center "Today" line on mount or zoom change (only if not time traveling/dragging Today line)
  useEffect(() => {
    if (chartAreaRef.current && todayX > 0 && containerWidth > 0 && draggedTodayX === null) {
      const container = chartAreaRef.current;
      const targetScroll = todayX - container.clientWidth / 2;
      container.scrollLeft = Math.max(0, targetScroll);
    }
  }, [zoom, todayX, containerWidth, draggedTodayX]);

  const exitTimeTravel = useCallback(() => {
    setIsTimeTraveling(false);
    setActiveSnapshot(null);
    setDraggedTodayX(null);
    setTravelDateLabel('');
  }, []);

  const handleTodayDragStart = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    setIsTimeTraveling(true);

    const handleMove = (ev) => {
      const currentX = (ev.clientX - ctm.e) / ctm.a;
      const clampedX = Math.max(0, Math.min(currentX, todayX));
      setDraggedTodayX(clampedX);

      // Convert position to date
      const draggedDate = xToDate(clampedX);
      setTravelDateLabel(draggedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));

      // Find closest snapshot
      if (snapshots.length > 0) {
        let closest = snapshots[0];
        let minDiff = Math.abs(new Date(snapshots[0].timestamp) - draggedDate);

        for (const snap of snapshots) {
          const diff = Math.abs(new Date(snap.timestamp) - draggedDate);
          if (diff < minDiff) {
            minDiff = diff;
            closest = snap;
          }
        }
        setActiveSnapshot(closest);
      }
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [totalDays, pixelsPerDay, xToDate, snapshots, todayX]);

  // Drag handlers
  const handlePointerDown = useCallback((e, task, project, dragType) => {
    e.stopPropagation();
    e.preventDefault();
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    const startX = (e.clientX - ctm.e) / ctm.a;

    setDragState({
      taskId: task.id,
      projectId: project.id,
      dragType,
      startX,
      origStart: task.start_date,
      origEnd: task.end_date,
      currentStart: task.start_date,
      currentEnd: task.end_date,
    });

    const handleMove = (ev) => {
      const currentX = (ev.clientX - ctm.e) / ctm.a;
      const dx = currentX - startX;
      const daysDelta = Math.round(dx / pixelsPerDay);

      setDragState((prev) => {
        if (!prev) return null;
        let newStart = prev.origStart;
        let newEnd = prev.origEnd;

        if (prev.dragType === 'move') {
          newStart = formatDate(addDays(parseDate(prev.origStart), daysDelta));
          newEnd = formatDate(addDays(parseDate(prev.origEnd), daysDelta));
        } else if (prev.dragType === 'start') {
          newStart = formatDate(addDays(parseDate(prev.origStart), daysDelta));
        } else if (prev.dragType === 'end') {
          newEnd = formatDate(addDays(parseDate(prev.origEnd), daysDelta));
        }

        return { ...prev, currentStart: newStart, currentEnd: newEnd };
      });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setDragState((prev) => {
        if (prev && (prev.currentStart !== prev.origStart || prev.currentEnd !== prev.origEnd)) {
          updateTask(prev.taskId, {
            start_date: prev.currentStart,
            end_date: prev.currentEnd,
          }, prev.projectId);
        }
        return null;
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [pixelsPerDay, updateTask]);

  const handleResizerPointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = labelWidth;

    const handlePointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(120, Math.min(startWidth + deltaX, 450));
      setLabelWidth(newWidth);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [labelWidth]);

  // Tooltip text
  const tooltipText = dragState
    ? `${dragState.currentStart} → ${dragState.currentEnd}`
    : '';

  const currentTodayX = draggedTodayX !== null ? draggedTodayX : todayX;

  return (
    <div className="gantt-container animate-fade-in">
      <div className="gantt-toolbar">
        <div className="gantt-zoom-controls">
          {Object.entries(ZOOM_LEVELS).map(([key, val]) => (
            <button
              key={key}
              className={`gantt-zoom-btn ${zoom === key ? 'active' : ''}`}
              onClick={() => setZoom(key)}
            >
              {val.label}
            </button>
          ))}
        </div>
        {dragState && (
          <div className="gantt-drag-tooltip">{tooltipText}</div>
        )}
      </div>

      {isTimeTraveling && (
        <div className="time-travel-banner glass-panel">
          <div className="time-travel-info">
            <span className="time-travel-badge">🕰️ TIME TRAVEL</span>
            <span className="time-travel-msg">
              Showing: <strong>{activeSnapshot?.label || 'Previous Schedule State'}</strong> ({travelDateLabel})
            </span>
          </div>
          <button className="time-travel-exit" onClick={exitTimeTravel}>
            Return to Live
          </button>
        </div>
      )}

      <div className="gantt-scroll-wrapper" ref={containerRef}>
        <div className="gantt-labels" style={{ width: `${labelWidth}px`, position: 'relative' }}>
          <div className="gantt-label-header">Project / Task</div>
          {rows.map((row) => {
            const isSelected = row.type === 'task' && row.task.id === selectedTaskId;
            return (
              <div
                key={row.id}
                className={`gantt-label-row ${
                  row.type === 'project' 
                    ? 'gantt-label-project' 
                    : `gantt-label-task ${isSelected ? 'gantt-row-selected' : ''}`
                }`}
                onClick={() => {
                  if (row.type === 'project') {
                    if (row.project) setSelectedProject(row.project);
                  } else {
                    setSelectedTaskId(selectedTaskId === row.task.id ? null : row.task.id);
                  }
                }}
              >
                {row.type === 'project' ? row.project.name : row.task.title}
              </div>
            );
          })}
          {/* Resize handle */}
          <div
            className="gantt-label-resizer"
            onPointerDown={handleResizerPointerDown}
          />
        </div>
        <div className="gantt-chart-area" ref={chartAreaRef} style={{ overflowX: 'auto' }}>
          <svg
            ref={svgRef}
            width={chartWidth}
            height={chartHeight}
            style={{ display: 'block', minWidth: chartWidth }}
          >
            {/* Background */}
            <rect width={chartWidth} height={chartHeight} fill="var(--bg-primary)" />

            {/* Grid */}
            {gridLines.lines}

            {/* Header area */}
            <rect width={chartWidth} height={HEADER_HEIGHT} fill="var(--bg-secondary)" opacity="0.5" />
            {gridLines.labels}

            {/* Row stripes */}
            {rows.map((row, i) => {
              const isSelected = row.type === 'task' && row.task.id === selectedTaskId;
              return (
                <rect
                  key={`stripe-${row.id}`}
                  x={0}
                  y={HEADER_HEIGHT + i * ROW_HEIGHT}
                  width={chartWidth}
                  height={ROW_HEIGHT}
                  fill={isSelected ? 'var(--cyan-glow)' : (row.type === 'project' ? 'var(--gantt-stripe)' : 'transparent')}
                />
              );
            })}

            {/* Row separator — faint dashed horizontal line at the bottom of each row */}
            {rows.map((row, i) => (
              <line
                key={`sep-${row.id}`}
                x1={0}
                y1={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
                x2={chartWidth}
                y2={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
                stroke="var(--text-muted)"
                strokeWidth="1"
                strokeDasharray="3 8"
                opacity="0.25"
              />
            ))}

            {/* Today line (always visible) */}
            {currentTodayX > 0 && currentTodayX < chartWidth && (
              <g
                style={{ cursor: isSharedView ? 'default' : 'ew-resize' }}
                onPointerDown={isSharedView ? null : handleTodayDragStart}
              >
                {/* Grab zone (only when not shared) */}
                {!isSharedView && <rect x={currentTodayX - 12} y={0} width={24} height={chartHeight} fill="transparent" />}
                <line x1={currentTodayX} y1={0} x2={currentTodayX} y2={chartHeight}
                  stroke={isTimeTraveling ? "var(--cyan)" : "rgb(5, 150, 105)"}
                  strokeWidth={isTimeTraveling ? 2 : 1.5}
                  strokeDasharray="6 3" opacity="0.9" />
                
                {/* Glowing handle knob — hidden in shared view */}
                {!isSharedView && (
                  <circle cx={currentTodayX} cy={HEADER_HEIGHT - 12} r={7}
                    fill={isTimeTraveling ? "var(--cyan)" : "rgb(5, 150, 105)"}
                    stroke="white" strokeWidth="1.5"
                    style={{ filter: `drop-shadow(0px 0px 4px ${isTimeTraveling ? 'rgba(6, 182, 212, 0.6)' : 'rgba(5, 150, 105, 0.6)'})` }}
                  />
                )}
                
                <text x={currentTodayX + 10} y={HEADER_HEIGHT - 9}
                  fill={isTimeTraveling ? "var(--cyan)" : "rgb(5, 150, 105)"}
                  fontSize="10" fontWeight="600" fontFamily="var(--font-primary)">
                  {isTimeTraveling ? travelDateLabel : 'Today'}
                </text>
              </g>
            )}

            {/* Task bars and milestone diamonds */}
            {rows.map((row, i) => {
              const y = HEADER_HEIGHT + i * ROW_HEIGHT;

              if (row.type === 'project') {
                // Render milestone diamonds on project row
                const milestones = row.project.milestones || [];
                return milestones.map((ms) => {
                  if (!ms.date) return null;
                  const mx = dateToX(parseDate(ms.date));
                  const my = y + ROW_HEIGHT / 2;
                  const msColor = ms.status === 'completed' ? 'var(--emerald)'
                    : ms.status === 'in-progress' ? 'var(--cyan)' : 'var(--text-muted)';
                  return (
                    <g
                      key={`ms-${ms.id}`}
                      onMouseEnter={() => setHoveredMilestone({ title: ms.title, date: ms.date, x: mx, y: my })}
                      onMouseLeave={() => setHoveredMilestone(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      <polygon
                        points={`${mx},${my - 8} ${mx + 8},${my} ${mx},${my + 8} ${mx - 8},${my}`}
                        fill={msColor}
                        opacity="0.85"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="1"
                      />
                    </g>
                  );
                });
              }

              // Task bar
              const task = row.task;
              if (!task.start_date || !task.end_date) return null;

              const isDragging = dragState?.taskId === task.id;
              const startDate = isDragging ? dragState.currentStart : task.start_date;
              const endDate = isDragging ? dragState.currentEnd : task.end_date;

              const barX = dateToX(parseDate(startDate));
              const barWidth = Math.max(dateToX(parseDate(endDate)) - barX, 4);
              const barY = y + 8;
              const barH = ROW_HEIGHT - 16;
              const colors = STATUS_COLORS[task.status] || STATUS_COLORS.pending;
              const isPending = task.status === 'pending';

              return (
                <g key={`task-${task.id}`} style={{ cursor: isTimeTraveling ? 'default' : 'grab' }}>
                  {/* Main bar */}
                  <rect
                    x={barX} y={barY} width={barWidth} height={barH}
                    rx={4} ry={4}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={isPending ? 1.5 : 0}
                    strokeDasharray={isPending ? '4 2' : 'none'}
                    opacity={isDragging ? 0.7 : 0.85}
                    onPointerDown={isTimeTraveling ? null : (e) => handlePointerDown(e, task, row.project, 'move')}
                  />
                  {!isTimeTraveling && (
                    <>
                      {/* Left resize handle */}
                      <rect
                        x={barX - 2} y={barY} width={6} height={barH}
                        fill="transparent" style={{ cursor: 'ew-resize' }}
                        onPointerDown={(e) => handlePointerDown(e, task, row.project, 'start')}
                      />
                      {/* Right resize handle */}
                      <rect
                        x={barX + barWidth - 4} y={barY} width={6} height={barH}
                        fill="transparent" style={{ cursor: 'ew-resize' }}
                        onPointerDown={(e) => handlePointerDown(e, task, row.project, 'end')}
                      />
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {hoveredMilestone && (
            <div
              className="gantt-milestone-tooltip glass-panel animate-scale-in"
              style={{
                position: 'absolute',
                left: hoveredMilestone.x,
                top: hoveredMilestone.y - 48,
                transform: 'translateX(-50%)',
                padding: '6px 12px',
                fontSize: '0.8rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--shadow-md)',
                pointerEvents: 'none',
                zIndex: 500,
                whiteSpace: 'nowrap',
                color: 'var(--text-primary)',
              }}
            >
              <strong>{hoveredMilestone.title}</strong>
              {hoveredMilestone.date && (
                <span style={{ opacity: 0.7, marginLeft: 6 }}>
                  ({hoveredMilestone.date})
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
