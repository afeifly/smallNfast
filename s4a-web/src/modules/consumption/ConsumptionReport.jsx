import React from 'react';
import * as d3 from 'd3';
import TestAPI from '../../api/TestAPI';
import { runReport } from './ConsumptionEngine';
import './ConsumptionReport.css';

// Sleek modern icons in SVG format
const Icons = {
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
  Pdf: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  ),
  Energy: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  ),
  Dollar: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  ),
  Chart: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  )
};

// ── Reusable sub-component to draw the D3 chart dynamically ──
function ConsumptionChart({
  page,
  activeGroup,
  allRows,
  channels,
  costPerUnit,
  currency,
  reportUnit,
  height = 320
}) {
  const svgRef = React.useRef(null);
  const tooltipRef = React.useRef(null);

  // Compute report data for this page's exact time frame and bucket interval
  const reportData = React.useMemo(() => {
    if (!activeGroup || allRows.length === 0) return null;
    return runReport(
      [activeGroup],
      allRows,
      channels,
      page.startMs,
      page.endMs,
      page.period, // hourly inside day, daily inside week/month
      costPerUnit,
      currency
    );
  }, [activeGroup, allRows, channels, page.startMs, page.endMs, page.period, costPerUnit, currency]);

  // Draw chart inside SVG container
  React.useEffect(() => {
    if (!svgRef.current || !reportData || !activeGroup) return;

    const svgEl = d3.select(svgRef.current);
    svgEl.selectAll('*').remove();

    const parent = svgRef.current.parentNode;
    const width = parent.clientWidth || 600;
    const margin = { top: 30, right: 30, bottom: 40, left: 65 };

    svgEl.attr('width', width).attr('height', height);

    const colors = ['#00ac86', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e'];

    const subKeys = activeGroup.subChannelIds.map(cid => `ch_${cid}`);
    const stack = d3.stack().keys(subKeys);

    const chartData = reportData.rows.map(r => {
      const d = { label: r.label };
      subKeys.forEach(k => {
        d[k] = r.values[k] || 0;
      });
      if (activeGroup.mainChannelId != null) {
        d[`main_${activeGroup.mainChannelId}`] = r.values[`main_${activeGroup.mainChannelId}`] || 0;
      }
      return d;
    });

    const stackedData = stack(chartData);

    const maxStacked = d3.max(chartData, d => subKeys.reduce((sum, k) => sum + d[k], 0)) || 0;
    const maxMain = activeGroup.mainChannelId != null
      ? d3.max(chartData, d => d[`main_${activeGroup.mainChannelId}`]) || 0
      : 0;
    const maxY = Math.max(maxStacked, maxMain) || 10;

    const x0 = d3.scaleBand()
      .domain(chartData.map(d => d.label))
      .range([margin.left, width - margin.right])
      .padding(0.25);

    const x1Domain = ['stack'];
    if (activeGroup.mainChannelId != null) {
      x1Domain.push('main');
    }
    const x1 = d3.scaleBand()
      .domain(x1Domain)
      .range([0, x0.bandwidth()])
      .padding(0.05);

    const y = d3.scaleLinear()
      .domain([0, maxY * 1.05])
      .range([height - margin.bottom, margin.top]);

    svgEl.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).tickSize(-width + margin.left + margin.right).tickFormat(''))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#f1f5f9'));

    const xAxis = d3.axisBottom(x0).tickFormat((d, idx) => {
      const isFirst = idx === 0;
      if (page.period === 'hourly') {
        if (isFirst) return `${page.label} ${d}`;
        return d;
      } else {
        if (page.label.includes('-W')) {
          if (isFirst) return d;
          return d.slice(5); // MM-dd
        } else {
          if (isFirst) return d;
          return d.slice(8); // dd
        }
      }
    });
    const yAxis = d3.axisLeft(y).ticks(6);

    svgEl.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(xAxis)
      .call(g => g.select('.domain').attr('stroke', '#cbd5e1'))
      .call(g => g.selectAll('.tick text').attr('fill', '#475569').attr('font-size', '10px').attr('font-weight', '600'));

    svgEl.append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(yAxis)
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick text').attr('fill', '#475569').attr('font-size', '10px').attr('font-weight', '600'));

    const gStack = svgEl.append('g')
      .selectAll('g')
      .data(stackedData)
      .join('g')
      .attr('fill', (d, i) => colors[i % colors.length]);

    gStack.selectAll('rect')
      .data(d => d)
      .join('rect')
      .attr('x', d => x0(d.data.label) + x1('stack'))
      .attr('y', d => y(d[1]))
      .attr('height', d => y(d[0]) - y(d[1]))
      .attr('width', x1.bandwidth())
      .attr('rx', 2)
      .on('mouseover', function(event, d) {
        const seriesKey = d3.select(this.parentNode).datum().key;
        const col = reportData.columns.find(c => c.key === seriesKey);
        const name = col ? col.label : seriesKey;
        const val = d[1] - d[0];
        const cost = val * costPerUnit;

        d3.select(tooltipRef.current)
          .style('opacity', 1)
          .html(`
            <div class="tooltip-title">${d.data.label}</div>
            <div class="tooltip-row"><span>Channel:</span> <span>${name}</span></div>
            <div class="tooltip-row"><span>Cons.:</span> <span>${val.toFixed(2)} ${reportUnit}</span></div>
            <div class="tooltip-row"><span>Cost:</span> <span>${currency} ${cost.toFixed(2)}</span></div>
          `);
        d3.select(this).attr('opacity', 0.85);
      })
      .on('mousemove', function(event) {
        const [mx, my] = d3.pointer(event, svgEl.node());
        d3.select(tooltipRef.current)
          .style('left', `${mx + 15}px`)
          .style('top', `${my - 25}px`);
      })
      .on('mouseleave', function() {
        d3.select(tooltipRef.current).style('opacity', 0);
        d3.select(this).attr('opacity', 1);
      });

    if (activeGroup.mainChannelId != null) {
      const mainKey = `main_${activeGroup.mainChannelId}`;
      svgEl.append('g')
        .attr('fill', '#475569')
        .selectAll('rect')
        .data(chartData)
        .join('rect')
        .attr('x', d => x0(d.label) + x1('main'))
        .attr('y', d => y(d[mainKey]))
        .attr('height', d => y(0) - y(d[mainKey]))
        .attr('width', x1.bandwidth())
        .attr('rx', 2)
        .on('mouseover', function(event, d) {
          const col = reportData.columns.find(c => c.key === mainKey);
          const name = col ? col.label : 'Main Channel';
          const val = d[mainKey];
          const cost = val * costPerUnit;

          d3.select(tooltipRef.current)
            .style('opacity', 1)
            .html(`
              <div class="tooltip-title">${d.label}</div>
              <div class="tooltip-row"><span>Main Ch:</span> <span>${name}</span></div>
              <div class="tooltip-row"><span>Cons.:</span> <span>${val.toFixed(2)} ${reportUnit}</span></div>
              <div class="tooltip-row"><span>Cost:</span> <span>${currency} ${cost.toFixed(2)}</span></div>
            `);
          d3.select(this).attr('opacity', 0.85);
        })
        .on('mousemove', function(event) {
          const [mx, my] = d3.pointer(event, svgEl.node());
          d3.select(tooltipRef.current)
            .style('left', `${mx + 15}px`)
            .style('top', `${my - 25}px`);
        })
        .on('mouseleave', function() {
          d3.select(tooltipRef.current).style('opacity', 0);
          d3.select(this).attr('opacity', 1);
        });
    }
  }, [reportData, activeGroup, costPerUnit, currency, reportUnit, height]);

  return (
    <div className="chart-container-div" style={{ minHeight: `${height}px` }}>
      <svg ref={svgRef} className="d3-chart-svg" style={{ height: `${height}px` }}></svg>
      <div ref={tooltipRef} className="d3-tooltip" style={{ opacity: 0 }}></div>
    </div>
  );
}

// ── Main Consumption Report Component ──
export default function ConsumptionReport() {
  const [loading, setLoading] = React.useState(true);
  const [progress, setProgress] = React.useState(0);
  const [channels, setChannels] = React.useState([]);
  const [allRows, setAllRows] = React.useState([]);

  // Date Range and Period bucket size
  const [startDateStr, setStartDateStr] = React.useState('');
  const [endDateStr, setEndDateStr] = React.useState('');
  const [period, setPeriod] = React.useState('monthly'); // 'daily' (hourly points per day), 'weekly' (daily points per week), 'monthly' (daily points per month)
  const [costPerUnit, setCostPerUnit] = React.useState(0.1);
  const [currency, setCurrency] = React.useState('$');

  // Groups state
  const [groups, setGroups] = React.useState([]);
  const [activeGroupId, setActiveGroupId] = React.useState(null);

  // Group config cards state
  const [groupSidebarTab, setGroupSidebarTab] = React.useState({});

  // Active page index for screen pagination (only controls the active chart page)
  const [activePageIndex, setActivePageIndex] = React.useState(0);

  // Fetch initial channels & time-series rows
  React.useEffect(() => {
    TestAPI.getChannels(chanRes => {
      const chs = chanRes.logging_chs || [];
      setChannels(chs);

      if (TestAPI.getConsumptionData) {
        setLoading(true);
        TestAPI.getConsumptionData(p => {
          setProgress(p);
        }).then(rows => {
          setAllRows(rows);
          
          if (rows.length > 0) {
            const startMs = rows[0].timestampMs;
            const stopMs = rows[rows.length - 1].timestampMs;
            
            const formatDate = (ms) => {
              const d = new Date(ms);
              const pad = n => String(n).padStart(2, '0');
              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            };
            setStartDateStr(formatDate(startMs));
            setEndDateStr(formatDate(stopMs));
          }
          
          // Auto-detect groups ("Try Defined First")
          const initialGroups = [];
          const m3Chans = chs.filter(c => {
            const unit = (c.unit_in_ascii || '').toLowerCase();
            const desc = (c.logic_channel_description || '').toLowerCase();
            return unit.includes('m³') || unit.includes('m3') || desc.includes('consumption') || desc.includes('flow');
          });
          const gjChans = chs.filter(c => {
            const unit = (c.unit_in_ascii || '').toLowerCase();
            return unit.includes('gj') || unit.includes('wh') || unit.includes('cal');
          });

          if (m3Chans.length > 0) {
            initialGroups.push({
              id: 'group_water',
              name: 'Flow & Water Group',
              subChannelIds: m3Chans.map(c => c.channel_id),
              mainChannelId: null,
              needsSum: true
            });
          }
          if (gjChans.length > 0) {
            initialGroups.push({
              id: 'group_energy',
              name: 'Energy Group',
              subChannelIds: gjChans.map(c => c.channel_id),
              mainChannelId: null,
              needsSum: true
            });
          }

          if (initialGroups.length === 0 && chs.length > 0) {
            initialGroups.push({
              id: 'group_general',
              name: 'Consumption Group 1',
              subChannelIds: chs.slice(0, Math.min(chs.length, 3)).map(c => c.channel_id),
              mainChannelId: null,
              needsSum: true
            });
          }

          setGroups(initialGroups);
          if (initialGroups.length > 0) {
            setActiveGroupId(initialGroups[0].id);
          }

          setLoading(false);
        }).catch(err => {
          console.error('[ConsumptionReport] error loading data rows:', err);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, []);

  // Reset active page index when period or dates change
  React.useEffect(() => {
    setActivePageIndex(0);
  }, [period, startDateStr, endDateStr]);

  // Compute active variables
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const startMs = startDateStr ? new Date(startDateStr).getTime() : 0;
  const endMs = endDateStr ? new Date(endDateStr).getTime() + 86400000 - 1 : 0;

  // 1. Generate segmented pages (each page handles its own date range + bucket period)
  const pages = React.useMemo(() => {
    if (!startMs || !endMs) return [];
    
    const pageList = [];
    const cursor = new Date(startMs);
    cursor.setHours(0,0,0,0);

    if (period === 'daily') {
      // Daily Report: Each day is a page with 24 Hourly buckets.
      while (cursor.getTime() < endMs) {
        const pageStart = cursor.getTime();
        const next = new Date(cursor);
        next.setDate(next.getDate() + 1);
        const pageEnd = Math.min(next.getTime(), endMs);

        const pad = n => String(n).padStart(2, '0');
        const label = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;

        pageList.push({
          label,
          startMs: pageStart,
          endMs: pageEnd,
          period: 'hourly'
        });
        cursor.setTime(next.getTime());
      }
    } else if (period === 'weekly') {
      // Weekly Report: Each week (Monday-Sunday) is a page with 7 Daily buckets.
      const day = cursor.getDay();
      const diff = cursor.getDate() - day + (day === 0 ? -6 : 1);
      cursor.setDate(diff);

      while (cursor.getTime() < endMs) {
        const pageStart = cursor.getTime();
        const next = new Date(cursor);
        next.setDate(next.getDate() + 7);
        const pageEnd = Math.min(next.getTime(), endMs);

        const pad = n => String(n).padStart(2, '0');
        const tmp = new Date(cursor);
        tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
        const yearStart = new Date(tmp.getFullYear(), 0, 1);
        const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
        const label = `${tmp.getFullYear()}-W${pad(weekNo)}`;

        pageList.push({
          label,
          startMs: pageStart,
          endMs: pageEnd,
          period: 'daily'
        });
        cursor.setTime(next.getTime());
      }
    } else if (period === 'monthly') {
      // Monthly Report: Each month is a page with up to 31 Daily buckets.
      cursor.setDate(1);

      while (cursor.getTime() < endMs) {
        const pageStart = cursor.getTime();
        const next = new Date(cursor);
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        const pageEnd = Math.min(next.getTime(), endMs);

        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const label = `${months[cursor.getMonth()]} ${cursor.getFullYear()}`;

        pageList.push({
          label,
          startMs: pageStart,
          endMs: pageEnd,
          period: 'daily'
        });
        cursor.setTime(next.getTime());
      }
    }

    return pageList;
  }, [startMs, endMs, period]);

  // 2. Compute COMPLETE continuous report data for the full table (no page splits)
  const fullReportData = React.useMemo(() => {
    if (!activeGroup || allRows.length === 0 || !startMs || !endMs) return null;
    
    // The table bucket period matches the inner page buckets!
    const tableBucketPeriod = period === 'daily' ? 'hourly' : 'daily';
    
    return runReport(
      [activeGroup],
      allRows,
      channels,
      startMs,
      endMs,
      tableBucketPeriod,
      costPerUnit,
      currency
    );
  }, [activeGroup, allRows, channels, startMs, endMs, period, costPerUnit, currency]);

  // Overall metadata
  let reportUnit = '';
  if (fullReportData && activeGroup) {
    const mainColKey = activeGroup.needsSum && activeGroup.subChannelIds.length > 1
      ? `sum_${activeGroup.id}`
      : activeGroup.subChannelIds.length > 0
        ? `ch_${activeGroup.subChannelIds[0]}`
        : null;

    if (mainColKey) {
      const col = fullReportData.columns.find(c => c.key === mainColKey);
      reportUnit = col ? col.unit : '';
    }
  }

  // Active page variables
  const activePage = pages[activePageIndex];

  // Sidebar actions
  const handleAddGroup = () => {
    const newId = `group_${Date.now()}`;
    const newGroup = {
      id: newId,
      name: `New Group ${groups.length + 1}`,
      subChannelIds: [],
      mainChannelId: null,
      needsSum: true
    };
    setGroups([...groups, newGroup]);
    setActiveGroupId(newId);
  };

  const handleDeleteGroup = (id, e) => {
    e.stopPropagation();
    const filtered = groups.filter(g => g.id !== id);
    setGroups(filtered);
    if (activeGroupId === id) {
      setActiveGroupId(filtered.length > 0 ? filtered[0].id : null);
    }
  };

  const handleGroupFieldChange = (groupId, field, value) => {
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        return { ...g, [field]: value };
      }
      return g;
    }));
  };

  const toggleSubChannelSelection = (groupId, chanId) => {
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        const exists = g.subChannelIds.includes(chanId);
        const subChannelIds = exists
          ? g.subChannelIds.filter(id => id !== chanId)
          : [...g.subChannelIds, chanId];
        return { ...g, subChannelIds };
      }
      return g;
    }));
  };

  const handlePresetSelect = (preset) => {
    if (allRows.length === 0) return;
    const startMs = allRows[0].timestampMs;
    const stopMs = allRows[allRows.length - 1].timestampMs;
    const stopDate = new Date(stopMs);

    const pad = n => String(n).padStart(2, '0');
    const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'month') {
      const firstOfMonth = new Date(stopDate.getFullYear(), stopDate.getMonth(), 1);
      setStartDateStr(formatDate(firstOfMonth));
      setEndDateStr(formatDate(stopDate));
    } else if (preset === 'year') {
      const firstOfYear = new Date(stopDate.getFullYear(), 0, 1);
      setStartDateStr(formatDate(firstOfYear));
      setEndDateStr(formatDate(stopDate));
    } else if (preset === 'all') {
      setStartDateStr(formatDate(new Date(startMs)));
      setEndDateStr(formatDate(new Date(stopMs)));
    }
  };

  if (loading) {
    return (
      <div className="empty-state-container" style={{ height: '80vh' }}>
        <div className="empty-state-title">Analyzing & Compiling Consumption Data...</div>
        <div className="empty-state-desc" style={{ width: '300px' }}>
          <div style={{ width: '100%', height: '8px', background: '#cbd5e1', borderRadius: '4px', overflow: 'hidden', marginTop: '12px' }}>
            <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: '#00ac86', transition: 'width 0.1s ease' }}></div>
          </div>
          <div style={{ fontSize: '11px', marginTop: '6px', color: '#64748b' }}>{(progress * 100).toFixed(0)}% loaded</div>
        </div>
      </div>
    );
  }

  return (
    <div className="consumption-report-container">
      
      {/* ── Left Sidebar Configuration (Screen Only) ── */}
      <div className="consumption-sidebar screen-only">
        
        {/* Report Settings */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Report Settings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="sidebar-input-group">
              <span className="sidebar-label">Start Date</span>
              <input
                type="date"
                className="sidebar-input"
                value={startDateStr}
                onChange={e => setStartDateStr(e.target.value)}
              />
            </div>
            
            <div className="sidebar-input-group">
              <span className="sidebar-label">End Date</span>
              <input
                type="date"
                className="sidebar-input"
                value={endDateStr}
                onChange={e => setEndDateStr(e.target.value)}
              />
            </div>

            {/* Presets */}
            <div className="sidebar-actions" style={{ marginBottom: 0 }}>
              <button className="sidebar-btn" onClick={() => handlePresetSelect('month')}>MTD</button>
              <button className="sidebar-btn" onClick={() => handlePresetSelect('year')}>YTD</button>
              <button className="sidebar-btn" onClick={() => handlePresetSelect('all')}>All Time</button>
            </div>

            <div className="sidebar-input-group">
              <span className="sidebar-label">Report Period Type</span>
              <select
                className="sidebar-select"
                value={period}
                onChange={e => setPeriod(e.target.value)}
              >
                <option value="daily">Daily Report (Hourly points)</option>
                <option value="weekly">Weekly Report (7 day points)</option>
                <option value="monthly">Monthly Report (Max 31 day points)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Pricing / Cost Card */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Cost Calculator</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="sidebar-input-group" style={{ flex: 1.2 }}>
              <span className="sidebar-label">Price / Unit</span>
              <input
                type="number"
                step="0.01"
                className="sidebar-input"
                value={costPerUnit}
                onChange={e => setCostPerUnit(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="sidebar-input-group" style={{ flex: 0.8 }}>
              <span className="sidebar-label">Currency</span>
              <input
                type="text"
                className="sidebar-input"
                placeholder="$"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Channel Groups Configurator */}
        <div className="sidebar-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="sidebar-section-title">Channel Groups</div>
          <div className="channels-list-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
            {groups.length === 0 ? (
              <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
                No active groups. Add one below.
              </div>
            ) : (
              <div className="groups-list">
                {groups.map(g => {
                  const isActive = g.id === activeGroupId;
                  const currentTab = groupSidebarTab[g.id] || 'sub';

                  return (
                    <div
                      key={g.id}
                      className={`group-item-card ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveGroupId(g.id)}
                    >
                      <div className="group-card-header">
                        <input
                          type="text"
                          className="group-name-input"
                          value={g.name}
                          onChange={e => handleGroupFieldChange(g.id, 'name', e.target.value)}
                          onClick={e => e.stopPropagation()}
                        />
                        <button
                          className="group-delete-btn"
                          onClick={(e) => handleDeleteGroup(g.id, e)}
                        >
                          <Icons.Trash />
                        </button>
                      </div>

                      <div className="group-tabs" onClick={e => e.stopPropagation()}>
                        <button
                          className={`group-tab-btn ${currentTab === 'sub' ? 'active' : ''}`}
                          onClick={() => setGroupSidebarTab({ ...groupSidebarTab, [g.id]: 'sub' })}
                        >
                          Sub-branches (${g.subChannelIds.length})
                        </button>
                        <button
                          className={`group-tab-btn ${currentTab === 'main' ? 'active' : ''}`}
                          onClick={() => setGroupSidebarTab({ ...groupSidebarTab, [g.id]: 'main' })}
                        >
                          Main Channel
                        </button>
                      </div>

                      <div className="group-selector-scroll" onClick={e => e.stopPropagation()}>
                        {currentTab === 'sub' ? (
                          channels.map(ch => {
                            const isSel = g.subChannelIds.includes(ch.channel_id);
                            return (
                              <label key={ch.channel_id} className="channel-selector-row">
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={() => toggleSubChannelSelection(g.id, ch.channel_id)}
                                  style={{ margin: 0 }}
                                />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ch.logic_channel_description || `Ch${ch.channel_id}`}
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <>
                            <label className="channel-selector-row">
                              <input
                                type="radio"
                                name={`main_${g.id}`}
                                checked={g.mainChannelId === null}
                                onChange={() => handleGroupFieldChange(g.id, 'mainChannelId', null)}
                                style={{ margin: 0 }}
                              />
                              <span style={{ fontStyle: 'italic', color: '#64748b' }}>None</span>
                            </label>
                            {channels.map(ch => (
                              <label key={ch.channel_id} className="channel-selector-row">
                                <input
                                  type="radio"
                                  name={`main_${g.id}`}
                                  checked={g.mainChannelId === ch.channel_id}
                                  onChange={() => handleGroupFieldChange(g.id, 'mainChannelId', ch.channel_id)}
                                  style={{ margin: 0 }}
                                />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ch.logic_channel_description || `Ch${ch.channel_id}`}
                                </span>
                              </label>
                            ))}
                          </>
                        )}
                      </div>

                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          id={`sum_toggle_${g.id}`}
                          checked={g.needsSum}
                          onChange={e => handleGroupFieldChange(g.id, 'needsSum', e.target.checked)}
                          style={{ margin: 0 }}
                        />
                        <label htmlFor={`sum_toggle_${g.id}`} style={{ cursor: 'pointer', fontWeight: 600 }}>
                          Include Group Sub-total Sum
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <button className="sidebar-add-group-btn" onClick={handleAddGroup}>
              <Icons.Plus /> Add Channel Group
            </button>
          </div>
        </div>

      </div>

      {/* ── Right Main Analysis View ── */}
      <div className="consumption-main-content">
        
        {/* ── SCREEN VIEW (Interactive single-chart view + full table) ── */}
        <div className="screen-only" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="report-header">
            <div className="report-title-section">
              <h1 className="report-main-title">Energy & Consumption Report</h1>
              {activeGroup ? (
                <p className="report-subtitle">
                  Analyzing Group <strong>{activeGroup.name}</strong> over {period === 'daily' ? 'Daily (Hourly points)' : period === 'weekly' ? 'Weekly (7 day points)' : 'Monthly (31 day points)'} intervals.
                </p>
              ) : (
                <p className="report-subtitle">Please select or configure a channel group on the left side.</p>
              )}
            </div>

            {activeGroup && pages.length > 0 && (
              <button className="export-pdf-btn" onClick={() => window.print()}>
                <Icons.Pdf /> Print / Export PDF
              </button>
            )}
          </div>

          {!activeGroup ? (
            <div className="empty-state-container">
              <Icons.Chart />
              <div className="empty-state-title">No Group Configured</div>
              <div className="empty-state-desc">
                Please click <strong>"Add Channel Group"</strong> in the sidebar configurator and select some sub-channels to visualize your consumption stats.
              </div>
            </div>
          ) : pages.length === 0 ? (
            <div className="empty-state-container">
              <Icons.Chart />
              <div className="empty-state-title">No Data in Selected Scope</div>
              <div className="empty-state-desc">
                Please expand your date filters or choose a date range containing valid logging time points.
              </div>
            </div>
          ) : (
            <>
              {/* Active Chart Header & Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                  Active Chart: {activePage.label}
                </span>

                {/* Page Navigation only for the chart */}
                <div className="pagination-controls" style={{ padding: '2px 8px', border: 'none', boxShadow: 'none', background: 'transparent' }}>
                  <button
                    className="pagination-btn"
                    disabled={activePageIndex === 0}
                    onClick={() => setActivePageIndex(activePageIndex - 1)}
                  >
                    <Icons.ChevronLeft /> Prev
                  </button>
                  <span className="pagination-text" style={{ fontSize: '11px' }}>
                    Page {activePageIndex + 1} of {pages.length}
                  </span>
                  <button
                    className="pagination-btn"
                    disabled={activePageIndex === pages.length - 1}
                    onClick={() => setActivePageIndex(activePageIndex + 1)}
                  >
                    Next <Icons.ChevronRight />
                  </button>
                </div>
              </div>

              {/* Profile Chart Card */}
              <div className="chart-card">
                <h2 className="card-title">Consumption Profile Chart</h2>
                <ConsumptionChart
                  page={activePage}
                  activeGroup={activeGroup}
                  allRows={allRows}
                  channels={channels}
                  costPerUnit={costPerUnit}
                  currency={currency}
                  reportUnit={reportUnit}
                  height={340} // Spaced out for beautiful dashboard render
                />
              </div>

              {/* Data Table Card (lists all data continuously) */}
              {fullReportData && (
                <div className="table-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="card-title">Full Period Consumption Data Table</h2>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Continuous list of all intervals in report range</span>
                  </div>

                  <div className="report-table-wrapper">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Interval</th>
                          {fullReportData.columns.map(col => (
                            <th key={col.key}>
                              {col.label} {col.unit ? `(${col.unit})` : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fullReportData.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            <td><strong>{row.label}</strong></td>
                            {fullReportData.columns.map(col => {
                              const val = row.values[col.key];
                              return (
                                <td key={col.key}>
                                  {val !== null && val !== undefined
                                    ? val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 3 })
                                    : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                        {/* Footer Total */}
                        <tr className="footer-total-row">
                          <td>Total Sum</td>
                          {fullReportData.columns.map(col => {
                            const val = fullReportData.totals[col.key];
                            return (
                              <td key={col.key}>
                                {val !== null && val !== undefined
                                  ? val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
                                  : '-'}
                              </td>
                            );
                          })}
                        </tr>

                        <tr className="footer-avg-row">
                          <td>Avg. Rate / Hour</td>
                          {fullReportData.columns.map(col => {
                            const val = fullReportData.averages[col.key];
                            return (
                              <td key={col.key}>
                                {val !== null && val !== undefined
                                  ? `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${col.unit ? `${col.unit}/h` : ''}`
                                  : '-'}
                              </td>
                            );
                          })}
                        </tr>

                        <tr className="footer-cost-row">
                          <td>Est. Cost ({currency})</td>
                          {fullReportData.columns.map(col => {
                            const val = fullReportData.costs[col.key];
                            return (
                              <td key={col.key}>
                                {val !== null && val !== undefined
                                  ? `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── PRINT VIEW (sequential list of all charts one-by-one + full table, NO empty page, full size charts) ── */}
        {activeGroup && pages.length > 0 && fullReportData && (
          <div className="print-only" style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
            
            {/* Title Header Card */}
            <div style={{ borderBottom: '2px solid #00ac86', paddingBottom: '12px', marginBottom: '15px', textAlign: 'center' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Energy & Consumption Report</h1>
              <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                Group: {activeGroup.name} | Period: {period.toUpperCase()} | Range: {new Date(startMs).toLocaleDateString()} to {new Date(endMs - 1).toLocaleDateString()}
              </p>
            </div>

            {/* List all charts one-by-one sequentially - Maximized and spaced out */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {pages.map((p, idx) => (
                <div key={p.label} className="chart-card" style={{ pageBreakInside: 'avoid', padding: '16px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a', fontWeight: '800' }}>
                    Consumption Profile Chart - {p.label}
                  </h3>
                  <ConsumptionChart
                    page={p}
                    activeGroup={activeGroup}
                    allRows={allRows}
                    channels={channels}
                    costPerUnit={costPerUnit}
                    currency={currency}
                    reportUnit={reportUnit}
                    height={380} // Beautiful full size chart in the PDF!
                  />
                </div>
              ))}
            </div>

            {/* The single continuous data table */}
            <div className="table-card" style={{ pageBreakInside: 'avoid', marginTop: '10px' }}>
              <h2 className="card-title">Full Period Periodic Consumption Table Data</h2>
              <div className="report-table-wrapper" style={{ overflowX: 'visible' }}>
                <table className="report-table" style={{ width: '100%', tableLayout: 'auto' }}>
                  <thead>
                    <tr>
                      <th>Interval</th>
                      {fullReportData.columns.map(col => (
                        <th key={col.key}>
                          {col.label} {col.unit ? `(${col.unit})` : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fullReportData.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td><strong>{row.label}</strong></td>
                        {fullReportData.columns.map(col => {
                          const val = row.values[col.key];
                          return (
                            <td key={col.key}>
                              {val !== null && val !== undefined
                                ? val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 3 })
                                : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Footer Total */}
                    <tr className="footer-total-row">
                      <td>Total Sum</td>
                      {fullReportData.columns.map(col => {
                        const val = fullReportData.totals[col.key];
                        return (
                          <td key={col.key}>
                            {val !== null && val !== undefined
                              ? val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
                              : '-'}
                          </td>
                        );
                      })}
                    </tr>

                    <tr className="footer-avg-row">
                      <td>Avg. Rate / Hour</td>
                      {fullReportData.columns.map(col => {
                        const val = fullReportData.averages[col.key];
                        return (
                          <td key={col.key}>
                            {val !== null && val !== undefined
                              ? `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${col.unit ? `${col.unit}/h` : ''}`
                              : '-'}
                          </td>
                        );
                      })}
                    </tr>

                    <tr className="footer-cost-row">
                      <td>Est. Cost ({currency})</td>
                      {fullReportData.columns.map(col => {
                        const val = fullReportData.costs[col.key];
                        return (
                          <td key={col.key}>
                            {val !== null && val !== undefined
                              ? `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
