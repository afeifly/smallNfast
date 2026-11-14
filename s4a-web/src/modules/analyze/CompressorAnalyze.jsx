/**
 * CompressorAnalyze.jsx
 *
 * Port of the CAA desktop app's statistics report dialog to the web.
 * Shows per-compressor load analysis, system totals, and d3 charts.
 */

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import intl from 'react-intl-universal';
import TestAPI from '../../api/TestAPI';
import { Compressor, createDefaultCompressor, COMPRESSOR_TYPE_LOAD_UNLOAD, COMPRESSOR_TYPE_VARIABLE_FREQUENCY } from '../../analysis/CompressorEngine.js';
import { analyzeSystem, analyzeSystemFlowChannel, extractChannelData, classifyChannel } from '../../analysis/LeakEngine.js';
import './Analyze.css';

// Material-UI dialog and form components
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

// ── SVG Icons ────────────────────────────────────────────────────────────────

const Icons = {
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
  Clock: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  ),
  Droplet: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
    </svg>
  ),
  Compressor: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"></path>
    </svg>
  ),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n, decimals = 1) => {
  if (n == null || !isFinite(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const fmtHrs = (h) => fmt(h, 1) + ' h';
const fmtKwh = (k) => fmt(k, 1) + ' kWh';
const fmtPct = (p) => (p * 100).toFixed(1) + '%';
const fmtFlow = (v) => fmt(v, 2);

const formatDateTime = (ms) => {
  if (!ms || !isFinite(ms)) return '';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const parseDateTimeStr = (str, isEnd = false) => {
  if (!str) return null;
  const trimmed = str.trim();
  const dtMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (dtMatch) {
    return new Date(
      parseInt(dtMatch[1], 10),
      parseInt(dtMatch[2], 10) - 1,
      parseInt(dtMatch[3], 10),
      parseInt(dtMatch[4], 10),
      parseInt(dtMatch[5], 10),
      dtMatch[6] ? parseInt(dtMatch[6], 10) : (isEnd ? 59 : 0),
      isEnd ? 999 : 0
    );
  }
  const dMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dMatch) {
    return new Date(
      parseInt(dMatch[1], 10),
      parseInt(dMatch[2], 10) - 1,
      parseInt(dMatch[3], 10),
      isEnd ? 23 : 0,
      isEnd ? 59 : 0,
      isEnd ? 59 : 0,
      isEnd ? 999 : 0
    );
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
};

const CHART_COLORS = ['#00ac86', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

// ── Main Component ───────────────────────────────────────────────────────────

export default function CompressorAnalyze() {
  const [compressors, setCompressors] = useState([]);
  const [systemResult, setSystemResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Settings
  const [energyCost, setEnergyCost] = useState(0.1);
  const [voltage, setVoltage] = useState(400);
  const [leakThreshold, setLeakThreshold] = useState(0);

  // Analyze mode + System Analyze
  const [analyzeMode, setAnalyzeMode] = useState('compressor'); // 'compressor' | 'system'
  const [flowChannels, setFlowChannels] = useState([]);
  const [systemFlowChannelId, setSystemFlowChannelId] = useState(null);
  const [systemFlowResult, setSystemFlowResult] = useState(null);

  // Analyze settings (mirror CAA AnalyzesSettingDialog / CalculateSettingDialog)
  const [currency, setCurrency] = useState('\u20AC');
  const [costPerM3, setCostPerM3] = useState(0.05);
  const [co2PerKwh, setCo2PerKwh] = useState(0.55);
  const [showCO2, setShowCO2] = useState(true);
  const [workHourPerYear, setWorkHourPerYear] = useState(8760);
  const [startTimeStr, setStartTimeStr] = useState('');
  const [stopTimeStr, setStopTimeStr] = useState('');

  const fmtCost = (c) => (currency || '\u20AC') + fmt(c, 2);

  // Compressor Config Modal Dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingCompressors, setEditingCompressors] = useState([]);
  const [selectedCompIdx, setSelectedCompIdx] = useState(0);

  // Mobile view switcher ('config' | 'report')
  const [mobileTab, setMobileTab] = useState('config');

  // Refs for d3 charts
  const pieRef = useRef(null);
  const barRef = useRef(null);

  // Draw charts when results change
  useEffect(() => {
    if (systemResult && compressors.length > 0) {
      drawPieChart();
      drawBarChart();
    }
  }, [systemResult, compressors]);

  // Load flow channels up-front so the System Flow Channel dropdown is populated
  // even before the first analysis run.
  useEffect(() => {
    let cancelled = false;
    if (!TestAPI.isFileLoaded || !TestAPI.isFileLoaded()) return undefined;
    if (TestAPI.getFileTimeRange) {
      const range = TestAPI.getFileTimeRange();
      if (range && range.start && range.stop) {
        setStartTimeStr((prev) => prev || formatDateTime(range.start));
        setStopTimeStr((prev) => prev || formatDateTime(range.stop));
      }
    }
    TestAPI.getChannels((res) => {
      if (cancelled) return;
      const chs = res ? res.logging_chs || [] : [];
      const flows = chs.filter((ch) => classifyChannel(ch.unit_in_ascii) === 'flow');
      setFlowChannels(flows);
      if (flows.length > 0) {
        setSystemFlowChannelId((prev) => prev ?? flows[0].channel_id);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenSettings = async () => {
    // If we don't have compressors yet, discover channels first
    if (compressors.length === 0) {
      try {
        const channels = await new Promise((resolve) => {
          TestAPI.getChannels((res) => resolve(res ? res.logging_chs || [] : []));
        });
        setFlowChannels(channels.filter((ch) => classifyChannel(ch.unit_in_ascii) === 'flow'));
        const currentChs = channels.filter((ch) => classifyChannel(ch.unit_in_ascii) === 'current');
        const powerChs = channels.filter((ch) => classifyChannel(ch.unit_in_ascii) === 'power');
        const inputChs = [...currentChs, ...powerChs];

        const comps = inputChs.map((ch) => {
          const isPower = classifyChannel(ch.unit_in_ascii) === 'power';
          const comp = createDefaultCompressor(COMPRESSOR_TYPE_LOAD_UNLOAD);
          comp.Description = ch.logic_channel_description || ch.sensor_description || `Compressor ${ch.channel_id}`;
          comp.Unit = ch.channel_id;
          comp.hasPowerChannel = isPower;
          if (isPower) {
            comp.FullLoadCurrentThreshold = 15;
            comp.NoLoadCurrentThreshold = 2;
          } else {
            comp.FullLoadCurrentThreshold = 4;
            comp.NoLoadCurrentThreshold = 0.5;
          }
          comp.FullLoadCurrent = 20;
          comp.UnLoadCurrent = 10;
          comp.FullLoadCosP = 0.86;
          comp.UnLoadCosP = 0.5;
          comp.FullLoadAirDelivery = 10;
          comp.SupplyVoltage = voltage;
          return comp;
        });
        setEditingCompressors(comps);
      } catch (e) {
        setEditingCompressors([]);
      }
    } else {
      setEditingCompressors(compressors.map(c => c.clone()));
    }
    setSelectedCompIdx(0);
    setSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    setSettingsOpen(false);
    runAnalysis(editingCompressors);
  };

  const handleUpdateEditingComp = (field, value) => {
    const updated = [...editingCompressors];
    const comp = updated[selectedCompIdx];
    comp[field] = value;

    if (field === 'Type') {
      if (value === COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
        comp._initVFVariables();
      } else {
        comp.resetStatisticsValues();
      }
    }
    
    if (field === 'VFMotorPower') {
      comp.setMotorPower(value);
    }
    if (field === 'VFSystemPressure') {
      comp.setSystemPressure(value);
    }

    setEditingCompressors(updated);
  };

  const runAnalysis = async (customComps = null) => {
    setLoading(true);
    setProgress(0);
    setError(null);
    setMobileTab('report');

    try {
      // Get channels from the loaded file
      const channels = await new Promise((resolve) => {
        TestAPI.getChannels((res) => resolve(res ? res.logging_chs || [] : []));
      });
      setProgress(0.05);

      if (!channels || channels.length === 0) {
        setError(intl.get('COMP_ERR_NO_CHANNELS') || 'No channels found in the loaded file.');
        setLoading(false);
        return;
      }

      // Get sample data rows
      const sampleRate = TestAPI.getSampleRate ? TestAPI.getSampleRate() : 1;
      const sampleIntervalSec = 1 / sampleRate;

      // Get all data rows
      let allRows = [];
      const totalSamples = TestAPI.getNumOfSamples ? TestAPI.getNumOfSamples() : 0;
      const pageSize = Math.min(5000, totalSamples || 5000);
      const numPages = totalSamples ? Math.ceil(totalSamples / pageSize) : 1;

      for (let page = 0; page < numPages; page++) {
        const res = await new Promise((resolve) => {
          TestAPI.getTablePage(page, pageSize, channels.map((ch) => ch.channel_id), (val) => resolve(val || { rows: [] }));
        });
        const rows = res.rows || [];
        if (rows && rows.length) allRows = allRows.concat(rows);
        setProgress(0.05 + 0.95 * ((page + 1) / numPages));
      }

      // Classify channels
      const currentChs = channels.filter((ch) => classifyChannel(ch.unit_in_ascii) === 'current');
      const powerChs = channels.filter((ch) => classifyChannel(ch.unit_in_ascii) === 'power');
      const flowChs = channels.filter((ch) => classifyChannel(ch.unit_in_ascii) === 'flow');
      setFlowChannels(flowChs);
      if (flowChs.length > 0 && (systemFlowChannelId == null)) {
        // remember the first flow channel as the default system flow channel
        setSystemFlowChannelId((prev) => prev ?? flowChs[0].channel_id);
      }

      // Restrict to the selected analysis time period (whole file when empty)
      if (startTimeStr) {
        const d = parseDateTimeStr(startTimeStr, false);
        if (d) allRows = allRows.filter(r => r.timestampMs >= d.getTime());
      }
      if (stopTimeStr) {
        const d = parseDateTimeStr(stopTimeStr, true);
        if (d) allRows = allRows.filter(r => r.timestampMs <= d.getTime());
      }

      // Use either the provided customComps or the existing state, fallback to auto-generation
      const activeComps = customComps || compressors;
      const comps = [];
      const inputChs = [...currentChs, ...powerChs];

      if (inputChs.length > 0) {
        for (const ch of inputChs) {
          const existing = activeComps.find(c => c.Unit === ch.channel_id);
          if (existing) {
            existing.SupplyVoltage = voltage;
            if (existing.Type === COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
              existing._calculateVFAmpAndLinearCoefficiency();
            }
            comps.push(existing);
          } else {
            const isPower = classifyChannel(ch.unit_in_ascii) === 'power';
            const comp = createDefaultCompressor(COMPRESSOR_TYPE_LOAD_UNLOAD);
            comp.Description = ch.logic_channel_description || ch.sensor_description || `Compressor ${ch.channel_id}`;
            comp.Unit = ch.channel_id;
            comp.hasPowerChannel = isPower;

            if (isPower) {
              comp.FullLoadCurrentThreshold = 15; // default kW threshold
              comp.NoLoadCurrentThreshold = 2; // stop kW threshold
            } else {
              comp.FullLoadCurrentThreshold = 4; // default current threshold
              comp.NoLoadCurrentThreshold = 0.5; // stop current threshold
            }

            // Fixed-speed defaults
            comp.FullLoadCurrent = 20;
            comp.UnLoadCurrent = 10;
            comp.FullLoadCosP = 0.86;
            comp.UnLoadCosP = 0.5;

            comp.FullLoadAirDelivery = 10;
            comp.SupplyVoltage = voltage;
            if (comp.Type === COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
              comp._calculateVFAmpAndLinearCoefficiency();
            }
            comps.push(comp);
          }
        }
      } else if (flowChs.length > 0) {
        for (const ch of flowChs) {
          const existing = activeComps.find(c => c.Unit === ch.channel_id);
          if (existing) {
            existing.SupplyVoltage = voltage;
            existing.isFlowChannel = true;
            existing.AirDeliveryUnit = ch.unit_in_ascii || 'm\u00B3/h';
            comps.push(existing);
          } else {
            const comp = createDefaultCompressor(COMPRESSOR_TYPE_LOAD_UNLOAD);
            comp.Description = ch.logic_channel_description || ch.sensor_description || `Flow ${ch.channel_id}`;
            comp.Unit = ch.channel_id;
            comp.isFlowChannel = true;
            comp.FullLoadCurrentThreshold = 0.5;
            comp.FullLoadAirDelivery = ch.maxValue || 100;
            comp.SupplyVoltage = voltage;
            comp.AirDeliveryUnit = ch.unit_in_ascii || 'm\u00B3/h';
            comps.push(comp);
          }
        }
      }

      if (comps.length === 0) {
        setError(intl.get('COMP_ERR_NO_VALID_CHANNELS') || 'No current (A), power (kW), or flow channels found. Cannot run compressor analysis.');
        setLoading(false);
        return;
      }

      // Apply CO₂ factor and per-compressor flow-channel assignment
      for (const comp of comps) {
        comp.CO2EmmisionPerKWh = co2PerKwh;
        if (comp.flowChannelId) {
          const flowCh = channels.find(c => c.channel_id === comp.flowChannelId);
          if (flowCh) {
            comp.Unit = flowCh.channel_id;
            comp.isFlowChannel = true;
            comp.AirDeliveryUnit = flowCh.unit_in_ascii || comp.AirDeliveryUnit;
            if (comp.Type === COMPRESSOR_TYPE_VARIABLE_FREQUENCY) {
              comp._calculateVFAmpAndLinearCoefficiency();
            }
          }
        }
      }

      // Build data map
      const dataMap = new Map();
      for (const comp of comps) {
        const data = extractChannelData(allRows, comp.Unit);
        if (data.length > 0) dataMap.set(comp.Unit, data);
      }

      // Run analysis
      const result = analyzeSystem(comps, dataMap, sampleIntervalSec, {
        energyCostPerKwh: energyCost,
        voltage,
        leakThreshold,
        workHourPerYear,
      });

      // System Analyze: additionally summarize the designated system flow channel
      let sysFlow = null;
      if (analyzeMode === 'system' && systemFlowChannelId != null) {
        const flowCh = channels.find(c => c.channel_id === systemFlowChannelId);
        const flowData = extractChannelData(allRows, systemFlowChannelId);
        sysFlow = analyzeSystemFlowChannel(flowData, sampleIntervalSec, {
          leakThreshold,
          flowUnit: flowCh ? flowCh.unit_in_ascii : 'm\u00B3/h',
          airUnitCost: costPerM3,
          workHourPerYear,
        });
      }
      setSystemFlowResult(sysFlow);

      setCompressors(result.compressors);
      setSystemResult(result.system);
    } catch (e) {
      console.error('Analysis error:', e);
      setError((intl.get('COMP_ERR_ANALYSIS_FAILED') || 'Analysis failed: ') + e.message);
    }

    setLoading(false);
  };

  // ── d3 Pie Chart: Load Distribution ──

  const drawPieChart = () => {
    const svgEl = pieRef.current;
    if (!svgEl) return;

    const width = 400;
    const height = 340;
    const radius = Math.min(width, height - 50) / 2 - 15;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${width / 2}, ${(height - 50) / 2 + 10})`);

    const totalHours = compressors.reduce((s, c) => s + c.TotalHours, 0);

    const pieData = [
      { label: intl.get('COMP_FULL_LOAD') || 'Full Load', value: compressors.reduce((s, c) => s + c.FullLoadHours, 0), color: '#00ac86' },
      { label: intl.get('COMP_UNLOAD') || 'Unload', value: compressors.reduce((s, c) => s + c.UnLoadHours, 0), color: '#f59e0b' },
      { label: intl.get('COMP_NO_LOAD') || 'No Load', value: compressors.reduce((s, c) => s + c.NoLoadHours, 0), color: '#ef4444' },
    ].filter(d => d.value > 0);

    if (pieData.length === 0) return;

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(0).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(0).outerRadius(radius + 8);

    g.selectAll('path')
      .data(pie(pieData))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .on('mouseenter', function () {
        d3.select(this).transition().duration(200).attr('d', arcHover);
      })
      .on('mouseleave', function () {
        d3.select(this).transition().duration(200).attr('d', arc);
      });

    // Centered Legend closer to the bottom
    const itemWidth = 130;
    const totalLegendWidth = (pieData.length - 1) * itemWidth + 95;
    const legendOffset = Math.max(0, (width - totalLegendWidth) / 2);
    const legend = svg.append('g').attr('transform', `translate(${legendOffset}, 315)`);
    pieData.forEach((d, i) => {
      const leg = legend.append('g').attr('transform', `translate(${i * itemWidth}, 0)`);
      leg.append('rect').attr('width', 12).attr('height', 12).attr('fill', d.color).attr('rx', 2);
      leg.append('text')
        .attr('x', 18).attr('y', 10).attr('font-size', 11).attr('fill', '#334155')
        .text(`${d.label}: ${fmtHrs(d.value)}`);
    });
  };

  // ── d3 Bar Chart: Energy by Compressor ──

  const drawBarChart = () => {
    const svgEl = barRef.current;
    if (!svgEl) return;

    const width = 600;
    const height = 340;
    const margin = { top: 20, right: 20, bottom: 85, left: 60 };

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const data = compressors.filter(c => c.Selected).map((c, i) => ({
      label: c.Description.length > 15 ? c.Description.slice(0, 15) + '...' : c.Description,
      full: c.FullLoadEnergyConsumption,
      unload: c.UnLoadEnergyConsumption,
      noload: c.NoLoadEnergyConsumption,
      total: c.TotalEnergyConsumption,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

    if (data.length === 0) return;

    const x0 = d3.scaleBand().domain(data.map(d => d.label)).range([margin.left, width - margin.right]).padding(0.1);
    const x1 = d3.scaleBand().domain(['full', 'unload', 'noload']).range([0, x0.bandwidth()]).padding(0.05);
    const yMax = d3.max(data, d => d.total) * 1.1;
    const y = d3.scaleLinear().domain([0, yMax]).range([height - margin.bottom, margin.top]);

    const colorMap = { full: '#00ac86', unload: '#f59e0b', noload: '#ef4444' };

    // Bars
    data.forEach((d) => {
      ['full', 'unload', 'noload'].forEach((key) => {
        if (d[key] <= 0) return;
        svg.append('rect')
          .attr('x', x0(d.label) + x1(key))
          .attr('y', y(d[key]))
          .attr('width', x1.bandwidth())
          .attr('height', y(0) - y(d[key]))
          .attr('fill', colorMap[key])
          .attr('rx', 3);
      });
    });

    // Axes
    const xAxis = d3.axisBottom(x0);
    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(xAxis)
      .selectAll('text')
      .attr('transform', 'rotate(-25)')
      .style('text-anchor', 'end')
      .attr('dx', '-.6em')
      .attr('dy', '.6em')
      .attr('font-size', 10);

    const yAxis = d3.axisLeft(y).ticks(6);
    svg.append('g').attr('transform', `translate(${margin.left}, 0)`).call(yAxis);

    svg.append('text')
      .attr('x', margin.left + 10).attr('y', 14).attr('font-size', 11).attr('fill', '#64748b')
      .text('kWh');

    // Centered Legend closer to the bottom
    const totalLegendWidth = 2 * 120 + 80;
    const legendOffset = margin.left + Math.max(0, (width - margin.left - margin.right - totalLegendWidth) / 2);
    const legend = svg.append('g').attr('transform', `translate(${legendOffset}, 315)`);
    const legData = [
      { label: intl.get('COMP_FULL_LOAD') || 'Full Load', color: '#00ac86' },
      { label: intl.get('COMP_UNLOAD') || 'Unload', color: '#f59e0b' },
      { label: intl.get('COMP_NO_LOAD') || 'No Load', color: '#ef4444' },
    ];
    legData.forEach((d, i) => {
      const g = legend.append('g').attr('transform', `translate(${i * 120}, 0)`);
      g.append('rect').attr('width', 12).attr('height', 12).attr('fill', d.color).attr('rx', 2);
      g.append('text').attr('x', 18).attr('y', 10).attr('font-size', 11).attr('fill', '#475569').text(d.label);
    });
  };

  // ── Render ──

  if (!TestAPI.isFileLoaded || !TestAPI.isFileLoaded()) {
    return (
      <div className="analyze-container">
        <div className="empty-state-container">
          <Icons.Compressor />
          <h3 className="empty-state-title">{intl.get('COMP_TITLE') || 'Compressor Analysis'}</h3>
          <p className="empty-state-desc">{intl.get('COMP_OPEN_FILE_HINT') || 'Open a CSD file to run compressor analysis.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`analyze-container mobile-tab-${mobileTab}`}>
      {/* Small Screen View Switcher (Hidden on Desktop via CSS) */}
      <div className="analyze-mobile-switcher">
        <button
          type="button"
          className={`analyze-mobile-btn ${mobileTab === 'config' ? 'active' : ''}`}
          onClick={() => setMobileTab('config')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>{intl.get('COMP_PARAMETERS') || 'Parameters'}</span>
        </button>
        <button
          type="button"
          className={`analyze-mobile-btn ${mobileTab === 'report' ? 'active' : ''}`}
          onClick={() => setMobileTab('report')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
          <span>{intl.get('COMP_ANALYSIS_RESULTS') || 'Analysis Results'}</span>
        </button>
      </div>

      {/* Sidebar Settings */}
      <aside className="analyze-sidebar">
        <h3 className="sidebar-section-title">{intl.get('COMP_SETTINGS') || 'Settings'}</h3>

        <div className="sidebar-input-group">
          <label className="sidebar-label">{intl.get('COMP_ANALYZE_TYPE') || 'Analyze Type'}</label>
          <select
            className="sidebar-input"
            value={analyzeMode}
            onChange={(e) => setAnalyzeMode(e.target.value)}
          >
            <option value="compressor">{intl.get('COMP_COMPRESSOR_ANALYSES') || 'Compressor Analyses'}</option>
            <option value="system">{intl.get('COMP_SYSTEM_ANALYSES') || 'System Analyses'}</option>
          </select>
        </div>

        {analyzeMode === 'system' && (
          <div className="sidebar-input-group">
            <label className="sidebar-label">{intl.get('COMP_SYSTEM_FLOW_CHANNEL') || 'System Flow Channel'}</label>
            <select
              className="sidebar-input"
              value={systemFlowChannelId || ''}
              onChange={(e) => setSystemFlowChannelId(e.target.value || null)}
            >
              {flowChannels.length === 0 && <option value="">{intl.get('COMP_NO_FLOW_CHANNELS') || 'No flow channels'}</option>}
              {flowChannels.map((ch) => (
                <option key={ch.channel_id} value={ch.channel_id}>
                  {ch.full_channel_name || ch.logic_channel_description || ch.channel_id}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="sidebar-input-group">
          <label className="sidebar-label">{intl.get('COMP_ANALYSIS_TIME_PERIOD') || 'Analysis Time Period (optional)'}</label>
          <DatePicker
            className="sidebar-input"
            selected={parseDateTimeStr(startTimeStr, false)}
            onChange={(date) => setStartTimeStr(date ? formatDateTime(date.getTime()) : '')}
            dateFormat="yyyy-MM-dd HH:mm:ss"
            timeInputLabel={intl.get('GV_START_TIME_COLON') || 'Start Time:'}
            showMonthDropdown
            useShortMonthInDropdown
            showTimeInput
            placeholderText={intl.get('COMP_START') || 'YYYY-MM-DD HH:mm:ss'}
          />
          <div style={{ marginTop: '6px' }}>
            <DatePicker
              className="sidebar-input"
              selected={parseDateTimeStr(stopTimeStr, true)}
              onChange={(date) => setStopTimeStr(date ? formatDateTime(date.getTime()) : '')}
              dateFormat="yyyy-MM-dd HH:mm:ss"
              timeInputLabel={intl.get('GV_END_TIME_COLON') || 'End Time:'}
              showMonthDropdown
              useShortMonthInDropdown
              showTimeInput
              placeholderText={intl.get('COMP_END') || 'YYYY-MM-DD HH:mm:ss'}
            />
          </div>
        </div>

        <div className="sidebar-input-group">
          <label className="sidebar-label">{intl.get('COMP_CURRENCY') || 'Currency'}</label>
          <input
            className="sidebar-input"
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value || '\u20AC')}
          />
        </div>

        <div className="sidebar-input-group">
          <label className="sidebar-label">{intl.get('COMP_COST_PER_M3_AIR') || 'Cost per m³ (air)'}</label>
          <input
            className="sidebar-input"
            type="number"
            step="0.001"
            min="0"
            value={costPerM3}
            onChange={(e) => setCostPerM3(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div className="sidebar-input-group">
          <label className="sidebar-label">{intl.get('COMP_ENERGY_COST') || 'Energy Cost (€/kWh)'}</label>
          <input
            className="sidebar-input"
            type="number"
            step="0.01"
            min="0"
            value={energyCost}
            onChange={(e) => setEnergyCost(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div className="sidebar-input-group">
          <label className="sidebar-label">{intl.get('COMP_SUPPLY_VOLTAGE') || 'Supply Voltage (V)'}</label>
          <input
            className="sidebar-input"
            type="number"
            step="10"
            min="100"
            value={voltage}
            onChange={(e) => setVoltage(parseFloat(e.target.value) || 400)}
          />
        </div>

        <div className="sidebar-input-group">
          <label className="sidebar-label">{intl.get('COMP_LEAK_THRESHOLD_FLOW') || 'Leak Threshold Flow'}</label>
          <input
            className="sidebar-input"
            type="number"
            step="0.1"
            min="0"
            value={leakThreshold}
            onChange={(e) => setLeakThreshold(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div className="sidebar-input-group">
          <label className="sidebar-label">{intl.get('COMP_CO2_EMISSION') || 'CO₂ Emission (kg/kWh)'}</label>
          <input
            className="sidebar-input"
            type="number"
            step="0.01"
            min="0"
            value={co2PerKwh}
            onChange={(e) => setCo2PerKwh(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div className="sidebar-input-group">
          <label className="sidebar-label">{intl.get('COMP_WORKING_HOUR_PER_YEAR') || 'Working Hour / Year'}</label>
          <input
            className="sidebar-input"
            type="number"
            step="100"
            min="1"
            value={workHourPerYear}
            onChange={(e) => setWorkHourPerYear(parseInt(e.target.value, 10) || 8760)}
          />
        </div>

        <div className="sidebar-input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="showCO2"
            checked={showCO2}
            onChange={(e) => setShowCO2(e.target.checked)}
          />
          <label htmlFor="showCO2" className="sidebar-label" style={{ margin: 0 }}>{intl.get('COMP_DISPLAY_CO2_IN_REPORT') || 'Display CO₂ in report'}</label>
        </div>

        <button className="sidebar-reload-btn" onClick={() => runAnalysis()} disabled={loading}>
          {loading ? (intl.get('COMP_ANALYZING_BTN') || 'Analyzing...') : (intl.get('COMP_RUN_ANALYSIS') || 'Run Analysis')}
        </button>

        <button 
          className="sidebar-settings-btn" 
          onClick={handleOpenSettings}
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '10px',
            backgroundColor: '#f1f5f9',
            color: '#475569',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          {intl.get('COMP_CONFIGURE_COMPRESSORS') || 'Configure Compressors'}
        </button>

        {error && <div className="analyze-error">{error}</div>}
      </aside>

      {/* Main Content */}
      <main className="analyze-main-content">
        {loading ? (
          <div className="empty-state-container" style={{ height: '80vh' }}>
            <div className="empty-state-title">{intl.get('COMP_ANALYZING_DATA') || 'Analyzing & Compiling Compressor Data...'}</div>
            <div className="empty-state-desc" style={{ width: '300px' }}>
              <div style={{ width: '100%', height: '8px', background: '#cbd5e1', borderRadius: '4px', overflow: 'hidden', marginTop: '12px' }}>
                <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: '#00ac86', transition: 'width 0.1s ease' }}></div>
              </div>
              <div style={{ fontSize: '11px', marginTop: '6px', color: '#64748b' }}>
                {intl.get('COMP_PERCENT_LOADED', { percent: (progress * 100).toFixed(0) }) || `${(progress * 100).toFixed(0)}% loaded`}
              </div>
            </div>
          </div>
        ) : systemResult ? (
          <>
            {/* Report Header */}
            <div className="report-header screen-only" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div className="report-title-section" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 className="report-main-title" style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{analyzeMode === 'system' ? (intl.get('COMP_SYSTEM_REPORT_TITLE') || 'System Analysis Report') : (intl.get('COMP_REPORT_TITLE') || 'Compressor Analysis Report')}</h2>
                <p className="report-subtitle" style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                  {analyzeMode === 'system' ? (intl.get('COMP_SYSTEM_REPORT_SUBTITLE') || 'System flow + compressor efficiency statistics') : (intl.get('COMP_REPORT_SUBTITLE') || 'System analysis details and efficiency statistics')}
                </p>
              </div>
              <button 
                className="export-pdf-btn" 
                onClick={() => window.print()}
                style={{
                  background: 'linear-gradient(135deg, #00ac86 0%, #007d61 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(0, 172, 134, 0.2)',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                {intl.get('COMP_EXPORT_PDF') || 'Export PDF'}
              </button>
            </div>

            {/* Print Header (Print Only) */}
            <div className="print-only" style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>{intl.get('COMP_REPORT_TITLE') || 'Compressor Analysis Report'}</h2>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                {intl.get('COMP_REPORT_SUBTITLE') || 'System analysis details and efficiency statistics'} — {intl.get('COMP_GENERATED_ON') || 'Generated on'} {formatDateTime(Date.now())}
              </p>
            </div>

            {/* System Summary Cards */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon-wrap primary"><Icons.Energy /></div>
                <div className="metric-info">
                  <span className="metric-label">{intl.get('COMP_TOTAL_ENERGY') || 'Total Energy'}</span>
                  <span className="metric-value">{fmtKwh(systemResult.totalEnergyConsumption)}</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon-wrap warning"><Icons.Dollar /></div>
                <div className="metric-info">
                  <span className="metric-label">{intl.get('COMP_TOTAL_COST') || 'Total Cost'}</span>
                  <span className="metric-value">{fmtCost(systemResult.totalCost)}</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon-wrap info"><Icons.Clock /></div>
                <div className="metric-info">
                  <span className="metric-label">{intl.get('COMP_FULL_LOAD_HOURS') || 'Full Load Hours'}</span>
                  <span className="metric-value">{fmtHrs(systemResult.totalFullLoadHours)}</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon-wrap warning"><Icons.Droplet /></div>
                <div className="metric-info">
                  <span className="metric-label">{intl.get('COMP_TOTAL_LEAKAGE') || 'Total Leakage'}</span>
                  <span className="metric-value">{fmt(systemResult.totalLeakage, 1)} m³</span>
                </div>
              </div>
            </div>

            {/* System Analyze — designated system flow channel summary (CAA System Analyze) */}
            {analyzeMode === 'system' && systemFlowResult && (
              <div className="table-card">
                <h4 className="card-title">{intl.get('COMP_SYSTEM_ANALYZE_FLOW_CHANNEL', { unit: systemFlowResult.flowUnit }) || `System Analyze — ${systemFlowResult.flowUnit} flow channel`}</h4>
                <div className="report-table-wrapper">
                  <table className="report-table">
                    <tbody>
                      <tr>
                        <td><strong>{intl.get('COMP_AVERAGE_FLOW') || 'Average Flow'}</strong></td>
                        <td>{fmtFlow(systemFlowResult.averageFlow)} {systemFlowResult.flowUnit}</td>
                        <td><strong>{intl.get('COMP_MAX_FLOW') || 'Max Flow'}</strong></td>
                        <td>{fmtFlow(systemFlowResult.maxFlow)} {systemFlowResult.flowUnit}</td>
                      </tr>
                      <tr>
                        <td><strong>{intl.get('COMP_MIN_FLOW') || 'Min Flow'}</strong></td>
                        <td>{fmtFlow(systemFlowResult.minFlow)} {systemFlowResult.flowUnit}</td>
                        <td><strong>{intl.get('COMP_TOTAL_AIR_DELIVERY') || 'Total Air Delivery'}</strong></td>
                        <td>{fmt(systemFlowResult.totalAirDelivery, 1)} m³</td>
                      </tr>
                      <tr>
                        <td><strong>{intl.get('COMP_TOTAL_AIR_DELIVERY_1YR') || 'Total Air Delivery (1 yr)'}</strong></td>
                        <td>{fmt(systemFlowResult.totalAirDeliveryOneYear, 0)} m³</td>
                        <td><strong>{intl.get('COMP_VALID_RECORD_TIME') || 'Valid Record Time'}</strong></td>
                        <td>{fmt(systemFlowResult.validHours, 1)} h</td>
                      </tr>
                      <tr>
                        <td><strong>{intl.get('COMP_AVERAGE_LEAKAGE') || 'Average Leakage'}</strong></td>
                        <td>{fmtFlow(leakThreshold || systemFlowResult.minFlow)} {systemFlowResult.flowUnit}</td>
                        <td><strong>{intl.get('COMP_TOTAL_LEAKAGE') || 'Total Leakage'}</strong></td>
                        <td>{fmt(systemFlowResult.totalLeakage, 1)} m³</td>
                      </tr>
                      <tr>
                        <td><strong>{intl.get('COMP_LEAKAGE_RATE') || 'Leakage Rate'}</strong></td>
                        <td>{fmtPct(systemFlowResult.leakageRate)}</td>
                        <td><strong>{intl.get('COMP_LEAKAGE_COST') || 'Leakage Cost'}</strong></td>
                        <td>{fmtCost(systemFlowResult.leakageCost)}</td>
                      </tr>
                      <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                        <td><strong>{intl.get('COMP_COST_PER_M3') || 'Cost per m³'}</strong></td>
                        <td>{fmtCost(systemFlowResult.costPerM3)}/m³</td>
                        <td><strong>{intl.get('COMP_TOTAL_COST') || 'Total Cost'}</strong></td>
                        <td>{fmtCost(systemFlowResult.totalCost)}</td>
                      </tr>
                      <tr>
                        <td><strong>{intl.get('COMP_TOTAL_LEAKAGE_1YR') || 'Total Leakage (1 yr)'}</strong></td>
                        <td>{fmt(systemFlowResult.totalLeakageOneYear, 1)} m³</td>
                        <td><strong>{intl.get('COMP_TOTAL_COST_1YR') || 'Total Cost (1 yr)'}</strong></td>
                        <td>{fmtCost(systemFlowResult.totalCostOneYear)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Flow & System Summary Table — matching CAA StatisticsReportDialog */}
            <div className="table-card">
              <h4 className="card-title">{intl.get('COMP_FLOW_SYSTEM_SUMMARY') || 'Flow & System Summary'}</h4>
              <div className="report-table-wrapper">
                <table className="report-table">
                  <tbody>
                    <tr>
                      <td><strong>{intl.get('COMP_AVERAGE_FLOW') || 'Average Flow'}</strong></td>
                      <td>{fmtFlow(systemResult.averageFlow)} {systemResult.flowUnit}</td>
                      <td><strong>{intl.get('COMP_MAX_FLOW') || 'Max Flow'}</strong></td>
                      <td>{fmtFlow(systemResult.maxFlow)} {systemResult.flowUnit}</td>
                    </tr>
                    <tr>
                      <td><strong>{intl.get('COMP_MIN_FLOW') || 'Min Flow'}</strong></td>
                      <td>{fmtFlow(systemResult.minFlow)} {systemResult.flowUnit}</td>
                      <td><strong>{intl.get('COMP_TOTAL_AIR_DELIVERY') || 'Total Air Delivery'}</strong></td>
                      <td>{fmt(systemResult.totalAirDelivery, 1)} m³</td>
                    </tr>
                    <tr>
                      <td><strong>{intl.get('COMP_TOTAL_AIR_DELIVERY_1YR') || 'Total Air Delivery (1 yr)'}</strong></td>
                      <td>{fmt(systemResult.totalAirDeliveryOneYear, 0)} m³</td>
                      <td><strong>{intl.get('COMP_TOTAL_COST') || 'Total Cost'}</strong></td>
                      <td>{fmtCost(systemResult.totalCost)}</td>
                    </tr>
                    <tr>
                      <td><strong>{intl.get('COMP_TOTAL_COST_1YR') || 'Total Cost (1 yr)'}</strong></td>
                      <td>{fmtCost(systemResult.totalCostOneYear)}</td>
                      <td><strong>{intl.get('COMP_COST_PER_M3') || 'Cost per m³'}</strong></td>
                      <td>{fmtCost(systemResult.totalAirDelivery > 0 ? systemResult.totalCost / systemResult.totalAirDelivery : 0)}/m³</td>
                    </tr>
                    <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                      <td><strong>{intl.get('COMP_AVERAGE_LEAKAGE') || 'Average Leakage'}</strong></td>
                      <td>{fmtFlow(leakThreshold)} {systemResult.flowUnit}</td>
                      <td><strong>{intl.get('COMP_TOTAL_LEAKAGE') || 'Total Leakage'}</strong></td>
                      <td>{fmt(systemResult.totalLeakage, 1)} m³</td>
                    </tr>
                    <tr>
                      <td><strong>{intl.get('COMP_LEAKAGE_RATE') || 'Leakage Rate'}</strong></td>
                      <td>{fmtPct(systemResult.leakageRate)}</td>
                      <td><strong>{intl.get('COMP_LEAKAGE_COST') || 'Leakage Cost'}</strong></td>
                      <td>{fmtCost(systemResult.leakageCost)}</td>
                    </tr>
                    <tr>
                      <td><strong>{intl.get('COMP_LEAKAGE_COST_1YR') || 'Leakage Cost (1 yr)'}</strong></td>
                      <td>{fmtCost(systemResult.leakageCost * (systemResult.totalAirDeliveryOneYear / Math.max(1, systemResult.totalAirDelivery)))}</td>
                      <td><strong>{intl.get('COMP_TOTAL_LEAKAGE_1YR') || 'Total Leakage (1 yr)'}</strong></td>
                      <td>{fmt(systemResult.totalLeakage * (systemResult.totalAirDeliveryOneYear / Math.max(1, systemResult.totalAirDelivery)), 1)} m³</td>
                    </tr>
                    {showCO2 && (
                        <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                          <td><strong>{intl.get('COMP_NUMBER_OF_COMPRESSORS') || 'Number of Compressors'}</strong></td>
                          <td>{systemResult.numCompressorsSelected} / {systemResult.numCompressors}</td>
                          <td><strong>{intl.get('COMP_TOTAL_CO2') || 'Total CO₂'}</strong></td>
                          <td>{fmt(systemResult.totalCO2Emmision, 2)} kg</td>
                        </tr>
                      )}
                      {showCO2 && (
                        <tr>
                          <td><strong>{intl.get('COMP_TOTAL_CO2_1YR') || 'Total CO₂ (1 yr)'}</strong></td>
                          <td>{fmt(systemResult.totalCO2EmmisionOneYear, 2)} kg</td>
                          <td></td>
                          <td></td>
                        </tr>
                      )}
</tbody>
                </table>
              </div>
            </div>

            {/* Charts */}
            <div className="charts-row">
              <div className="chart-card" style={{ flex: 1 }}>
                <h4 className="card-title">{intl.get('COMP_LOAD_DISTRIBUTION') || 'Load Distribution'}</h4>
                <svg ref={pieRef} width="100%" height="340"></svg>
              </div>
              <div className="chart-card" style={{ flex: 1.5 }}>
                <h4 className="card-title">{intl.get('COMP_ENERGY_BY_COMPRESSOR') || 'Energy by Compressor'}</h4>
                <svg ref={barRef} width="100%" height="340"></svg>
              </div>
            </div>

            {/* Per-Compressor Table — matching CAA JTableFields layout */}
            <div className="table-card">
              <h4 className="card-title">{intl.get('COMP_COMPRESSOR_DETAILS') || 'Compressor Details'}</h4>
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>{intl.get('COMP_TH_COMPRESSOR') || 'Compressor'}</th>
                      <th>{intl.get('COMP_TH_TYPE') || 'Type'}</th>
                      <th>{intl.get('COMP_TH_FULL_LOAD_H') || 'Full Load (h)'}</th>
                      <th>{intl.get('COMP_TH_FULL_PCT') || 'Full (%)'}</th>
                      <th>{intl.get('COMP_TH_UNLOAD_H') || 'Unload (h)'}</th>
                      <th>{intl.get('COMP_TH_UNLOAD_PCT') || 'Unload (%)'}</th>
                      <th>{intl.get('COMP_TH_NO_LOAD_H') || 'No Load (h)'}</th>
                      <th>{intl.get('COMP_TH_TOTAL_H') || 'Total (h)'}</th>
                      <th>{intl.get('COMP_TH_STARTS') || 'Starts (#)'}</th>
                      <th>{intl.get('COMP_TH_CYCLES') || 'Cycles (#)'}</th>
                      <th>{intl.get('COMP_TH_ENERGY_KWH') || 'Energy (kWh)'}</th>
                      <th>{intl.get('COMP_TH_COST_EUR') || 'Cost (€)'}</th>
                      <th>{intl.get('COMP_MAX_FLOW') || 'Max Flow'}</th>
                      <th>{intl.get('COMP_TH_AVG_FLOW') || 'Avg Flow'}</th>
                      <th>{intl.get('COMP_TH_SPEC_POWER') || 'Spec. Power'}</th>
                      {showCO2 && <th>{intl.get('COMP_TH_CO2_KG') || 'CO₂ (kg)'}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {compressors.filter(c => c.Selected).map((c, i) => (
                      <tr key={i}>
                        <td><strong>{c.Description}</strong></td>
                        <td>{c.Type === COMPRESSOR_TYPE_VARIABLE_FREQUENCY ? 'VF' : 'L/U'}</td>
                        <td>{fmtHrs(c.FullLoadHours)}</td>
                        <td>{fmtPct(c.FullLoadPercentageMeasurementInterval)}</td>
                        <td>{fmtHrs(c.UnLoadHours)}</td>
                        <td>{fmtPct(c.UnLoadPercentageMeasurementInterval)}</td>
                        <td>{fmtHrs(c.NoLoadHours)}</td>
                        <td>{fmtHrs(c.TotalHours)}</td>
                        <td>{fmt(c.NumStarts, 0)}</td>
                        <td>{fmt(c.NumOfLoad_UnloadChanges, 0)}</td>
                        <td>{fmtKwh(c.TotalEnergyConsumption)}</td>
                        <td>{fmtCost(c.TotalCost)}</td>
                        <td>{fmtFlow(c.MaxFlow)}</td>
                        <td>{fmtFlow(c.AverageFlow)}</td>
                        <td>{fmt(c.SpecificPower, 4)}</td>
                        {showCO2 && <td>{fmt(c.CO2Emmision, 2)}</td>}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="footer-total-row">
                      <td><strong>{intl.get('COMP_TOTAL') || 'Total'}</strong></td>
                      <td></td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.FullLoadHours, 0))}</td>
                      <td></td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.UnLoadHours, 0))}</td>
                      <td></td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.NoLoadHours, 0))}</td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.TotalHours, 0))}</td>
                      <td>{fmt(compressors.reduce((s, c) => s + c.NumStarts, 0), 0)}</td>
                      <td>{fmt(compressors.reduce((s, c) => s + c.NumOfLoad_UnloadChanges, 0), 0)}</td>
                      <td>{fmtKwh(compressors.reduce((s, c) => s + c.TotalEnergyConsumption, 0))}</td>
                      <td>{fmtCost(compressors.reduce((s, c) => s + c.TotalCost, 0))}</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      {showCO2 && <td>{fmt(compressors.reduce((s, c) => s + c.CO2Emmision, 0), 2)}</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 1-Year Projection Table */}
            <div className="table-card">
              <h4 className="card-title">{intl.get('COMP_1YR_PROJECTION') || '1-Year Projection'}</h4>
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>{intl.get('COMP_TH_COMPRESSOR') || 'Compressor'}</th>
                      <th>{intl.get('COMP_TH_ENERGY_KWH') || 'Energy (kWh)'}</th>
                      <th>{intl.get('COMP_TH_COST_EUR') || 'Cost (€)'}</th>
                      <th>{intl.get('COMP_TH_FULL_LOAD_H') || 'Full Load (h)'}</th>
                      <th>{intl.get('COMP_TH_UNLOAD_H') || 'Unload (h)'}</th>
                      <th>{intl.get('COMP_TH_NO_LOAD_H') || 'No Load (h)'}</th>
                      {showCO2 && <th>{intl.get('COMP_TH_CO2_KG') || 'CO₂ (kg)'}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {compressors.filter(c => c.Selected).map((c, i) => (
                      <tr key={i}>
                        <td><strong>{c.Description}</strong></td>
                        <td>{fmtKwh(c.TotalEnergyConsumptionOneYear)}</td>
                        <td>{fmtCost(c.TotalCostOneYear)}</td>
                        <td>{fmtHrs(c.FullLoadHoursOneYear)}</td>
                        <td>{fmtHrs(c.UnLoadHoursOneYear)}</td>
                        <td>{fmtHrs(c.NoLoadHoursOneYear)}</td>
                        {showCO2 && <td>{fmt(c.CO2EmmisionOneYear, 2)}</td>}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="footer-total-row">
                      <td><strong>{intl.get('COMP_TOTAL') || 'Total'}</strong></td>
                      <td>{fmtKwh(systemResult.totalEnergyConsumptionOneYear)}</td>
                      <td>{fmtCost(systemResult.totalCostOneYear)}</td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.FullLoadHoursOneYear, 0))}</td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.UnLoadHoursOneYear, 0))}</td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.NoLoadHoursOneYear, 0))}</td>
                      {showCO2 && <td>{fmt(compressors.reduce((s, c) => s + c.CO2EmmisionOneYear, 0), 2)}</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state-container">
            <p>{intl.get('COMP_CLICK_RUN_TO_START') || 'Click "Run Analysis" to start.'}</p>
          </div>
        )}
      </main>

      {/* Per-Compressor Configuration Dialog */}
      <Dialog maxWidth="md" fullWidth open={settingsOpen} onClose={() => setSettingsOpen(false)} className="compressor-settings-dialog">
        <DialogTitle style={{ fontWeight: '800', color: '#0f172a' }}>
          {intl.get('COMP_CONFIGURE_COMPRESSORS') || 'Configure Compressors'}
        </DialogTitle>
        <DialogContent dividers>
          {editingCompressors.length > 0 ? (
            <div className="compressor-dialog-body" style={{ display: 'flex', gap: '20px', minHeight: '400px' }}>
              {/* Left pane: Selector */}
              <div style={{ width: '220px', borderRight: '1px solid #e2e8f0', paddingRight: '16px' }}>
                <div style={{ fontWeight: '700', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>
                  {intl.get('COMP_COMPRESSOR_LIST') || 'Compressor List'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {editingCompressors.map((c, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedCompIdx(idx)}
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        backgroundColor: selectedCompIdx === idx ? '#e2f5f1' : 'transparent',
                        color: selectedCompIdx === idx ? '#00ac86' : '#475569',
                        transition: 'all 0.2s'
                      }}
                    >
                      {c.Description || `Compressor ${c.Unit}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right pane: Form Fields */}
              <div style={{ flex: 1, paddingLeft: '4px' }}>
                {editingCompressors[selectedCompIdx] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>
                        {intl.get('COMP_SETTINGS_FOR') || 'Settings for'} {editingCompressors[selectedCompIdx].Description || `Compressor ${editingCompressors[selectedCompIdx].Unit}`}
                      </h4>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={editingCompressors[selectedCompIdx].Selected}
                            onChange={(e) => handleUpdateEditingComp('Selected', e.target.checked)}
                            color="primary"
                          />
                        }
                        label={<span style={{ fontWeight: '700', fontSize: '13px', color: '#475569' }}>{intl.get('COMP_INCLUDE_IN_ANALYSIS') || 'Include in analysis'}</span>}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
                      <TextField
                        label={intl.get('COMP_DESCRIPTION') || 'Description'}
                        value={editingCompressors[selectedCompIdx].Description}
                        onChange={(e) => handleUpdateEditingComp('Description', e.target.value)}
                        fullWidth
                        size="small"
                      />
                      <FormControl fullWidth size="small">
                        <InputLabel>{intl.get('COMP_COMPRESSOR_TYPE') || 'Compressor Type'}</InputLabel>
                        <Select
                          value={editingCompressors[selectedCompIdx].Type}
                          label={intl.get('COMP_COMPRESSOR_TYPE') || 'Compressor Type'}
                          onChange={(e) => handleUpdateEditingComp('Type', e.target.value)}
                        >
                          <MenuItem value={COMPRESSOR_TYPE_LOAD_UNLOAD}>{intl.get('COMP_LOAD_UNLOAD') || 'Load / Unload'}</MenuItem>
                          <MenuItem value={COMPRESSOR_TYPE_VARIABLE_FREQUENCY}>{intl.get('COMP_VARIABLE_FREQUENCY') || 'Variable Frequency'}</MenuItem>
                        </Select>
                      </FormControl>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>{intl.get('COMP_FLOW_CHANNEL_OPTIONAL') || 'Flow Channel (optional)'}</InputLabel>
                        <Select
                          value={editingCompressors[selectedCompIdx].flowChannelId || ''}
                          label={intl.get('COMP_FLOW_CHANNEL_OPTIONAL') || 'Flow Channel (optional)'}
                          onChange={(e) => handleUpdateEditingComp('flowChannelId', e.target.value || null)}
                        >
                          <MenuItem value="">{intl.get('COMP_NONE') || 'None'}</MenuItem>
                          {flowChannels.map((ch) => (
                            <MenuItem key={ch.channel_id} value={ch.channel_id}>
                              {ch.full_channel_name || ch.logic_channel_description || ch.channel_id}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </div>

                    {editingCompressors[selectedCompIdx].Type === COMPRESSOR_TYPE_LOAD_UNLOAD ? (
                      /* Load / Unload Settings */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px' }}>
                        <div style={{ fontWeight: '800', fontSize: '12px', color: '#00ac86', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {intl.get('COMP_FIXED_SPEED_CONFIG') || 'Fixed Speed Configuration'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <TextField
                            label={`${intl.get('COMP_AIR_DELIVERY') || 'Air Delivery'} (${editingCompressors[selectedCompIdx].AirDeliveryUnit || 'm³/h'})`}
                            type="number"
                            value={editingCompressors[selectedCompIdx].FullLoadAirDelivery}
                            onChange={(e) => handleUpdateEditingComp('FullLoadAirDelivery', parseFloat(e.target.value) || 0)}
                            size="small"
                            fullWidth
                          />
                          <TextField
                            label={`${intl.get('COMP_LOAD_THRESHOLD') || 'Load Threshold'} (${editingCompressors[selectedCompIdx].hasPowerChannel ? 'kW' : 'A'})`}
                            type="number"
                            value={editingCompressors[selectedCompIdx].FullLoadCurrentThreshold}
                            onChange={(e) => handleUpdateEditingComp('FullLoadCurrentThreshold', parseFloat(e.target.value) || 0)}
                            size="small"
                            fullWidth
                            helperText={intl.get('COMP_LOAD_THRESHOLD_HELP') || 'Above this value is classified as Full Load'}
                          />
                          <TextField
                            label={`${intl.get('COMP_UNLOAD_STOP_THRESHOLD') || 'Unload/Stop Threshold'} (${editingCompressors[selectedCompIdx].hasPowerChannel ? 'kW' : 'A'})`}
                            type="number"
                            value={editingCompressors[selectedCompIdx].NoLoadCurrentThreshold}
                            onChange={(e) => handleUpdateEditingComp('NoLoadCurrentThreshold', parseFloat(e.target.value) || 0)}
                            size="small"
                            fullWidth
                            helperText={intl.get('COMP_UNLOAD_STOP_THRESHOLD_HELP') || 'Below this value is classified as stopped/no-load'}
                          />
                        </div>

                        {!editingCompressors[selectedCompIdx].hasPowerChannel && (
                          <>
                            <div style={{ fontWeight: '800', fontSize: '12px', color: '#64748b', marginTop: '4px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {intl.get('COMP_NOMINAL_CURRENT_COSPHI') || 'Nominal Current & Cos Phi Parameters'}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                              <TextField
                                label={intl.get('COMP_FULL_LOAD_A') || 'Full Load (A)'}
                                type="number"
                                value={editingCompressors[selectedCompIdx].FullLoadCurrent}
                                onChange={(e) => handleUpdateEditingComp('FullLoadCurrent', parseFloat(e.target.value) || 0)}
                                size="small"
                              />
                              <TextField
                                label={intl.get('COMP_UNLOAD_A') || 'Unload (A)'}
                                type="number"
                                value={editingCompressors[selectedCompIdx].UnLoadCurrent}
                                onChange={(e) => handleUpdateEditingComp('UnLoadCurrent', parseFloat(e.target.value) || 0)}
                                size="small"
                              />
                              <TextField
                                label={intl.get('COMP_FULL_COS_PHI') || 'Full Cos Phi'}
                                type="number"
                                inputProps={{ step: '0.01', min: '0', max: '1' }}
                                value={editingCompressors[selectedCompIdx].FullLoadCosP}
                                onChange={(e) => handleUpdateEditingComp('FullLoadCosP', parseFloat(e.target.value) || 0.86)}
                                size="small"
                              />
                              <TextField
                                label={intl.get('COMP_UNLOAD_COS_PHI') || 'Unload Cos Phi'}
                                type="number"
                                inputProps={{ step: '0.01', min: '0', max: '1' }}
                                value={editingCompressors[selectedCompIdx].UnLoadCosP}
                                onChange={(e) => handleUpdateEditingComp('UnLoadCosP', parseFloat(e.target.value) || 0.5)}
                                size="small"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      /* Variable Frequency Settings */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px' }}>
                        <div style={{ fontWeight: '800', fontSize: '12px', color: '#00ac86', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {intl.get('COMP_VFD_PRESETS') || 'Variable Frequency Drive Presets'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <FormControl fullWidth size="small">
                            <InputLabel>{intl.get('COMP_MOTOR_POWER_KW') || 'Motor Power (kW)'}</InputLabel>
                            <Select
                              value={editingCompressors[selectedCompIdx].VFMotorPower}
                              label={intl.get('COMP_MOTOR_POWER_KW') || 'Motor Power (kW)'}
                              onChange={(e) => handleUpdateEditingComp('VFMotorPower', e.target.value)}
                            >
                              {[22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250].map((val) => (
                                <MenuItem key={val} value={val}>{val} kW</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl fullWidth size="small">
                            <InputLabel>{intl.get('COMP_SYSTEM_PRESSURE_BAR') || 'System Pressure (bar)'}</InputLabel>
                            <Select
                              value={editingCompressors[selectedCompIdx].VFSystemPressure}
                              label={intl.get('COMP_SYSTEM_PRESSURE_BAR') || 'System Pressure (bar)'}
                              onChange={(e) => handleUpdateEditingComp('VFSystemPressure', e.target.value)}
                            >
                              {[7.5, 10, 13].map((val) => (
                                <MenuItem key={val} value={val}>{val} bar</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </div>
                        
                        <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px dashed #cbd5e1', fontSize: '11px', color: '#475569' }}>
                          <div style={{ fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0f172a' }}>{intl.get('COMP_COMPUTED_VF_CURVE') || 'Computed VF Curve Parameters:'}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                            <div>{intl.get('COMP_MIN_FLOW') || 'Min Flow'}: <strong>{editingCompressors[selectedCompIdx].VFAirDeliveryMin} m³/min</strong></div>
                            <div>{intl.get('COMP_P2_FLOW') || 'P2 Flow'}: <strong>{editingCompressors[selectedCompIdx].VFAirDeliveryP2} m³/min</strong></div>
                            <div>{intl.get('COMP_P3_FLOW') || 'P3 Flow'}: <strong>{editingCompressors[selectedCompIdx].VFAirDeliveryP3} m³/min</strong></div>
                            <div>{intl.get('COMP_MAX_FLOW') || 'Max Flow'}: <strong>{editingCompressors[selectedCompIdx].VFAirDeliveryMax} m³/min</strong></div>
                            <div>Min {editingCompressors[selectedCompIdx].hasPowerChannel ? 'Power' : 'Amp'}: <strong>{editingCompressors[selectedCompIdx].hasPowerChannel ? `${editingCompressors[selectedCompIdx].VFPowerMin} kW` : `${editingCompressors[selectedCompIdx].VFAmpMin.toFixed(1)} A`}</strong></div>
                            <div>P2 {editingCompressors[selectedCompIdx].hasPowerChannel ? 'Power' : 'Amp'}: <strong>{editingCompressors[selectedCompIdx].hasPowerChannel ? `${editingCompressors[selectedCompIdx].VFPowerP2} kW` : `${editingCompressors[selectedCompIdx].VFAmpP2.toFixed(1)} A`}</strong></div>
                            <div>P3 {editingCompressors[selectedCompIdx].hasPowerChannel ? 'Power' : 'Amp'}: <strong>{editingCompressors[selectedCompIdx].hasPowerChannel ? `${editingCompressors[selectedCompIdx].VFPowerP3} kW` : `${editingCompressors[selectedCompIdx].VFAmpP3.toFixed(1)} A`}</strong></div>
                            <div>Max {editingCompressors[selectedCompIdx].hasPowerChannel ? 'Power' : 'Amp'}: <strong>{editingCompressors[selectedCompIdx].hasPowerChannel ? `${editingCompressors[selectedCompIdx].VFPowerMax} kW` : `${editingCompressors[selectedCompIdx].VFAmpMax.toFixed(1)} A`}</strong></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              {intl.get('COMP_NO_COMPRESSORS_DISCOVERED') || 'No compressors discovered in the loaded file yet. Run analysis once to populate.'}
            </div>
          )}
        </DialogContent>
        <DialogActions style={{ padding: '16px 24px' }}>
          <Button onClick={() => setSettingsOpen(false)}>{intl.get('CANCEL') || 'Cancel'}</Button>
          <Button
            onClick={handleSaveSettings}
            color="primary"
            variant="contained"
            disabled={editingCompressors.length === 0}
            style={{ fontWeight: '700', borderRadius: '6px' }}
          >
            {intl.get('COMP_APPLY_CONFIGURATIONS') || 'Apply Configurations'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
