import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import LineChart from '../graphicview/LineChart';
import ChartController from '../graphicview/ChartController';
import * as liveRecorder from '../../util/liveRecorder';
import { getOnlineCache } from './OnlineView';
import './LiveView.css';

const PALETTE = ['#00B8D9', '#FF6E40', '#7C4DFF', '#00C853', '#FFD600', '#FF4081', '#2979FF', '#00BFA5'];

/**
 * Live recording chart.
 *
 * Reuses the file-analysis rendering stack (LineChart / AxisSeries /
 * ChannelAreaChart) but feeds channel.summaryData directly from the recorder
 * session — no TestAPI round-trips. The x-axis is a fixed 30/60 min recording
 * window anchored at the first sample; when the newest sample reaches the
 * right edge the whole window slides forward by 3/4 of the range
 * (ChartController.Recording mode), so a quarter of the old curves stays
 * visible and curves keep growing until the recording stops.
 */
export default function LiveGraphicView() {
  const lineChartRef = useRef(null);
  const wrapRef = useRef(null);
  const channelsRef = useRef([]);
  const processedRowsRef = useRef(0);
  const anchorRef = useRef(0);
  const latestTRef = useRef(0);
  const rangeMinRef = useRef(30);

  const [rangeMin, setRangeMin] = useState(30);
  const [sampleCount, setSampleCount] = useState(liveRecorder.getRecorderState().samples);
  const [recording, setRecording] = useState(liveRecorder.getRecorderState().recording);

  // One controller instance per mount — created lazily, never re-created.
  const controller = useMemo(() => new ChartController(), []);

  const applyWidth = useCallback(() => {
    if (wrapRef.current && lineChartRef.current) {
      const w = wrapRef.current.clientWidth;
      if (w > 0) lineChartRef.current.setWidth(w);
    }
  }, []);

  /** (Re)build chart channel objects when the session's channel set changes. */
  const ensureChannels = useCallback((session) => {
    const key = session.channelIds.join(',');
    if (channelsRef.current._key === key) return false;
    const cache = getOnlineCache()?.channels || [];
    const chans = session.channelIds.map((id, i) => {
      const c = cache.find((x) => x && x.channel_id === id);
      const name = (c && (c.channel_name || c.sensor_description)) || `Channel ${id}`;
      return {
        id,
        name,
        fullName: name,
        sensorDescription: (c && c.sensor_description) || 'SUTO',
        unit: (c && c.unit) || (session.channelMeta[id] ? session.channelMeta[id].unit : '') || '',
        color: PALETTE[i % PALETTE.length],
        dataLoading: false,
        summaryData: [],
        minValue: 0,
        maxValue: 10,
      };
    });
    channelsRef.current = chans;
    channelsRef.current._key = key;
    processedRowsRef.current = 0;
    return true;
  }, []);

  /** Append session rows not yet processed onto the chart channels. */
  const pushRows = useCallback((session) => {
    const chans = channelsRef.current;
    if (!chans.length) return;
    const newRows = session.rows.slice(processedRowsRef.current);
    if (!newRows.length) return;

    for (const ch of chans) {
      for (const row of newRows) {
        ch.summaryData.push({ time: new Date(row.t), value: row.values[ch.id] ?? null });
      }
      const axis = ch.yAxisData;
      if (axis) {
        let [mn, mx] = axis.scale.domain();
        let dirty = false;
        for (const row of newRows) {
          const v = row.values[ch.id];
          if (v === null || v === undefined) continue;
          if (v < mn) { mn = v; dirty = true; }
          if (v > mx) { mx = v; dirty = true; }
        }
        if (dirty) axis.scale.domain([mn, mx]);
      }
    }
    processedRowsRef.current = session.rows.length;
    latestTRef.current = session.rows[session.rows.length - 1].t;
  }, []);

  /** Full pipeline: y-axes, splines, legend (mirrors the file-mode entry). */
  const fullRedraw = useCallback(() => {
    const lc = lineChartRef.current;
    const ctrl = controller;
    if (!lc || !ctrl || !channelsRef.current.length) return;
    ctrl.setSelectedChannels(channelsRef.current);
    lc.changeSelectedChannelsHandler();
    setTimeout(applyWidth, 80);
  }, [controller, applyWidth]);

  // Consume the recorder session: initial backfill + per-sample appends.
  useEffect(() => {
    const off = liveRecorder.subscribe((snap, event) => {
      const session = liveRecorder.getSessionSnapshot();

      if (event === 'cleared') {
        channelsRef.current = [];
        channelsRef.current._key = '';
        processedRowsRef.current = 0;
        anchorRef.current = 0;
        latestTRef.current = 0;
        setSampleCount(0);
        setRecording(false);
        return;
      }

      if (!session.rows.length) {
        setRecording(session.recording);
        return;
      }

      const rebuilt = ensureChannels(session);
      pushRows(session);

      if (!anchorRef.current) {
        // First data of the session: anchor the recording window & lay out.
        anchorRef.current = session.rows[0].t;
        controller.initRecordingWindow(anchorRef.current, rangeMinRef.current);
        fullRedraw();
      } else if (rebuilt) {
        fullRedraw();
      }

      controller.advanceRecordingWindow(latestTRef.current);
      if (lineChartRef.current) {
        lineChartRef.current.redrawLive();
      }
      setSampleCount(snap.samples);
      setRecording(snap.recording);
    });
    return off;
  }, [controller, ensureChannels, pushRows, fullRedraw]);

  // On mount, backfill whatever the session already holds, then size up.
  useEffect(() => {
    const session = liveRecorder.getSessionSnapshot();
    if (session.rows.length) {
      ensureChannels(session);
      pushRows(session);
      anchorRef.current = session.rows[0].t;
      controller.initRecordingWindow(anchorRef.current, rangeMinRef.current);
      // A long session may already be past the first window — jump straight
      // to the one containing the newest sample.
      controller.advanceRecordingWindow(latestTRef.current);
      fullRedraw();
    }
    applyWidth();
    const onResize = () => applyWidth();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRangeChange = (min) => {
    setRangeMin(min);
    rangeMinRef.current = min;
    const ctrl = controller;
    if (ctrl.datasourceMode === 'Recording' && latestTRef.current) {
      ctrl.setRecordingRange(min, anchorRef.current, latestTRef.current);
      if (lineChartRef.current) lineChartRef.current.redrawLive();
    }
  };

  return (
    <div className="live-view-root">
      <div className="live-view-toolbar">
        <span className="live-view-title">
          {recording ? <span className="rec-pulse-dot" /> : <span className="live-paused-dot" />}
          {recording ? 'Recording' : 'Recording stopped'}
        </span>
        <span className="live-view-meta">{sampleCount} samples · window slides ¾ at the right edge</span>
        <span className="live-toolbar-spacer" />
        <div className="live-range-group">
          {[30, 60].map((m) => (
            <button
              key={m}
              className={`live-range-btn ${rangeMin === m ? 'active' : ''}`}
              onClick={() => handleRangeChange(m)}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      <div className="live-chart-wrapper" ref={wrapRef}>
        <LineChart ref={lineChartRef} chartController={controller} />
      </div>
    </div>
  );
}
