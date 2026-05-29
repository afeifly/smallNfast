/**
 * CompressorAnalyze.jsx
 *
 * Port of the CAA desktop app's statistics report dialog to the web.
 * Shows per-compressor load analysis, system totals, and d3 charts.
 */

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import TestAPI from '../../api/TestAPI';
import { Compressor, createDefaultCompressor, COMPRESSOR_TYPE_LOAD_UNLOAD, COMPRESSOR_TYPE_VARIABLE_FREQUENCY } from '../../analysis/CompressorEngine.js';
import { analyzeSystem, extractChannelData, classifyChannel } from '../../analysis/LeakEngine.js';
import './Analyze.css';

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
const fmtCost = (c) => '\u20AC' + fmt(c, 2);
const fmtPct = (p) => (p * 100).toFixed(1) + '%';
const fmtFlow = (v) => fmt(v, 2);

const CHART_COLORS = ['#00ac86', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

// ── Main Component ───────────────────────────────────────────────────────────

export default function CompressorAnalyze() {
  const [compressors, setCompressors] = useState([]);
  const [systemResult, setSystemResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Settings
  const [energyCost, setEnergyCost] = useState(0.1);
  const [voltage, setVoltage] = useState(400);
  const [leakThreshold, setLeakThreshold] = useState(0);

  // Refs for d3 charts
  const pieRef = useRef(null);
  const barRef = useRef(null);

  // Run analysis when data or settings change
  useEffect(() => {
    if (!TestAPI.isFileLoaded || !TestAPI.isFileLoaded()) return;
    runAnalysis();
  }, [energyCost, voltage, leakThreshold]);

  // Draw charts when results change
  useEffect(() => {
    if (systemResult && compressors.length > 0) {
      drawPieChart();
      drawBarChart();
    }
  }, [systemResult, compressors]);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get channels from the loaded file
      const channels = await new Promise((resolve) => {
        TestAPI.getChannels((res) => resolve(res ? res.logging_chs || [] : []));
      });

      if (!channels || channels.length === 0) {
        setError('No channels found in the loaded file.');
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
        const rows = await new Promise((resolve) => {
          TestAPI.getTablePage(page, pageSize, channels.map((ch) => ch.channel_id), (res) => resolve(res || []));
        });
        if (rows && rows.length) allRows = allRows.concat(rows);
      }

      // Classify channels
      const currentChs = channels.filter((ch) => classifyChannel(ch.unit_in_ascii) === 'current');
      const flowChs = channels.filter((ch) => classifyChannel(ch.unit_in_ascii) === 'flow');

      // Build compressor configs from current channels
      const comps = [];
      if (currentChs.length > 0) {
        for (const ch of currentChs) {
          const comp = createDefaultCompressor(COMPRESSOR_TYPE_LOAD_UNLOAD);
          comp.Description = ch.logic_channel_description || ch.sensor_description || `Compressor ${ch.channel_id}`;
          comp.Unit = ch.channel_id;
          comp.FullLoadCurrentThreshold = 4; // default threshold — user adjusts in settings
          comp.FullLoadAirDelivery = 10;      // placeholder — user sets per compressor
          comp.SupplyVoltage = voltage;
          comps.push(comp);
        }
      } else if (flowChs.length > 0) {
        // Use flow channels directly
        for (const ch of flowChs) {
          const comp = createDefaultCompressor(COMPRESSOR_TYPE_LOAD_UNLOAD);
          comp.Description = ch.logic_channel_description || ch.sensor_description || `Flow ${ch.channel_id}`;
          comp.Unit = ch.channel_id;
          comp.FullLoadCurrentThreshold = 0.5;
          comp.FullLoadAirDelivery = ch.maxValue || 100;
          comp.SupplyVoltage = voltage;
          comps.push(comp);
        }
      }

      if (comps.length === 0) {
        setError('No current (A) or flow channels found. Add current sensors to enable compressor analysis.');
        setLoading(false);
        return;
      }

      // Build channel data map
      const dataMap = new Map();
      for (const comp of comps) {
        const data = extractChannelData(allRows, comp.Unit);
        if (data.length > 0) dataMap.set(comp.Unit, data);
      }

      // Run the analysis engine
      const result = analyzeSystem(comps, dataMap, sampleIntervalSec, {
        energyCostPerKwh: energyCost,
        voltage,
        leakThreshold,
      });

      setCompressors(result.compressors);
      setSystemResult(result.system);
    } catch (e) {
      console.error('Analysis error:', e);
      setError('Analysis failed: ' + e.message);
    }

    setLoading(false);
  };

  // ── d3 Pie Chart: Load Distribution ──

  const drawPieChart = () => {
    const svgEl = pieRef.current;
    if (!svgEl) return;

    const width = svgEl.clientWidth || 400;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 40;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

    const totalHours = compressors.reduce((s, c) => s + c.TotalHours, 0);

    const pieData = [
      { label: 'Full Load', value: compressors.reduce((s, c) => s + c.FullLoadHours, 0), color: '#00ac86' },
      { label: 'Unload', value: compressors.reduce((s, c) => s + c.UnLoadHours, 0), color: '#f59e0b' },
      { label: 'No Load', value: compressors.reduce((s, c) => s + c.NoLoadHours, 0), color: '#ef4444' },
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

    // Legend
    const legend = svg.append('g').attr('transform', `translate(0, ${height + 10})`);
    pieData.forEach((d, i) => {
      const leg = legend.append('g').attr('transform', `translate(${i * 130}, 0)`);
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

    const width = svgEl.clientWidth || 500;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

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
      .attr('transform', 'rotate(-20)')
      .attr('font-size', 10);

    const yAxis = d3.axisLeft(y).ticks(6);
    svg.append('g').attr('transform', `translate(${margin.left}, 0)`).call(yAxis);

    svg.append('text')
      .attr('x', margin.left + 10).attr('y', 14).attr('font-size', 11).attr('fill', '#64748b')
      .text('kWh');

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${margin.left}, ${height - margin.bottom + 40})`);
    const legData = [
      { label: 'Full Load', color: '#00ac86' },
      { label: 'Unload', color: '#f59e0b' },
      { label: 'No Load', color: '#ef4444' },
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
          <h3 className="empty-state-title">Compressor Analysis</h3>
          <p className="empty-state-desc">Open a CSD file to run compressor analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analyze-container">
      {/* Sidebar Settings */}
      <aside className="analyze-sidebar">
        <h3 className="sidebar-section-title">Settings</h3>

        <div className="sidebar-input-group">
          <label className="sidebar-label">Energy Cost (€/kWh)</label>
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
          <label className="sidebar-label">Supply Voltage (V)</label>
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
          <label className="sidebar-label">Leak Threshold Flow</label>
          <input
            className="sidebar-input"
            type="number"
            step="0.1"
            min="0"
            value={leakThreshold}
            onChange={(e) => setLeakThreshold(parseFloat(e.target.value) || 0)}
          />
        </div>

        <button className="sidebar-reload-btn" onClick={runAnalysis} disabled={loading}>
          {loading ? 'Analyzing...' : 'Run Analysis'}
        </button>

        {error && <div className="analyze-error">{error}</div>}
      </aside>

      {/* Main Content */}
      <main className="analyze-main-content">
        {loading ? (
          <div className="empty-state-container">
            <p>Analyzing compressor data...</p>
          </div>
        ) : systemResult ? (
          <>
            {/* System Summary Cards */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon-wrap primary"><Icons.Energy /></div>
                <div className="metric-info">
                  <span className="metric-label">Total Energy</span>
                  <span className="metric-value">{fmtKwh(systemResult.totalEnergyConsumption)}</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon-wrap warning"><Icons.Dollar /></div>
                <div className="metric-info">
                  <span className="metric-label">Total Cost</span>
                  <span className="metric-value">{fmtCost(systemResult.totalCost)}</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon-wrap info"><Icons.Clock /></div>
                <div className="metric-info">
                  <span className="metric-label">Full Load Hours</span>
                  <span className="metric-value">{fmtHrs(systemResult.totalFullLoadHours)}</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon-wrap warning"><Icons.Droplet /></div>
                <div className="metric-info">
                  <span className="metric-label">Total Leakage</span>
                  <span className="metric-value">{fmt(systemResult.totalLeakage, 1)} m³</span>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="charts-row">
              <div className="chart-card" style={{ flex: 1 }}>
                <h4 className="card-title">Load Distribution</h4>
                <svg ref={pieRef} width="100%" height="340"></svg>
              </div>
              <div className="chart-card" style={{ flex: 1.5 }}>
                <h4 className="card-title">Energy by Compressor</h4>
                <svg ref={barRef} width="100%" height="340"></svg>
              </div>
            </div>

            {/* Per-Compressor Table */}
            <div className="table-card">
              <h4 className="card-title">Compressor Details</h4>
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Compressor</th>
                      <th>Type</th>
                      <th>Full Load (h)</th>
                      <th>Unload (h)</th>
                      <th>No Load (h)</th>
                      <th>Total (h)</th>
                      <th>Full Load (%)</th>
                      <th>Energy (kWh)</th>
                      <th>Cost (€)</th>
                      <th>Avg Flow</th>
                      <th>CO₂ (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compressors.filter(c => c.Selected).map((c, i) => (
                      <tr key={i}>
                        <td><strong>{c.Description}</strong></td>
                        <td>{c.Type === COMPRESSOR_TYPE_VARIABLE_FREQUENCY ? 'VF' : 'L/U'}</td>
                        <td>{fmtHrs(c.FullLoadHours)}</td>
                        <td>{fmtHrs(c.UnLoadHours)}</td>
                        <td>{fmtHrs(c.NoLoadHours)}</td>
                        <td>{fmtHrs(c.TotalHours)}</td>
                        <td>{fmtPct(c.FullLoadPercentageMeasurementInterval)}</td>
                        <td>{fmtKwh(c.TotalEnergyConsumption)}</td>
                        <td>{fmtCost(c.TotalCost)}</td>
                        <td>{fmtFlow(c.AverageFlow)}</td>
                        <td>{fmt(c.CO2Emmision, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="footer-total-row">
                      <td><strong>Total</strong></td>
                      <td></td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.FullLoadHours, 0))}</td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.UnLoadHours, 0))}</td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.NoLoadHours, 0))}</td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.TotalHours, 0))}</td>
                      <td></td>
                      <td>{fmtKwh(compressors.reduce((s, c) => s + c.TotalEnergyConsumption, 0))}</td>
                      <td>{fmtCost(compressors.reduce((s, c) => s + c.TotalCost, 0))}</td>
                      <td></td>
                      <td>{fmt(compressors.reduce((s, c) => s + c.CO2Emmision, 0), 2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 1-Year Projection Table */}
            <div className="table-card">
              <h4 className="card-title">1-Year Projection</h4>
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Compressor</th>
                      <th>Energy (kWh)</th>
                      <th>Cost (€)</th>
                      <th>Full Load (h)</th>
                      <th>Unload (h)</th>
                      <th>No Load (h)</th>
                      <th>CO₂ (kg)</th>
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
                        <td>{fmt(c.CO2EmmisionOneYear, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="footer-total-row">
                      <td><strong>Total</strong></td>
                      <td>{fmtKwh(systemResult.totalEnergyConsumptionOneYear)}</td>
                      <td>{fmtCost(systemResult.totalCostOneYear)}</td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.FullLoadHoursOneYear, 0))}</td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.UnLoadHoursOneYear, 0))}</td>
                      <td>{fmtHrs(compressors.reduce((s, c) => s + c.NoLoadHoursOneYear, 0))}</td>
                      <td>{fmt(compressors.reduce((s, c) => s + c.CO2EmmisionOneYear, 0), 2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state-container">
            <p>Click "Run Analysis" to start.</p>
          </div>
        )}
      </main>
    </div>
  );
}
