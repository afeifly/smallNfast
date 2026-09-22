import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DataModifierEngine from './DataModifierEngine';
import TestAPI from '../../api/TestAPI';
import './css/DataModifierModal.css';

const DEFAULT_COLORS = [
  '#00ac86', '#FF5630', '#00B8D9', '#6554C0',
  '#FFAB00', '#36B37E', '#FFC400', '#FF7452',
  '#57D9A3', '#172B4D', '#E91E63', '#9C27B0'
];

function formatDateTime(ms) {
  if (!ms || isNaN(ms)) return '';
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseDateTime(str, fallbackMs) {
  if (!str) return fallbackMs;
  const d = new Date(str.trim().replace(' ', 'T'));
  return !isNaN(d.getTime()) ? d.getTime() : fallbackMs;
}

export default function DataModifierModal({ open, onClose, onFileReloaded }) {
  const [activeTab, setActiveTab] = useState('formulas'); // 'formulas' | 'extend' | 'realtime'
  const [baseMeta, setBaseMeta] = useState(null);
  const [loadingBase, setLoadingBase] = useState(false);
  const [showFormulaNote, setShowFormulaNote] = useState(false);

  // 0. Channel deletion / exclusion
  const [removedChannelIds, setRemovedChannelIds] = useState([]);
  const [channelToDelete, setChannelToDelete] = useState(null);

  // ── Transformation Config States ──────────────────────────────────────────
  // 1. Unified Formula Channels
  const [formulaChannels, setFormulaChannels] = useState([]);
  const [formulaExpr, setFormulaExpr] = useState('ch1 * 2');
  const [formulaMode, setFormulaMode] = useState('new_channel'); // 'new_channel' | 'replace'
  const [formulaTargetChId, setFormulaTargetChId] = useState(0);
  const [formulaNewName, setFormulaNewName] = useState('');
  const [formulaNewUnit, setFormulaNewUnit] = useState('');
  const [formulaResolution, setFormulaResolution] = useState(2); // 0-6 decimal places
  const [formulaValidation, setFormulaValidation] = useState({ valid: true, error: null, sampleCalc: '' });

  // (Backward compat legacy states)
  const [combinedChannels, setCombinedChannels] = useState([]);
  const [combChA, setCombChA] = useState(0);
  const [combOp, setCombOp] = useState('+');
  const [combChB, setCombChB] = useState(0);
  const [combName, setCombName] = useState('');
  const [combUnit, setCombUnit] = useState('');

  const [scaledChannels, setScaledChannels] = useState([]);
  const [scaleChId, setScaleChId] = useState(0);
  const [scaleMultiplier, setScaleMultiplier] = useState(2.0);
  const [scaleOffset, setScaleOffset] = useState(0.0);
  const [scaleMode, setScaleMode] = useState('replace'); // 'replace' | 'new_channel'

  // 2. Time extension & Cutdown
  const [timeExtEnabled, setTimeExtEnabled] = useState(false);
  const [extraMinutes, setExtraMinutes] = useState(60);
  const [channelRules, setChannelRules] = useState({});

  const [cutdownEnabled, setCutdownEnabled] = useState(false);
  const [cutMinutes, setCutMinutes] = useState(30);
  const [cutPosition, setCutPosition] = useState('end'); // 'end' | 'start'

  // 3. Consumption target solver
  const [consumptionSolvers, setConsumptionSolvers] = useState({});

  // 4. Real-time data modification states
  const [realtimeStartSample, setRealtimeStartSample] = useState(0);
  const [realtimePageSize, setRealtimePageSize] = useState(15); // 15, 50, 150
  const [realtimeSelectedChs, setRealtimeSelectedChs] = useState([]);
  const [realtimeRows, setRealtimeRows] = useState([]);
  const [realtimeLoading, setRealtimeLoading] = useState(false);
  const [cellOverrides, setCellOverrides] = useState({}); // { [recordIndex]: { [chId]: number } }
  const [isSavingOld, setIsSavingOld] = useState(false);
  const vWrapperRef = useRef(null); // ref on track-wrapper for label-based DND

  // ── Preview & Export States ───────────────────────────────────────────────
  const [previewData, setPreviewData] = useState(null);
  const [visibleChannels, setVisibleChannels] = useState({});
  const [autoOpenAfterExport, setAutoOpenAfterExport] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const chartSvgRef = useRef(null);

  // Load initial file metadata on modal open
  useEffect(() => {
    if (open) {
      setLoadingBase(true);
      DataModifierEngine.getBaseMetadata().then((meta) => {
        setBaseMeta(meta);
        setLoadingBase(false);

        if (meta.channels && meta.channels.length > 0) {
          setCombChA(meta.channels[0].channel_id);
          setCombChB(meta.channels[meta.channels.length > 1 ? 1 : 0].channel_id);
          setScaleChId(meta.channels[0].channel_id);
          setFormulaTargetChId(meta.channels[0].channel_id);
          setFormulaNewUnit(meta.channels[0].unit || '');

          // Initialize channel extension rules
          const initialRules = {};
          meta.channels.forEach((ch) => {
            initialRules[ch.channel_id] = {
              mode: 'bounded_random',
              min: Math.round(ch.min * 100) / 100,
              max: Math.round(ch.max * 100) / 100,
              constantVal: Math.round(ch.lastVal * 100) / 100,
            };
          });
          setChannelRules(initialRules);

          // Initialize Real-time Data Modification parameters
          if (meta.channels && meta.channels.length > 0) {
            setRealtimeSelectedChs(meta.channels.map((c) => c.channel_id));
          }
          setRealtimeStartSample(0);
        }
      });
      setRemovedChannelIds([]);
      setFormulaChannels([]);
      setTimeExtEnabled(false);
      setCutdownEnabled(false);
      setCutMinutes(30);
      setCutPosition('end');
      setCellOverrides({});
      setRealtimeRows([]);
      setRealtimeStartSample(0);
    } else {
      // Reset progress
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [open]);

  // Real-time formula syntax validator and sample preview calculation
  useEffect(() => {
    if (!baseMeta || !baseMeta.channels || !formulaExpr.trim()) {
      setFormulaValidation({
        valid: false,
        error: 'Enter a formula expression (e.g. ch1 * 2, ch1 + ch2)',
        sampleCalc: '',
      });
      return;
    }

    const intervalSec = baseMeta.sampleRate > 0 ? 1 / baseMeta.sampleRate : 1;
    const res = DataModifierEngine.compileFormula(formulaExpr, baseMeta.channels, intervalSec);
    if (!res.valid) {
      setFormulaValidation({ valid: false, error: res.error, sampleCalc: '' });
    } else if (res.isIntegral) {
      setFormulaValidation({
        valid: true,
        error: null,
        sampleCalc: `Cumulative integration ∫(channel × dt) — accumulates over all samples. Result unit = source unit × seconds.`,
      });
    } else {
      // Sample calculation using first sample or min values
      const sampleVals = {};
      baseMeta.channels.forEach((ch) => {
        sampleVals[ch.channel_id] = typeof ch.firstVal === 'number' && !isNaN(ch.firstVal) ? ch.firstVal : ch.min;
      });
      const calcResult = res.eval(sampleVals);
      const sampleStr = calcResult !== null && !isNaN(calcResult)
        ? `Syntax valid. Sample #1 result: ${calcResult.toFixed(2)}`
        : 'Syntax valid';
      setFormulaValidation({ valid: true, error: null, sampleCalc: sampleStr });
    }
  }, [formulaExpr, baseMeta]);

  // Auto-detect target channel and replace mode from formula expression (e.g. "ch5 x 10" or "ch5 = ch5 x 10")
  useEffect(() => {
    if (!baseMeta || !baseMeta.channels) return;
    const trimmed = formulaExpr.trim();
    // Check leading assignment syntax like "ch5 = ..." or "ch5 := ..."
    const assignMatch = trimmed.match(/^(?:ch|channel)\s*(\d+)\s*(?:=|:=|:|->)\s*(.+)$/i);
    if (assignMatch) {
      const chNum = parseInt(assignMatch[1], 10);
      if (chNum >= 1 && chNum <= baseMeta.channels.length) {
        const found = baseMeta.channels[chNum - 1];
        if (found) {
          setFormulaMode('replace');
          setFormulaTargetChId(found.channel_id);
        }
      }
      return;
    }

    // Check if formula starts with chN (e.g. ch5 x 10, ch5 * 2)
    const startMatch = trimmed.match(/^(?:ch|channel)\s*(\d+)/i);
    if (startMatch) {
      const chNum = parseInt(startMatch[1], 10);
      if (chNum >= 1 && chNum <= baseMeta.channels.length) {
        const found = baseMeta.channels[chNum - 1];
        if (found) {
          setFormulaTargetChId(found.channel_id);
        }
      }
    }
  }, [formulaExpr, baseMeta]);

  // Set default combination name & unit when selection changes
  useEffect(() => {
    if (baseMeta && baseMeta.channels) {
      const chAObj = baseMeta.channels.find((c) => c.channel_id === combChA);
      const chBObj = baseMeta.channels.find((c) => c.channel_id === combChB);
      if (chAObj && chBObj) {
        setCombName(`${chAObj.name} ${combOp} ${chBObj.name}`);
        setCombUnit(chAObj.unit || chBObj.unit || '');
      }
    }
  }, [combChA, combOp, combChB, baseMeta]);

  // Update preview whenever configurations change
  useEffect(() => {
    if (!baseMeta) return;

    const timer = setTimeout(() => {
      // Build effective formula channels: committed ones + active draft if valid
      let effectiveFormulaChannels = [...formulaChannels];
      if (formulaValidation.valid && formulaExpr.trim()) {
        const targetCh = baseMeta.channels.find(
          (c) => c.channel_id === formulaTargetChId || String(c.channel_id) === String(formulaTargetChId)
        );
        const draft = {
          id: 'formula_draft',
          expression: formulaExpr.trim(),
          mode: formulaMode,
          targetChId: formulaTargetChId,
          name: formulaMode === 'replace'
            ? (targetCh ? targetCh.name : formulaExpr.trim())
            : (formulaNewName.trim() || formulaExpr.trim()),
          unit: formulaMode === 'replace'
            ? (targetCh ? targetCh.unit : '')
            : formulaNewUnit.trim(),
          color: '#00ac86',
        };
        if (formulaMode === 'replace') {
          effectiveFormulaChannels = effectiveFormulaChannels.filter(
            (f) => !(f.mode === 'replace' && (f.targetChId === formulaTargetChId || String(f.targetChId) === String(formulaTargetChId)))
          );
          effectiveFormulaChannels.push(draft);
        }
      }

      const config = {
        removedChannelIds,
        combinedChannels,
        scaledChannels,
        formulaChannels: effectiveFormulaChannels,
        timeExtension: {
          enabled: timeExtEnabled,
          extraMinutes,
          channelRules,
        },
        cutdown: {
          enabled: cutdownEnabled,
          cutMinutes: parseInt(cutMinutes, 10) || 0,
          position: cutPosition,
        },
        consumptionSolvers,
      };

      DataModifierEngine.generatePreview(baseMeta, config).then((prev) => {
        setPreviewData(prev);
        // Default visible channels: enable normal measurement channels by default.
        // Keep consumption/totalizer channels unchecked initially as their huge cumulative values
        // compress the scale of standard physical channels (e.g. pressure 0-16 bar).
        setVisibleChannels((prevVisible) => {
          const next = { ...prevVisible };
          prev.channels.forEach((ch) => {
            if (next[ch.channel_id] === undefined) {
              next[ch.channel_id] = !ch.isConsumptionCandidate;
            }
          });
          // Ensure modified target channel is visible
          if (formulaMode === 'replace' && formulaTargetChId !== undefined) {
            next[formulaTargetChId] = true;
          }
          formulaChannels.forEach((fc) => {
            if (fc.mode === 'replace' && fc.targetChId !== undefined) {
              next[fc.targetChId] = true;
            } else if (fc.id) {
              next[fc.id] = true;
            }
          });
          return next;
        });
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [
    baseMeta,
    removedChannelIds,
    combinedChannels,
    scaledChannels,
    formulaChannels,
    formulaExpr,
    formulaMode,
    formulaTargetChId,
    formulaValidation.valid,
    formulaNewName,
    formulaNewUnit,
    timeExtEnabled,
    extraMinutes,
    channelRules,
    cutdownEnabled,
    cutMinutes,
    cutPosition,
    consumptionSolvers,
  ]);

  // ── Render D3 Preview Chart ───────────────────────────────────────────────
  useEffect(() => {
    if (!previewData || !chartSvgRef.current) return;

    const svg = d3.select(chartSvgRef.current);
    svg.selectAll('*').remove();

    const width = chartSvgRef.current.clientWidth || 600;
    const height = chartSvgRef.current.clientHeight || 340;
    const margin = { top: 20, right: 30, bottom: 30, left: 55 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const { allRows, originalRange, extendedRange, hasExtension, channels } = previewData;
    if (allRows.length === 0) return;

    const activeChs = channels.filter((c) => visibleChannels[c.channel_id]);

    // Scales
    const xDomain = hasExtension
      ? [originalRange[0], extendedRange[1]]
      : [originalRange[0], originalRange[1]];

    const xScale = d3.scaleTime().domain(xDomain).range([0, innerWidth]);

    let yMin = Infinity;
    let yMax = -Infinity;

    allRows.forEach((r) => {
      activeChs.forEach((c) => {
        const v = r.values[c.channel_id];
        if (v !== null && v !== undefined && !isNaN(v) && v > -9990) {
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      });
    });

    if (yMin === Infinity || yMax === -Infinity) {
      yMin = 0;
      yMax = 100;
    } else if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    } else {
      const padding = (yMax - yMin) * 0.08;
      yMin -= padding;
      yMax += padding;
    }

    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(''));

    // Shaded extension area
    if (hasExtension && extendedRange[0] < extendedRange[1]) {
      const extX0 = xScale(extendedRange[0]);
      const extX1 = xScale(extendedRange[1]);

      g.append('rect')
        .attr('x', extX0)
        .attr('y', 0)
        .attr('width', Math.max(0, extX1 - extX0))
        .attr('height', innerHeight)
        .attr('fill', 'rgba(0, 172, 134, 0.08)');

      // Dividing vertical dashed line
      g.append('line')
        .attr('x1', extX0)
        .attr('x2', extX0)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#00ac86')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1.5);

      g.append('text')
        .attr('x', extX0 + 6)
        .attr('y', 14)
        .attr('fill', '#00ac86')
        .attr('font-size', 10)
        .attr('font-weight', 700)
        .text('EXTENSION ZONE');
    }

    // Shaded cutdown area & split vertical line
    if (previewData.hasCutdown && previewData.cutSplitTime) {
      const splitX = Math.max(0, Math.min(innerWidth, xScale(previewData.cutSplitTime)));
      const isEndCut = previewData.cutPosition !== 'start';
      const cutX0 = isEndCut ? splitX : 0;
      const cutWidth = isEndCut ? Math.max(0, innerWidth - splitX) : Math.max(0, splitX);

      // Shaded cutdown background
      g.append('rect')
        .attr('x', cutX0)
        .attr('y', 0)
        .attr('width', cutWidth)
        .attr('height', innerHeight)
        .attr('fill', 'rgba(239, 68, 68, 0.12)');

      // Dividing vertical dashed line
      g.append('line')
        .attr('x1', splitX)
        .attr('x2', splitX)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#ef4444')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1.5);

      // Boundary text label
      g.append('text')
        .attr('x', isEndCut ? Math.min(innerWidth - 140, splitX + 6) : 6)
        .attr('y', 14)
        .attr('fill', '#ef4444')
        .attr('font-size', 10)
        .attr('font-weight', 700)
        .text('CUTDOWN ZONE (TRIMMED)');
    }

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(6);
    const yAxis = d3.axisLeft(yScale).ticks(6);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', '#94a3b8')
      .selectAll('text')
      .attr('fill', '#475569')
      .attr('font-size', 10);

    g.append('g')
      .call(yAxis)
      .attr('color', '#94a3b8')
      .selectAll('text')
      .attr('fill', '#475569')
      .attr('font-size', 10);

    // Channel Lines
    activeChs.forEach((ch, idx) => {
      const color = ch.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      const lineGen = d3
        .line()
        .defined((d) => {
          const v = d.values[ch.channel_id];
          return v !== null && v !== undefined && !isNaN(v) && v > -9990;
        })
        .x((d) => xScale(d.timestampMs))
        .y((d) => yScale(d.values[ch.channel_id]));

      g.append('path')
        .datum(allRows)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', ch.isDerived || ch.isModified ? 2.5 : 1.5)
        .attr('stroke-dasharray', ch.isDerived ? '6,2' : null)
        .attr('d', lineGen);
    });
  }, [previewData, visibleChannels]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddCombination = () => {
    if (!combName.trim()) return;
    const newComb = {
      id: `comb_${Date.now()}`,
      name: combName.trim(),
      unit: combUnit.trim(),
      chA: combChA,
      chB: combChB,
      op: combOp,
      resolution: 2,
    };
    setCombinedChannels((prev) => [...prev, newComb]);
  };

  const handleRemoveCombination = (id) => {
    setCombinedChannels((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddScaling = () => {
    const targetCh = baseMeta.channels.find((c) => c.channel_id === scaleChId);
    if (!targetCh) return;

    const newScale = {
      id: `scale_${Date.now()}`,
      sourceChId: scaleChId,
      multiplier: parseFloat(scaleMultiplier) || 1.0,
      offset: parseFloat(scaleOffset) || 0.0,
      mode: scaleMode,
      newName: `${targetCh.name} (x${scaleMultiplier})`,
      newUnit: targetCh.unit,
    };

    setScaledChannels((prev) => {
      // If replacing, remove any prior replace for the same source channel
      const filtered = scaleMode === 'replace' ? prev.filter((s) => s.sourceChId !== scaleChId) : prev;
      return [...filtered, newScale];
    });
  };

  const handleRemoveScaling = (id) => {
    setScaledChannels((prev) => prev.filter((s) => s.id !== id));
  };

  const handleInsertToken = (token) => {
    setFormulaExpr((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return token;
      // If token is an operator and last char is an operator, replace operator
      if (['+', '-', '*', '/'].includes(token) && ['+', '-', '*', '/'].includes(trimmed.slice(-1))) {
        return `${trimmed.slice(0, -1)} ${token} `;
      }
      return `${trimmed} ${token}`;
    });
  };

  const handleAddFormula = () => {
    if (!formulaValidation.valid || !baseMeta) return;

    const targetCh = baseMeta.channels.find(
      (c) => c.channel_id === formulaTargetChId || String(c.channel_id) === String(formulaTargetChId)
    );
    // Detect resolution from referenced channels in the formula
    let detectedResolution = formulaResolution;
    if (baseMeta && baseMeta.channels) {
      const compiled = DataModifierEngine.compileFormula(formulaExpr, baseMeta.channels);
      if (compiled.valid && compiled.referencedChIds && compiled.referencedChIds.length > 0) {
        const refCh = baseMeta.channels.find((c) => compiled.referencedChIds.includes(c.channel_id));
        if (refCh && refCh.resolution !== undefined) detectedResolution = refCh.resolution;
      }
    }

    const newFormula = {
      id: `formula_${Date.now()}`,
      expression: formulaExpr.trim(),
      mode: formulaMode,
      targetChId: formulaTargetChId,
      name: formulaMode === 'replace'
        ? (targetCh ? targetCh.name : formulaExpr.trim())
        : (formulaNewName.trim() || formulaExpr.trim()),
      unit: formulaMode === 'replace'
        ? (targetCh ? targetCh.unit : '')
        : formulaNewUnit.trim(),
      resolution: formulaMode === 'replace'
        ? (targetCh ? (targetCh.resolution ?? 2) : 2)
        : detectedResolution,
      color: DEFAULT_COLORS[(formulaChannels.length + 4) % DEFAULT_COLORS.length],
    };

    setFormulaChannels((prev) => {
      const filtered = formulaMode === 'replace'
        ? prev.filter((f) => !(f.mode === 'replace' && (f.targetChId === formulaTargetChId || String(f.targetChId) === String(formulaTargetChId))))
        : prev;
      return [...filtered, newFormula];
    });

    if (formulaMode === 'replace' && formulaTargetChId !== undefined) {
      setVisibleChannels((prev) => ({ ...prev, [formulaTargetChId]: true }));
    }

    if (window.showAppNotification) {
      window.showAppNotification(
        'Formula Applied',
        formulaMode === 'replace'
          ? `Replaced ${targetCh ? targetCh.name : `ch${formulaTargetChId}`} with ${formulaExpr.trim()}`
          : `Created new channel "${newFormula.name}"`,
        'success'
      );
    }

    setFormulaNewName('');
    setFormulaNewUnit('');
  };

  const handleRemoveFormula = (id) => {
    setFormulaChannels((prev) => prev.filter((f) => f.id !== id));
  };

  const handleRemoveChannel = (chId) => {
    if (typeof chId === 'string' && chId.startsWith('formula_')) {
      setFormulaChannels((prev) => prev.filter((f) => f.id !== chId));
      return;
    }
    if (typeof chId === 'string' && chId.startsWith('comb_')) {
      setCombinedChannels((prev) => prev.filter((c) => c.id !== chId));
      return;
    }
    if (typeof chId === 'string' && chId.startsWith('scale_')) {
      setScaledChannels((prev) => prev.filter((s) => s.id !== chId));
      return;
    }
    setRemovedChannelIds((prev) => (prev.includes(chId) ? prev : [...prev, chId]));
  };

  const handleRestoreChannel = (chId) => {
    setRemovedChannelIds((prev) => prev.filter((id) => id !== chId));
  };

  // ── Real-time Data Modification Handlers ─────────────────────────────────────
  const loadRealtimeRows = useCallback(
    async (startSample, pageSize) => {
      if (!baseMeta || baseMeta.numSamples <= 0) return;
      setRealtimeLoading(true);
      try {
        const s0 = Math.max(0, Math.min(baseMeta.numSamples - 1, startSample));
        const count = Math.min(pageSize, baseMeta.numSamples - s0);
        if (count > 0) {
          const rows = await DataModifierEngine.readSampleRange(s0, count);
          setRealtimeRows(rows);
        } else {
          setRealtimeRows([]);
        }
      } catch (err) {
        console.error('[DataModifierModal] loadRealtimeRows error:', err);
      } finally {
        setRealtimeLoading(false);
      }
    },
    [baseMeta]
  );

  useEffect(() => {
    if (activeTab === 'realtime' && baseMeta) {
      loadRealtimeRows(realtimeStartSample, realtimePageSize);
    }
  }, [activeTab, baseMeta, realtimeStartSample, realtimePageSize, loadRealtimeRows]);

  const updateFromPointerEvent = useCallback(
    (clientY) => {
      if (!vWrapperRef.current || !baseMeta || baseMeta.numSamples <= 1) return;
      const rect = vWrapperRef.current.getBoundingClientRect();
      const relY = Math.max(0, Math.min(rect.height, clientY - rect.top));
      const ratio = rect.height > 0 ? relY / rect.height : 0;
      const targetSample = Math.round(ratio * (baseMeta.numSamples - 1));
      setRealtimeStartSample(targetSample);
    },
    [baseMeta]
  );

  const handleTrackPointerDown = useCallback(
    (e) => {
      e.preventDefault();
      updateFromPointerEvent(e.clientY);

      const onPointerMove = (moveEvt) => {
        updateFromPointerEvent(moveEvt.clientY);
      };
      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [updateFromPointerEvent]
  );

  const handleNudge = useCallback(
    (deltaMinutes) => {
      if (!baseMeta) return;
      const samplesDelta = Math.round(deltaMinutes * 60 * (baseMeta.sampleRate || 1));
      const newIdx = Math.max(0, Math.min(baseMeta.numSamples - 1, realtimeStartSample + samplesDelta));
      setRealtimeStartSample(newIdx);
    },
    [baseMeta, realtimeStartSample]
  );

  const totalModifiedCells = Object.values(cellOverrides).reduce(
    (acc, chMap) => acc + Object.keys(chMap).length,
    0
  );
  const totalModifiedRows = Object.keys(cellOverrides).length;

  const handleSaveToOldFile = async () => {
    if (totalModifiedCells === 0) {
      if (window.showAppNotification) {
        window.showAppNotification('No Changes', 'No values have been modified to save.', 'info');
      }
      return;
    }

    setIsSavingOld(true);
    try {
      const res = await DataModifierEngine.patchSampleValues(cellOverrides);
      if (res && res.success) {
        if (window.showAppNotification) {
          window.showAppNotification(
            res.persisted ? 'Saved to File' : 'Updated In-Memory',
            res.persisted
              ? `Successfully saved ${res.count || totalModifiedCells} modified values directly to the file.`
              : `Updated ${totalModifiedCells} values in memory. Use "Save as New File" to export a file copy.`,
            'success'
          );
        }
        await loadRealtimeRows(realtimeStartSample, realtimePageSize);
      } else {
        if (window.showAppNotification) {
          window.showAppNotification('Notice', 'Cannot overwrite file directly. Please use "Save as New File".', 'warning');
        }
      }
    } catch (err) {
      console.error('[DataModifierModal] handleSaveToOldFile error:', err);
      if (window.showAppNotification) {
        window.showAppNotification('Save Error', err.message || 'Failed to save to old file', 'error');
      }
    } finally {
      setIsSavingOld(false);
    }
  };

  const handleResetEdits = async () => {
    setCellOverrides({});
    await loadRealtimeRows(realtimeStartSample, realtimePageSize);
    if (window.showAppNotification) {
      window.showAppNotification('Edits Reset', 'All unsaved modifications have been cleared.', 'info');
    }
  };

  const handleExport = async (format) => {
    if (!baseMeta) return;
    setIsExporting(true);
    setExportProgress(0.01);

    const config = {
      removedChannelIds,
      combinedChannels,
      scaledChannels,
      formulaChannels,
      cellOverrides,
      timeExtension: {
        enabled: timeExtEnabled,
        extraMinutes,
        channelRules,
      },
      cutdown: {
        enabled: cutdownEnabled,
        cutMinutes: parseInt(cutMinutes, 10) || 0,
        position: cutPosition,
      },
      consumptionSolvers,
    };

    try {
      const res = await DataModifierEngine.exportModifiedFile(
        baseMeta,
        config,
        format,
        (prog) => setExportProgress(prog)
      );

      setIsExporting(false);

      if (res && res.aborted) {
        return; // User cancelled save dialog
      }

      if (res && res.success) {
        if (window.showAppNotification) {
          window.showAppNotification(
            'Export Successful',
            `Exported modified file as ${res.fileName}`,
            'success'
          );
        }

        // Open newly created file in S4A-Web if requested
        if (autoOpenAfterExport) {
          if (res.file && TestAPI.loadFile) {
            await TestAPI.loadFile(res.file);
            if (onFileReloaded) onFileReloaded(res.file.name);
            onClose();
          } else if (res.fileHandle && TestAPI.loadFileFromHandle) {
            await TestAPI.loadFileFromHandle(res.fileHandle);
            if (onFileReloaded) onFileReloaded(res.fileName);
            onClose();
          }
        }
      }
    } catch (err) {
      setIsExporting(false);
      console.error('[DataModifierModal] Export error:', err);
      if (window.showAppNotification) {
        window.showAppNotification('Export Error', err.message || 'Failed to export file', 'error');
      }
    }
  };

  const selectedChannelsList = (baseMeta ? baseMeta.channels : []).filter(
    (c) => realtimeSelectedChs.includes(c.channel_id) && !removedChannelIds.includes(c.channel_id)
  );

  const realtimeRatio = (baseMeta && baseMeta.numSamples > 1)
    ? Math.max(0, Math.min(1, realtimeStartSample / (baseMeta.numSamples - 1)))
    : 0;

  const currentIndicatorTimeMs = baseMeta
    ? baseMeta.startTimeMs + (realtimeStartSample / (baseMeta.sampleRate || 1)) * 1000
    : 0;

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onClose={onClose} className="data-modifier-dialog">
      {/* Modal Header */}
      <div className="modifier-header">
        <div className="modifier-header-title">
          <AutoFixHighIcon style={{ color: '#00ac86' }} />
          <span>Data Studio: File Modification & Real-time Editor</span>
          <span className="modifier-header-badge">Studio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {baseMeta && (
            <span className="modifier-header-meta">
              Source: <strong>{baseMeta.fileName}</strong> ({baseMeta.channels.length} channels,{' '}
              {baseMeta.numSamples.toLocaleString()} samples)
            </span>
          )}
          <IconButton onClick={onClose} size="small" style={{ color: '#94a3b8' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="modifier-body">
        {/* Left: Transformation Controls */}
        <div className={`modifier-left-pane ${activeTab === 'realtime' ? 'is-realtime' : ''}`}>
          {/* Sub Navigation Tabs */}
          <div className="modifier-nav-tabs">
            <button
              className={`modifier-nav-tab ${activeTab === 'formulas' ? 'active' : ''}`}
              onClick={() => setActiveTab('formulas')}
            >
              Channel Formulas
            </button>
            <button
              className={`modifier-nav-tab ${activeTab === 'extend' ? 'active' : ''}`}
              onClick={() => setActiveTab('extend')}
            >
              Time Range
            </button>
            <button
              className={`modifier-nav-tab ${activeTab === 'realtime' ? 'active' : ''}`}
              onClick={() => setActiveTab('realtime')}
            >
              Real-time Modify
            </button>
          </div>

          <div className="modifier-tab-content">
            {/* 1. Unified Channel Formulas & Delete Tab */}
            {activeTab === 'formulas' && (
              <div>
                {/* Formula Editor Section */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div className="modifier-section-title" style={{ marginBottom: 0 }}>
                      Channel Formulas & Scaling Editor
                    </div>
                    <IconButton
                      size="small"
                      onClick={() => setShowFormulaNote((prev) => !prev)}
                      title="Click to view formula instructions"
                      style={{ padding: 2 }}
                    >
                      <InfoOutlinedIcon style={{ fontSize: 16, color: showFormulaNote ? '#00ac86' : '#64748b' }} />
                    </IconButton>
                  </div>

                  {showFormulaNote && (
                    <div className="modifier-formula-note-box">
                      Write easy formulas to scale existing channels or calculate new channels (e.g. <code>ch1 * 2</code>, <code>ch1 + ch2</code>, <code>(ch1 - ch2) / 2</code>). You can also remove any channel from the export using the <strong>×</strong> tail icon on each channel chip below.
                    </div>
                  )}

                  {/* Quick Presets Bar */}
                  <div className="modifier-form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label className="modifier-label" style={{ marginBottom: 0 }}>Quick Formula Presets</label>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Click to apply</span>
                    </div>
                    <div className="modifier-presets-container">
                      <button
                        type="button"
                        className="modifier-preset-btn"
                        onClick={() => {
                          setFormulaExpr('ch1 * 2');
                          setFormulaMode('replace');
                          setFormulaTargetChId(baseMeta?.channels?.[0]?.channel_id ?? 0);
                        }}
                      >
                        Scale (ch1 × 2)
                      </button>
                      <button
                        type="button"
                        className="modifier-preset-btn"
                        onClick={() => {
                          setFormulaExpr('ch1 + ch2');
                          setFormulaMode('new_channel');
                          setFormulaNewName('Total Flow');
                          setFormulaNewUnit(baseMeta?.channels?.[0]?.unit || '');
                        }}
                      >
                        Sum (ch1 + ch2)
                      </button>
                      <button
                        type="button"
                        className="modifier-preset-btn"
                        onClick={() => {
                          setFormulaExpr('ch1 - ch2');
                          setFormulaMode('new_channel');
                          setFormulaNewName('Difference');
                          setFormulaNewUnit(baseMeta?.channels?.[0]?.unit || '');
                        }}
                      >
                        Diff (ch1 - ch2)
                      </button>
                      <button
                        type="button"
                        className="modifier-preset-btn"
                        onClick={() => {
                          setFormulaExpr('(ch1 + ch2) / 2');
                          setFormulaMode('new_channel');
                          setFormulaNewName('Average');
                          setFormulaNewUnit(baseMeta?.channels?.[0]?.unit || '');
                        }}
                      >
                        Average ((ch1 + ch2)/2)
                      </button>
                      <button
                        type="button"
                        className="modifier-preset-btn modifier-preset-btn--integral"
                        onClick={() => {
                          setFormulaExpr('integral(ch1)');
                          setFormulaMode('new_channel');
                          setFormulaNewName('Consumption');
                          const flowCh = baseMeta?.channels?.find(
                            (c) => /m\/s|l\/s|m3\/s|flow/i.test(c.unit || c.name || '')
                          ) || baseMeta?.channels?.[0];
                          const srcUnit = flowCh?.unit || '';
                          setFormulaNewUnit(srcUnit ? `${srcUnit}·s` : 'm³');
                        }}
                      >
                        ∫ Integral (flow → volume)
                      </button>
                    </div>
                  </div>

                  {/* Formula Expression Input */}
                  <div className="modifier-form-group">
                    <label className="modifier-label">Formula Expression</label>
                    <div className="modifier-formula-input-wrapper">
                      <span className="modifier-formula-prefix">fx</span>
                      <input
                        type="text"
                        className="modifier-formula-input"
                        value={formulaExpr}
                        onChange={(e) => setFormulaExpr(e.target.value)}
                        placeholder="e.g. ch1 * 2, ch1 + ch2, (ch1 - ch2) / 2"
                      />
                      {formulaExpr && (
                        <button
                          type="button"
                          className="modifier-formula-clear-btn"
                          onClick={() => setFormulaExpr('')}
                          title="Clear formula"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Real-time Syntax & Sample Result Feedback */}
                    <div className={`modifier-formula-status ${formulaValidation.valid ? 'valid' : 'invalid'}`}>
                      {formulaValidation.valid ? (
                        <span>✓ {formulaValidation.sampleCalc}</span>
                      ) : (
                        <span>⚠ {formulaValidation.error || 'Invalid formula expression'}</span>
                      )}
                    </div>
                  </div>

                  {/* Quick Insert Chips */}
                  <div className="modifier-form-group">
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 5 }}>
                      Click to Insert Channels & Operators:
                    </div>
                    <div className="modifier-chips-container">
                      {baseMeta &&
                        baseMeta.channels.map((ch, idx) => {
                          const isRemoved = removedChannelIds.includes(ch.channel_id);
                          return (
                            <div
                              key={ch.channel_id}
                              className={`modifier-channel-chip ${isRemoved ? 'is-removed' : ''}`}
                              title={
                                isRemoved
                                  ? `ch${idx + 1} is cut down/omitted from file. Click Restore to include again.`
                                  : `Insert ch${idx + 1} into formula`
                              }
                            >
                              <button
                                type="button"
                                className="modifier-channel-chip-body"
                                onClick={() => handleInsertToken(`ch${idx + 1}`)}
                              >
                                <span className="modifier-chip-add-sym">+</span>
                                <span className="modifier-chip-ch-num">ch{idx + 1}</span>
                                {ch.unit ? <span className="modifier-chip-unit">[{ch.unit}]</span> : null}
                                <span className="modifier-chip-name">{ch.name}</span>
                              </button>

                              {isRemoved ? (
                                <button
                                  type="button"
                                  className="modifier-channel-chip-restore"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestoreChannel(ch.channel_id);
                                  }}
                                  title={`Restore ch${idx + 1} to output file`}
                                >
                                  <RestoreIcon style={{ fontSize: 12 }} />
                                  <span>Restore</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="modifier-channel-chip-tail"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChannelToDelete({
                                      channel_id: ch.channel_id,
                                      idx,
                                      name: ch.name,
                                      unit: ch.unit,
                                    });
                                  }}
                                  title={`Remove (cut down) ch${idx + 1} from output file`}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    <div className="modifier-chips-container" style={{ marginTop: 5 }}>
                      {['+', '-', '*', '/', '(', ')', '* 2', '/ 2', '* 10', '/ 1000'].map((op) => (
                        <button
                          key={op}
                          type="button"
                          className="modifier-chip modifier-chip-op"
                          onClick={() => handleInsertToken(op)}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Output Destination Selection */}
                  <div className="modifier-form-group">
                    <label className="modifier-label">Destination</label>
                    <div className="modifier-radio-row">
                      <label className="modifier-radio-label">
                        <input
                          type="radio"
                          name="formulaMode"
                          value="new_channel"
                          checked={formulaMode === 'new_channel'}
                          onChange={() => setFormulaMode('new_channel')}
                        />
                        <span>Save as New Channel</span>
                      </label>
                      <label className="modifier-radio-label">
                        <input
                          type="radio"
                          name="formulaMode"
                          value="replace"
                          checked={formulaMode === 'replace'}
                          onChange={() => setFormulaMode('replace')}
                        />
                        <span>Replace Existing Channel</span>
                      </label>
                    </div>

                    {formulaMode === 'new_channel' ? (
                      <div className="modifier-row" style={{ marginTop: 10 }}>
                        <div style={{ flex: 2 }}>
                          <label className="modifier-label" style={{ fontSize: 11 }}>New Channel Name</label>
                          <input
                            type="text"
                            className="modifier-input"
                            value={formulaNewName}
                            onChange={(e) => setFormulaNewName(e.target.value)}
                            placeholder="e.g. Total Flow or CH1 x 2"
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="modifier-label" style={{ fontSize: 11 }}>Unit</label>
                          <input
                            type="text"
                            className="modifier-input"
                            value={formulaNewUnit}
                            onChange={(e) => setFormulaNewUnit(e.target.value)}
                            placeholder="e.g. m³/h, kW"
                          />
                        </div>
                        <div style={{ flex: '0 0 80px' }}>
                          <label className="modifier-label" style={{ fontSize: 11 }}>Resolution</label>
                          <select
                            className="modifier-select"
                            value={formulaResolution}
                            onChange={(e) => setFormulaResolution(Number(e.target.value))}
                            style={{ padding: '4px 6px', fontSize: 12 }}
                          >
                            {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                              <option key={r} value={r}>{r} {r === 0 ? '(integer)' : r === 1 ? '(0.0)' : r === 2 ? '(0.00)' : `(${r} dp)`}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 10 }}>
                        <label className="modifier-label" style={{ fontSize: 11 }}>Target Channel to Replace</label>
                        <select
                          className="modifier-select"
                          value={formulaTargetChId}
                          onChange={(e) => {
                            const val = e.target.value;
                            const num = Number(val);
                            setFormulaTargetChId(!isNaN(num) ? num : val);
                          }}
                        >
                          {baseMeta &&
                            baseMeta.channels.map((ch, idx) => (
                              <option key={ch.channel_id} value={ch.channel_id}>
                                ch{idx + 1}: {ch.name} [{ch.unit || '-'}]
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <button
                    className="modifier-btn-primary"
                    onClick={handleAddFormula}
                    disabled={!formulaValidation.valid}
                    style={{ opacity: formulaValidation.valid ? 1 : 0.6 }}
                  >
                    <AddIcon fontSize="small" /> Apply Formula
                  </button>

                  {/* Active Formulas List */}
                  {formulaChannels.length > 0 && (
                    <div className="modifier-card-list" style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                        ACTIVE FORMULAS ({formulaChannels.length})
                      </div>
                      {formulaChannels.map((fc) => (
                        <div key={fc.id} className="modifier-card-item">
                          <div className="modifier-card-info">
                            <span className="modifier-card-title">
                              <span>{fc.name}</span>
                              <span className="modifier-tag-type modifier-tag-comb">
                                {fc.mode === 'replace' ? 'Replace' : 'New Channel'}
                              </span>
                            </span>
                            <span className="modifier-card-subtitle" style={{ fontFamily: 'monospace', fontWeight: 600, color: '#00ac86' }}>
                              fx: {fc.expression} {fc.unit ? `[${fc.unit}]` : ''}
                            </span>
                          </div>
                          <IconButton size="small" onClick={() => handleRemoveFormula(fc.id)}>
                            <DeleteIcon fontSize="small" style={{ color: '#94a3b8' }} />
                          </IconButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Time Range (Extend / Cutdown) Tab */}
            {activeTab === 'extend' && (
              <div>
                <div className="modifier-section-title">Time Range</div>
                <div className="modifier-section-desc">
                  Trim the log file duration by cutting data from the beginning or end, or extend the duration with realistic synthetic data.
                </div>

                {/* Section A: Cutdown Data Duration */}
                <div style={{ padding: '12px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="modifier-checkbox-label" style={{ fontWeight: 700, color: '#0f172a' }}>
                      <input
                        type="checkbox"
                        checked={cutdownEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCutdownEnabled(checked);
                          if (checked) setTimeExtEnabled(false);
                        }}
                      />
                      Enable Data Cutdown (Trim File Duration)
                    </label>
                    {cutdownEnabled && (
                      <span className="modifier-metric-tag" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>
                        Active Cutdown
                      </span>
                    )}
                  </div>

                  {cutdownEnabled && (
                    <div style={{ marginTop: 12 }}>
                      <div className="modifier-row modifier-form-group">
                        <div style={{ flex: 1 }}>
                          <label className="modifier-label">Cut Direction</label>
                          <select
                            className="modifier-select"
                            value={cutPosition}
                            onChange={(e) => setCutPosition(e.target.value)}
                          >
                            <option value="end">Trim from End (Drop trailing data)</option>
                            <option value="start">Trim from Start (Drop leading data)</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="modifier-label">Trim Amount (Minutes)</label>
                          <input
                            type="number"
                            min="1"
                            max={baseMeta ? Math.max(1, Math.floor((baseMeta.stopTimeMs - baseMeta.startTimeMs) / 60000) - 1) : 1440}
                            className="modifier-input"
                            value={cutMinutes}
                            onChange={(e) => setCutMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          />
                        </div>
                      </div>

                      {/* Quick preset chips for cutdown */}
                      <div className="modifier-row" style={{ gap: 6, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Quick Cut:</span>
                        <button className="modifier-btn-small" onClick={() => setCutMinutes(15)}>
                          -15m
                        </button>
                        <button className="modifier-btn-small" onClick={() => setCutMinutes(30)}>
                          -30m
                        </button>
                        <button className="modifier-btn-small" onClick={() => setCutMinutes(60)}>
                          -1h
                        </button>
                        <button className="modifier-btn-small" onClick={() => setCutMinutes(120)}>
                          -2h
                        </button>
                        {baseMeta && (
                          <button
                            className="modifier-btn-small"
                            onClick={() => {
                              const halfMin = Math.max(1, Math.round(((baseMeta.stopTimeMs - baseMeta.startTimeMs) / 120000)));
                              setCutMinutes(halfMin);
                            }}
                          >
                            Cut 50%
                          </button>
                        )}
                      </div>

                      {/* Duration computation preview */}
                      {baseMeta && (
                        <div style={{
                          padding: '8px 12px',
                          background: '#fff7ed',
                          borderRadius: 6,
                          border: '1px solid #fed7aa',
                          fontSize: 11,
                          color: '#9a3412',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <span>Original: <strong>{((baseMeta.stopTimeMs - baseMeta.startTimeMs) / 3600000).toFixed(2)}h</strong></span>
                          <span>Cut: <strong>-{(cutMinutes / 60).toFixed(2)}h</strong> ({cutPosition === 'end' ? 'from end' : 'from start'})</span>
                          <span>Output: <strong>{Math.max(0.01, ((baseMeta.stopTimeMs - baseMeta.startTimeMs) / 3600000) - (cutMinutes / 60)).toFixed(2)}h</strong></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section B: Extend Data Duration */}
                <div style={{ padding: '12px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <label className="modifier-checkbox-label" style={{ fontWeight: 700, color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={timeExtEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTimeExtEnabled(checked);
                        if (checked) setCutdownEnabled(false);
                      }}
                    />
                    Enable Time Extension with Bounded Random Variation
                  </label>

                  {timeExtEnabled && (
                    <div style={{ marginTop: 12 }}>
                    <div className="modifier-row modifier-form-group">
                      <div style={{ flex: 1 }}>
                        <label className="modifier-label">Extension Duration (Minutes)</label>
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          className="modifier-input"
                          value={extraMinutes}
                          onChange={(e) => setExtraMinutes(Math.max(1, parseInt(e.target.value, 10) || 60))}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                        <button className="modifier-btn-small" onClick={() => setExtraMinutes(30)}>
                          +30m
                        </button>
                        <button className="modifier-btn-small" onClick={() => setExtraMinutes(60)}>
                          +1h
                        </button>
                        <button className="modifier-btn-small" onClick={() => setExtraMinutes(120)}>
                          +2h
                        </button>
                        <button className="modifier-btn-small" onClick={() => setExtraMinutes(240)}>
                          +4h
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        Channel Generation Rules in Extension Period:
                      </div>
                      <table className="modifier-rule-table">
                        <thead>
                          <tr>
                            <th style={{ width: '28%' }}>Channel</th>
                            <th style={{ width: '36%' }}>Generation Mode</th>
                            <th style={{ width: '36%' }}>Bounds / Target Setting</th>
                          </tr>
                        </thead>
                        <tbody>
                          {baseMeta &&
                            baseMeta.channels.map((ch) => {
                              const isCons = Boolean(consumptionSolvers[ch.channel_id]?.enabled);
                              const rule = channelRules[ch.channel_id] || {
                                mode: isCons ? 'consumption' : 'bounded_random',
                                min: ch.min,
                                max: ch.max,
                              };
                              const currentMode = isCons ? 'consumption' : (rule.mode || 'bounded_random');
                              const solver = consumptionSolvers[ch.channel_id] || {
                                targetVal: Math.round((ch.lastVal + 500) * 100) / 100,
                                profile: 'jittered',
                              };
                              const delta = solver.targetVal - ch.lastVal;

                              return (
                                <tr
                                  key={ch.channel_id}
                                  className={currentMode === 'consumption' ? 'modifier-rule-consumption-row' : ''}
                                  style={currentMode === 'consumption' ? { backgroundColor: '#f0fdf9' } : {}}
                                >
                                  <td style={currentMode === 'consumption' ? { padding: '12px 8px', verticalAlign: 'middle' } : {}}>
                                    <strong>{ch.name}</strong>
                                    <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                      Last: {ch.lastVal.toFixed(1)} {ch.unit}
                                    </div>
                                  </td>
                                  <td style={currentMode === 'consumption' ? { padding: '12px 8px', verticalAlign: 'middle' } : {}}>
                                    <select
                                      className="modifier-select"
                                      style={{ padding: currentMode === 'consumption' ? '6px 8px' : '4px 6px', fontSize: 11 }}
                                      value={currentMode}
                                      onChange={(e) => {
                                        const mode = e.target.value;
                                        if (mode === 'consumption') {
                                          const defaultTarget = Math.round((ch.lastVal + 500) * 100) / 100;
                                          setConsumptionSolvers((prev) => ({
                                            ...prev,
                                            [ch.channel_id]: {
                                              enabled: true,
                                              startVal: ch.lastVal,
                                              targetVal: prev[ch.channel_id]?.targetVal ?? defaultTarget,
                                              profile: prev[ch.channel_id]?.profile || 'jittered',
                                            },
                                          }));
                                          setChannelRules((prev) => ({
                                            ...prev,
                                            [ch.channel_id]: { ...prev[ch.channel_id], mode: 'consumption' },
                                          }));
                                        } else {
                                          setConsumptionSolvers((prev) => {
                                            const next = { ...prev };
                                            delete next[ch.channel_id];
                                            return next;
                                          });
                                          setChannelRules((prev) => ({
                                            ...prev,
                                            [ch.channel_id]: { ...prev[ch.channel_id], mode },
                                          }));
                                        }
                                      }}
                                    >
                                      <option value="bounded_random">Bounded Random</option>
                                      <option value="smooth_walk">Smooth Walk</option>
                                      <option value="constant">Hold Constant</option>
                                      <option value="consumption">
                                        Consumption Target {ch.isConsumptionCandidate ? '★ Totalizer' : ''}
                                      </option>
                                    </select>
                                  </td>
                                  <td style={currentMode === 'consumption' ? { padding: '12px 8px', verticalAlign: 'middle' } : {}}>
                                    {currentMode === 'consumption' ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                          <span style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>Target:</span>
                                          <input
                                            type="number"
                                            step="any"
                                            style={{
                                              width: 85,
                                              padding: '4px 6px',
                                              fontSize: 11.5,
                                              fontWeight: 700,
                                              color: '#00ac86',
                                              border: '1px solid #00ac86',
                                              borderRadius: 4,
                                              background: '#fff',
                                            }}
                                            value={solver.targetVal}
                                            onChange={(e) => {
                                              const targetVal = parseFloat(e.target.value) || 0;
                                              setConsumptionSolvers((prev) => ({
                                                ...prev,
                                                [ch.channel_id]: {
                                                  enabled: true,
                                                  startVal: ch.lastVal,
                                                  targetVal,
                                                  profile: prev[ch.channel_id]?.profile || 'jittered',
                                                },
                                              }));
                                            }}
                                          />
                                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{ch.unit}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                          <span style={{ fontSize: 11, color: delta >= 0 ? '#00ac86' : '#ef4444', fontWeight: 700, minWidth: 50 }}>
                                            Δ {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                                          </span>
                                          <select
                                            style={{
                                              fontSize: 11,
                                              padding: '3px 6px',
                                              border: '1px solid #cbd5e1',
                                              borderRadius: 4,
                                              background: '#fff',
                                              color: '#334155',
                                            }}
                                            value={solver.profile || 'jittered'}
                                            onChange={(e) => {
                                              const profile = e.target.value;
                                              setConsumptionSolvers((prev) => ({
                                                ...prev,
                                                [ch.channel_id]: {
                                                  ...prev[ch.channel_id],
                                                  profile,
                                                },
                                              }));
                                            }}
                                          >
                                            <option value="jittered">Fluctuating Rate</option>
                                            <option value="linear">Linear Rate</option>
                                          </select>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        <input
                                          type="number"
                                          step="any"
                                          style={{ width: 50, padding: 4, fontSize: 11 }}
                                          value={rule.min}
                                          onChange={(e) => {
                                            const min = parseFloat(e.target.value) || 0;
                                            setChannelRules((prev) => ({
                                              ...prev,
                                              [ch.channel_id]: { ...prev[ch.channel_id], min },
                                            }));
                                          }}
                                        />
                                        <span style={{ color: '#94a3b8' }}>-</span>
                                        <input
                                          type="number"
                                          step="any"
                                          style={{ width: 50, padding: 4, fontSize: 11 }}
                                          value={rule.max}
                                          onChange={(e) => {
                                            const max = parseFloat(e.target.value) || 100;
                                            setChannelRules((prev) => ({
                                              ...prev,
                                              [ch.channel_id]: { ...prev[ch.channel_id], max },
                                            }));
                                          }}
                                        />
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Real-time Data Modification Tab */}
          {activeTab === 'realtime' && (
            <div className="modifier-vprogress-container">
              {/* Top Endpoint: Start Time */}
              {/* Top Endpoint: Start Time (2 lines) */}
              <div className="modifier-vprogress-top-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="modifier-vprogress-card-label">Start time</span>
                  <span className="modifier-vprogress-card-sub">Rec #1</span>
                </div>
                <div className="modifier-vprogress-card-time">
                  {baseMeta ? formatDateTime(baseMeta.startTimeMs) : '-'}
                </div>
              </div>

              {/* Vertical Progress Track — label and dot share same wrapper coords */}
              <div className="modifier-vprogress-track-wrapper" ref={vWrapperRef}>
                {/* Background track bar (click to jump) */}
                <div
                  className="modifier-vprogress-track"
                  onClick={(e) => updateFromPointerEvent(e.clientY)}
                  title="Click to jump to position"
                >
                  <div
                    className="modifier-vprogress-bar-fill"
                    style={{ height: `${realtimeRatio * 100}%` }}
                  />
                </div>
                {/* Dot indicator — centered on track bar, same top as label */}
                <div
                  className="modifier-vprogress-indicator-dot"
                  style={{ top: `${realtimeRatio * 100}%` }}
                />
                {/* Draggable time label — positioned relative to wrapper */}
                <div
                  className="modifier-vprogress-time-label"
                  style={{ top: `${realtimeRatio * 100}%` }}
                  onPointerDown={handleTrackPointerDown}
                  title="Drag to navigate"
                >
                  <div className="modifier-vprogress-time-label-time">
                    {baseMeta ? formatDateTime(currentIndicatorTimeMs) : '-'}
                  </div>
                  <div className="modifier-vprogress-time-label-rec">
                    Rec #{(realtimeStartSample + 1).toLocaleString()}&nbsp;
                    <span className="modifier-vprogress-time-label-pct">({Math.round(realtimeRatio * 100)}%)</span>
                  </div>
                </div>
              </div>

              {/* Bottom Endpoint: Stop Time (2 lines) */}
              <div className="modifier-vprogress-bottom-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="modifier-vprogress-card-label">Stop time</span>
                  <span className="modifier-vprogress-card-sub">
                    Rec #{(baseMeta?.numSamples || 0).toLocaleString()}
                  </span>
                </div>
                <div className="modifier-vprogress-card-time">
                  {baseMeta ? formatDateTime(baseMeta.stopTimeMs) : '-'}
                </div>
              </div>

              {/* Quick Nudge / Jump Controls (-30m / +30m) */}
              <div className="modifier-vprogress-nudge-row">
                <button
                  className="modifier-btn-small"
                  onClick={() => setRealtimeStartSample(0)}
                  title="Jump to Start (0%)"
                >
                  Top
                </button>
                <button
                  className="modifier-btn-small"
                  onClick={() => handleNudge(-30)}
                  title="Step backward 30 minutes"
                >
                  -30m
                </button>
                <button
                  className="modifier-btn-small"
                  onClick={() => handleNudge(30)}
                  title="Step forward 30 minutes"
                >
                  +30m
                </button>
                <button
                  className="modifier-btn-small"
                  onClick={() =>
                    setRealtimeStartSample(
                      Math.max(0, (baseMeta?.numSamples || 1) - realtimePageSize)
                    )
                  }
                  title="Jump to End"
                >
                  End
                </button>
              </div>

              {/* Save Actions */}
              <div className="modifier-vprogress-actions">
                <div
                  className="modifier-realtime-badge"
                  style={{ marginBottom: 8, width: '100%', justifyContent: 'center' }}
                >
                  {totalModifiedCells > 0 ? (
                    <span>★ {totalModifiedCells} cell(s) modified in {totalModifiedRows} row(s)</span>
                  ) : (
                    <span style={{ color: '#64748b' }}>No unsaved modifications</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    className="modifier-btn-primary"
                    onClick={handleSaveToOldFile}
                    disabled={isSavingOld || totalModifiedCells === 0}
                    style={{ width: '100%', justifyContent: 'center' }}
                    title="Directly overwrites the modified values in the open file / memory buffer"
                  >
                    {isSavingOld ? 'Saving to File...' : 'Save to Old File'}
                  </button>

                  <button
                    className="modifier-btn-small"
                    onClick={() => handleExport('csd')}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      background: '#fff',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      fontWeight: 600,
                    }}
                    title="Export modified data into a new CSD file"
                  >
                    Save as New File (.csd)
                  </button>

                  {totalModifiedCells > 0 && (
                    <button
                      className="modifier-btn-small"
                      onClick={handleResetEdits}
                      style={{ width: '100%', justifyContent: 'center', color: '#dc2626' }}
                    >
                      Reset All Edits
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Right Pane: Live D3 Preview Chart OR Real-time Editable Data Table */}
        <div className="modifier-right-pane">
          {activeTab === 'realtime' ? (
            <div className="modifier-realtime-table-wrap">
              {/* Header Bar: Channel Selection + Rows Selector + Page Steppers */}
              <div className="modifier-realtime-table-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 260 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Channels:
                  </span>
                  <button
                    className="modifier-btn-small"
                    style={{ padding: '2px 6px', fontSize: 10 }}
                    onClick={() =>
                      setRealtimeSelectedChs(baseMeta ? baseMeta.channels.map((c) => c.channel_id) : [])
                    }
                    title="Show all channels"
                  >
                    All
                  </button>
                  <button
                    className="modifier-btn-small"
                    style={{ padding: '2px 6px', fontSize: 10 }}
                    onClick={() => setRealtimeSelectedChs([])}
                    title="Hide all channels"
                  >
                    None
                  </button>
                  {baseMeta &&
                    baseMeta.channels
                      .filter((ch) => !removedChannelIds.includes(ch.channel_id))
                      .map((ch) => {
                        const isSelected = realtimeSelectedChs.includes(ch.channel_id);
                        return (
                          <button
                            key={ch.channel_id}
                            className={`modifier-channel-chip ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                              setRealtimeSelectedChs((prev) =>
                                isSelected
                                  ? prev.filter((id) => id !== ch.channel_id)
                                  : [...prev, ch.channel_id]
                              );
                            }}
                          >
                            {isSelected ? '✓ ' : ''}{ch.name}
                          </button>
                        );
                      })}
                </div>

                {/* Show: 12, 50, 150 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Show:
                  </span>
                  <div className="modifier-rows-selector">
                    {[15, 50, 150].map((sz) => (
                      <button
                        key={sz}
                        className={`modifier-rows-pill ${realtimePageSize === sz ? 'active' : ''}`}
                        onClick={() => setRealtimePageSize(sz)}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                    <button
                      className="modifier-btn-small"
                      disabled={realtimeStartSample === 0 || realtimeLoading}
                      onClick={() =>
                        setRealtimeStartSample((prev) => Math.max(0, prev - realtimePageSize))
                      }
                      title={`Previous ${realtimePageSize} records`}
                    >
                      &larr; Prev
                    </button>
                    <button
                      className="modifier-btn-small"
                      disabled={
                        realtimeStartSample + realtimePageSize >= (baseMeta?.numSamples || 0) ||
                        realtimeLoading
                      }
                      onClick={() =>
                        setRealtimeStartSample((prev) =>
                          Math.min((baseMeta?.numSamples || 1) - 1, prev + realtimePageSize)
                        )
                      }
                      title={`Next ${realtimePageSize} records`}
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-Header: Range info & editing guidance */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#475569' }}>
                <div>
                  Records <strong>{(realtimeStartSample + 1).toLocaleString()}</strong> –{' '}
                  <strong>
                    {(Math.min(baseMeta?.numSamples || 0, realtimeStartSample + realtimeRows.length)).toLocaleString()}
                  </strong>{' '}
                  of <strong>{(baseMeta?.numSamples || 0).toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {totalModifiedCells > 0 ? (
                    <span style={{ color: '#00ac86', fontWeight: 700 }}>
                      ● {totalModifiedCells} unsaved cell edit(s)
                    </span>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Click any cell to edit</span>
                  )}
                </div>
              </div>

              {/* Table Body */}
              <div className="modifier-realtime-table-scroll">
                {realtimeLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: 13 }}>
                    Loading samples...
                  </div>
                ) : realtimeRows.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: 13 }}>
                    No records available. Drag the vertical indicator on the left to navigate.
                  </div>
                ) : (
                  <table className="modifier-editable-table">
                    <thead>
                      <tr>
                        <th style={{ width: 65, textAlign: 'center' }}>Record #</th>
                        <th style={{ width: 155, textAlign: 'left' }}>Timestamp</th>
                        {selectedChannelsList.map((ch) => (
                          <th key={ch.channel_id}>
                            <div>{ch.name}</div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>[{ch.unit || '-'}]</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {realtimeRows.map((row) => {
                        const isRowModified = Boolean(cellOverrides[row.index]);
                        return (
                          <tr key={row.index} className={isRowModified ? 'modifier-row-modified' : ''}>
                            <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}>
                              {row.index + 1}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#334155', whiteSpace: 'nowrap' }}>
                              {formatDateTime(row.timestampMs)}
                            </td>
                            {selectedChannelsList.map((ch) => {
                              const hasOverride =
                                cellOverrides[row.index] &&
                                cellOverrides[row.index][ch.channel_id] !== undefined;
                              const origVal = row.values ? row.values[ch.channel_id] : null;
                              const displayVal = hasOverride
                                ? cellOverrides[row.index][ch.channel_id]
                                : (origVal !== null && origVal !== undefined ? origVal : '');

                              return (
                                <td key={ch.channel_id}>
                                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                      type="number"
                                      step="any"
                                      className={`modifier-cell-input ${hasOverride ? 'is-modified' : ''}`}
                                      value={displayVal}
                                      title={hasOverride ? `Original: ${origVal !== null ? origVal.toFixed(ch.resolution || 2) : '-'}` : ''}
                                      onChange={(e) => {
                                        const valStr = e.target.value;
                                        const num = parseFloat(valStr);
                                        setCellOverrides((prev) => ({
                                          ...prev,
                                          [row.index]: {
                                            ...(prev[row.index] || {}),
                                            [ch.channel_id]: isNaN(num) ? 0 : num,
                                          },
                                        }));
                                      }}
                                    />
                                    {hasOverride && <span className="modifier-cell-modified-dot" title="Modified value" />}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Metrics summary bar */}
              <div className="modifier-metrics-bar">
                <div className="modifier-metric-card">
                  <div className="modifier-metric-label">Duration</div>
                  <div className="modifier-metric-value">
                    {previewData && previewData.hasExtension ? (
                      <>
                        <span>+{(extraMinutes / 60).toFixed(1)}h</span>
                        <span className="modifier-metric-tag">Extended</span>
                      </>
                    ) : (previewData && previewData.hasCutdown) ? (
                      <>
                        <span>-{(cutMinutes / 60).toFixed(1)}h</span>
                        <span className="modifier-metric-tag" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>Cutdown</span>
                      </>
                    ) : (
                      <span>Unchanged</span>
                    )}
                  </div>
                </div>

                <div className="modifier-metric-card">
                  <div className="modifier-metric-label">Total Samples</div>
                  <div className="modifier-metric-value">
                    {previewData ? previewData.newNumSamples.toLocaleString() : '-'}
                  </div>
                </div>

                <div className="modifier-metric-card">
                  <div className="modifier-metric-label">Output Channels</div>
                  <div className="modifier-metric-value">
                    {previewData ? (
                      <>
                        <span>{previewData.channels.length}</span>
                        {previewData.channels.length > (baseMeta ? baseMeta.channels.length : 0) && (
                          <span className="modifier-metric-tag">
                            +{previewData.channels.length - baseMeta.channels.length} New
                          </span>
                        )}
                        {removedChannelIds.length > 0 && (
                          <span className="modifier-metric-tag" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
                            -{removedChannelIds.length} Removed
                          </span>
                        )}
                      </>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>
              </div>

              {/* D3 Preview Chart Container */}
              <div className="modifier-chart-container">
                <div className="modifier-chart-header">
                  <div className="modifier-chart-title">
                    <span>Interactive Preview</span>
                    {previewData && previewData.hasCutdown && !previewData.hasExtension && (
                      <span style={{ fontSize: 11, color: '#ea580c', fontWeight: 600 }}>
                        (Trimmed -{cutMinutes} min {cutPosition === 'end' ? 'from end' : 'from start'})
                      </span>
                    )}
                  </div>

                  {/* Legend with visibility toggles */}
                  <div className="modifier-chart-legend">
                    {previewData &&
                      previewData.channels.map((ch, idx) => {
                        const isVis = visibleChannels[ch.channel_id];
                        const color = ch.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                        return (
                          <div
                            key={ch.channel_id}
                            className={`modifier-legend-item ${isVis ? '' : 'disabled'}`}
                            onClick={() =>
                              setVisibleChannels((prev) => ({
                                ...prev,
                                [ch.channel_id]: !isVis,
                              }))
                            }
                            title={
                              ch.isConsumptionCandidate
                                ? `${ch.name} [${ch.unit || '-'}] - Totalizer / Consumption (Click to toggle)`
                                : `${ch.name} [${ch.unit || '-'}] - Click to toggle`
                            }
                          >
                            <div className="modifier-legend-dot" style={{ backgroundColor: color }} />
                            <span>{ch.name}</span>
                            {ch.isConsumptionCandidate && (
                              <span
                                style={{
                                  fontSize: 9,
                                  padding: '1px 4px',
                                  borderRadius: 3,
                                  marginLeft: 4,
                                  background: isVis ? '#dcfce7' : '#f1f5f9',
                                  color: isVis ? '#166534' : '#64748b',
                                  fontWeight: 600,
                                  border: isVis ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                }}
                              >
                                Totalizer
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="modifier-chart-svg-wrap">
                  <svg ref={chartSvgRef} className="modifier-chart-svg" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Footer */}
      <div className="modifier-footer">
        <div className="modifier-footer-left">
          <label className="modifier-checkbox-label">
            <input
              type="checkbox"
              checked={autoOpenAfterExport}
              onChange={(e) => setAutoOpenAfterExport(e.target.checked)}
            />
            Open generated file in S4A-Web immediately
          </label>

          {isExporting && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="modifier-progress-bar-wrap">
                <div
                  className="modifier-progress-bar-fill"
                  style={{ width: `${Math.round(exportProgress * 100)}%` }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#00ac86' }}>
                {Math.round(exportProgress * 100)}%
              </span>
            </div>
          )}
        </div>

        <div className="modifier-footer-right">
          <button className="modifier-btn-small" onClick={onClose} disabled={isExporting}>
            Cancel
          </button>
          <button
            className="modifier-btn-small"
            style={{ fontWeight: 700, color: '#0f172a' }}
            onClick={() => handleExport('csv')}
            disabled={isExporting}
          >
            Export to CSV
          </button>
          <button
            className="modifier-btn-primary"
            style={{ width: 'auto', padding: '8px 20px' }}
            onClick={() => handleExport('csd')}
            disabled={isExporting}
          >
            Export to CSD Binary
          </button>
        </div>
      </div>
    </Dialog>

    {/* Confirmation Warning Dialog before channel cutdown/removal */}
    <Dialog
      open={Boolean(channelToDelete)}
      onClose={() => setChannelToDelete(null)}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        style: {
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      <div className="modifier-confirm-dialog-wrap">
        <div className="modifier-confirm-header">
          <div className="modifier-confirm-icon-box">
            <WarningAmberIcon style={{ fontSize: 24 }} />
          </div>
          <div>
            <div className="modifier-confirm-title">Remove Channel from File?</div>
            <div className="modifier-confirm-subtitle">Cutdown Confirmation</div>
          </div>
        </div>

        <div className="modifier-confirm-body">
          Are you sure you want to cut down and remove channel{' '}
          <strong style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace', color: '#0f172a' }}>
            ch{channelToDelete ? channelToDelete.idx + 1 : ''}{' '}
            {channelToDelete?.unit ? `[${channelToDelete.unit}] ` : ''}
            {channelToDelete?.name}
          </strong>{' '}
          from the output file?
          <div className="modifier-confirm-alert-box">
            ⚠ This channel will be omitted from the exported CSD / CSV file. You can restore it anytime before downloading by clicking &apos;Restore&apos; on the channel chip.
          </div>
        </div>

        <div className="modifier-confirm-actions">
          <button
            type="button"
            className="modifier-btn-small"
            onClick={() => setChannelToDelete(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modifier-btn-danger"
            onClick={() => {
              if (channelToDelete) {
                handleRemoveChannel(channelToDelete.channel_id);
                setChannelToDelete(null);
              }
            }}
          >
            Remove Channel
          </button>
        </div>
      </div>
    </Dialog>
    </>
  );
}
