import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PrintIcon from '@mui/icons-material/Print';
import RangeIcon from '@mui/icons-material/DateRange';

import ChannelList from '../channel/ChannelList';
import LineChart from '../graphicview/LineChart';
import YAxisSetting from '../graphicview/YAxisSetting';
import ChannelSetting from '../channel/ChannelSetting';
import { SystemEvent } from '../../util/SystemConstant';
import ChartController, { niceRange, laneAnchors } from '../graphicview/ChartController';
import TestAPI from '../../api/TestAPI';
import Loading from '../../components/loading/Loading';
import * as liveRecorder from '../../util/liveRecorder';
import { setLiveSelection, getLiveSelection } from '../../util/liveSelection';

import '../graphicview/css/GraphicView.css';
import './LiveView.css';

/** Max distinct units (Y-axes) — same rule as the file Graphic View. */
const MAX_UNITS = 4;

/** Recording-window presets (minutes + short label). */
const RANGE_OPTIONS = [
  { min: 30, label: '30 min' },
  { min: 60, label: '60 min' },
  { min: 240, label: '4 h' },
  { min: 1440, label: '1 day' },
];

/**
 * Live recording chart — same shell and interactions as the file Graphic
 * View (channel list sidebar, window-title-right-area buttons, max 4 y-axes
 * with 1 left + 3 right, click a right axis to swap it to the left/main),
 * but the data comes from the live recording session instead of TestAPI and
 * the x-axis is the fixed recording window that slides 3/4 of its range
 * whenever the newest sample reaches the right edge.
 */
class LiveGraphicView extends Component {
  constructor() {
    super();
    this.channelListRef = React.createRef();
    this.graphicViewRef = React.createRef();
    this.lineChartRef = React.createRef();
    this.loadingRef = React.createRef();
    this.ySettingRef = React.createRef();
    this.channelSettingRef = React.createRef();

    this.chartController = new ChartController();
    this.graphicView = null;
    this.channelListVisible = false;

    // Recording-window bookkeeping
    this.rangeMinutes = 30;
    this.anchorT = 0;
    this.latestT = 0;
    this.processedRows = 0;
    this.recorderUnsub = null;

    this.state = {
      recording: liveRecorder.getRecorderState().recording,
      samples: liveRecorder.getRecorderState().samples,
      rangeMin: 30,
      noLoggingChannels: true,
      defaultIds: [],
      // 'live' — window slides at the newest sample; 'history' — frozen,
      // browse the whole session (prev/next jumps), like analyzing a file.
      mode: 'live',
    };
  }

  render() {
    const { recording, samples, rangeMin, noLoggingChannels, defaultIds, mode } = this.state;

    // Restore the in-session selection when remounting (tab switch); fresh
    // sessions start from the computed first-4-units default.
    const restoreIds = getLiveSelection();
    const selectionDefaults = restoreIds.length ? restoreIds : defaultIds;

    const buttonStyle = { paddingTop: 8, width: 40, height: 40, marginLeft: 4 };
    const iconStyle = { fontSize: '24px' };

    return (
      <div className="live-graphic-root">
        <div id="graphic-view-wrapper">
          <ChannelList
            ref={this.channelListRef}
            chartController={this.chartController}
            noStoredSelection
            defaultSelectedIds={selectionDefaults}
          />

          <div className="graphic-view" ref={this.graphicViewRef}>
            <div className="app-window-title">
              {/* Live status in the title-left area (empty span in file mode) */}
              <div className="live-title-status">
                {recording ? <span className="rec-pulse-dot" /> : <span className="live-paused-dot" />}
                <span className="live-title-label">
                  {mode === 'history' ? 'Browsing history' : recording ? 'Recording' : 'Stopped'}
                </span>
                <span className="live-view-meta">{samples} samples</span>

                {mode === 'history' && (
                  <>
                    <button className="live-range-btn" onClick={() => this.shiftHistoryWindow(-1)} title="Previous window">
                      ◀
                    </button>
                    <button className="live-range-btn" onClick={() => this.shiftHistoryWindow(1)} title="Next window">
                      ▶
                    </button>
                    <button className="live-range-btn" onClick={() => this.showAllSession()} title="Show the whole session">
                      All
                    </button>
                  </>
                )}

                {mode === 'live' && (
                  <div className="live-range-group">
                    {RANGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.min}
                        className={`live-range-btn ${rangeMin === opt.min ? 'active' : ''}`}
                        onClick={() => this.handleRangeChange(opt.min)}
                      >
                        {opt.label}
                    </button>
                    ))}
                  </div>
                )}

                <button
                  className="live-range-btn live-mode-toggle"
                  onClick={() => this.toggleBrowseMode()}
                  title={mode === 'history' ? 'Back to live refresh' : 'Freeze and browse the whole session'}
                >
                  {mode === 'history' ? (
                    <>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      <span>Live</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                        <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 7 7 6.96 6.96 0 0 1-4.94-2.06l-1.42 1.42A8.95 8.95 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8h-1.5z" />
                      </svg>
                      <span>History</span>
                    </>
                  )}
                </button>
              </div>

              <div className="window-title-right-area">
                {/* Channel list button */}
                <Tooltip title="Channel">
                  <div>
                    <IconButton
                      onClick={() => this.switchChannelList()}
                      style={buttonStyle}
                      disabled={noLoggingChannels}
                      disableRipple
                    >
                      <ListAltIcon style={iconStyle} />
                    </IconButton>
                  </div>
                </Tooltip>

                {/* Time period button — the file-style brush, history mode only */}
                <Tooltip title="Time period">
                  <div>
                    <IconButton
                      style={buttonStyle}
                      disabled={mode !== 'history' || noLoggingChannels}
                      onClick={() => this.lineChartRef.current && this.lineChartRef.current.showOrHideTimePeriod()}
                      disableRipple
                    >
                      <RangeIcon style={iconStyle} />
                    </IconButton>
                  </div>
                </Tooltip>

                {/* Print button */}
                <Tooltip title="Print">
                  <div>
                    <IconButton
                      style={buttonStyle}
                      disabled={noLoggingChannels}
                      onClick={() => this.lineChartRef.current && this.lineChartRef.current.printChart()}
                      disableRipple
                    >
                      <PrintIcon style={iconStyle} />
                    </IconButton>
                  </div>
                </Tooltip>
              </div>
            </div>

            <LineChart ref={this.lineChartRef} chartController={this.chartController} />
            <Loading ref={this.loadingRef} />
            <YAxisSetting ref={this.ySettingRef} />
            <ChannelSetting ref={this.channelSettingRef} />
          </div>
        </div>
      </div>
    );
  }

  componentDidMount() {
    this.graphicView = d3.select(this.graphicViewRef.current);

    const wrapperWidth = $('#graphic-view-wrapper').width();
    if (wrapperWidth > 0) {
      this.chartController.setChartWidth(wrapperWidth - 40);
    }

    // Same event wiring as the file Graphic View — only the data source
    // differs (recording session instead of TestAPI fetches).
    this.graphicView
      .on(SystemEvent.LOADING_DATA, () => {
        if (this.loadingRef.current) this.loadingRef.current.show();
        // History browsing redraws synchronously BEFORE some stock paths
        // (brush end, back/next) dispatch LOADING_DATA — the matching
        // LOADING_DATA_COMPLETED has already fired. Hide on the next tick
        // so the overlay can never stick.
        if (this.state.mode === 'history') {
          setTimeout(() => this.hideLiveLoading(), 0);
        }
      })
      .on(SystemEvent.LOADING_DATA_COMPLETED, () => {
        if (this.loadingRef.current) this.loadingRef.current.hide();
        if (this.lineChartRef.current) {
          this.lineChartRef.current.updateYAxis();
          const sg = this.lineChartRef.current.SplineGroupRef.current;
          if (sg && sg.drawAll) sg.drawAll();
        }
      })
      .on(SystemEvent.NO_SELECTED_CHANNELS, () => {
        d3.select('.chart-placeholder').attr('data-status', 'active');
        if (this.loadingRef.current) this.loadingRef.current.hide();
      })
      .on('changeSelectedChannels', this.handleChangeSelectedChannels)
      .on(SystemEvent.HIDE_CHANNEL_LIST, () => this.setPosition(0))
      .on(SystemEvent.SHOW_CHANNEL_LIST, () => this.setPosition())
      .on(SystemEvent.INIT_SELECTED_CHANNELS, () => this.initLiveSelection())
      .on(SystemEvent.SHOW_YAXIS_SETTING, (event) => {
        if (event.detail) this.ySettingRef.current.handleClickOpen(event.detail);
      })
      .on(SystemEvent.CLOSE_YAXIS_SETTING, () => {
        this.setState({ showYAxisSetting: false });
      })
      .on(SystemEvent.SHOW_CHANNEL_SETTING, (event) => {
        if (event.detail) this.channelSettingRef.current.handleClickOpen(event.detail);
      });

    d3.select(window).on('resize.liveChart', () => {
      const listWidth = $('.channel-list').width() || 280;
      const chartX = this.channelListVisible ? listWidth : 0;
      const chartWidth = $('#graphic-view-wrapper').width() - chartX;
      this.graphicView.style('left', chartX + 'px').style('width', chartWidth + 'px');
      if (this.lineChartRef.current) {
        this.lineChartRef.current.updateHeight();
        this.lineChartRef.current.setWidth(chartWidth);
        this.relayoutLanes();
        this.lineChartRef.current.redrawLive();
      }
    });

    d3.select('#line-chart')
      .on('changeTimePeriod.live', () => {
        // Stock navigation (brush / back / next) shows the loading overlay —
        // in history browsing the redraw is local, so hide it right away.
        if (this.state.mode === 'history') {
          this.hideLiveLoading();
        }
      })
      .on('liveHistoryReset', () => {
        if (this.state.mode !== 'history') {
          return;
        }
        this.chartController.timePeriods.length = 0;
        this.chartController.currentTimePeriodIndex = -1;
        this.showAllSession();
        d3.select('#line-chart').dispatch('updateScaleActions');
        this.hideLiveLoading();
      });

    this.recorderUnsub = liveRecorder.subscribe((snap, event) => this.onRecorderEvent(event));

    // Lay the chart out once (same as the file view) so the first data load
    // renders with the correct width, then load the channel list.
    this.setPosition(0);
    this.bootstrapSelection();
  }

  componentWillUnmount() {
    if (this.recorderUnsub) this.recorderUnsub();
    d3.select(window).on('resize.liveChart', null);
  }

  /**
   * Compute the fresh-session default selection — every channel of the first
   * MAX_UNITS distinct units — and load the channel list. Selections are NOT
   * persisted to localStorage (noStoredSelection), so a new recording always
   * starts clean; within a session the shared liveSelection store restores
   * the checks when the view remounts.
   */
  bootstrapSelection = async () => {
    const defaultIds = [];
    try {
      const list = await TestAPI.getChannels();
      const chs = Array.isArray(list) ? list : (list && list.logging_chs) || [];
      const units = new Set();
      for (const c of chs) {
        if (!c || c.channel_id === undefined) continue;
        const u = ((c.unit_in_ascii || c.unit) || '').trim().toLowerCase();
        if (units.has(u) || units.size < MAX_UNITS) {
          units.add(u);
          defaultIds.push(c.channel_id);
        }
      }
    } catch (e) {
      console.warn('[LiveGraphicView] default selection skipped:', e);
    }
    this.setState({ defaultIds });
    // Let React flush the new defaultSelectedIds prop before the list builds.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (this.channelListRef.current) {
      this.channelListRef.current.getData();
    }
  };

  /** INIT_SELECTED_CHANNELS — the list finished building & auto-selecting. */
  initLiveSelection = () => {
    try {
      const session = liveRecorder.getSessionSnapshot();
      if (session.rows.length) {
        this.startSessionWindow(session);
        this.attachAndRender(session);
      }
      this.setState({ noLoggingChannels: (this.chartController.selectedChannels || []).length === 0 });
      this.syncSelectionToTable();
    } finally {
      this.hideLiveLoading();
    }
  };

  /** 'changeSelectedChannels' — a channel was (un)checked in the list. */
  handleChangeSelectedChannels = () => {
    try {
      const session = liveRecorder.getSessionSnapshot();
      if (session.rows.length) {
        if (!this.anchorT) {
          this.startSessionWindow(session);
        }
        this.attachAndRender(session);
      }
      this.setState({ noLoggingChannels: (this.chartController.selectedChannels || []).length === 0 });
      this.syncSelectionToTable();
    } finally {
      this.hideLiveLoading();
    }
  };

  /**
   * The stock ChannelList shows the loading overlay when a channel is
   * checked and relies on a long async chain to hide it again — hide it
   * explicitly at the end of every selection flow so it can never stick.
   */
  hideLiveLoading() {
    if (this.loadingRef.current) {
      this.loadingRef.current.hide();
    }
  }

  /** Publish the chart's channel selection for the live Table View. */
  syncSelectionToTable() {
    setLiveSelection((this.chartController.selectedChannels || []).map((c) => c.id));
  }

  startSessionWindow(session) {
    this.anchorT = session.rows[0].t;
    this.chartController.initRecordingWindow(this.anchorT, this.rangeMinutes);
  }

  /**
   * Stacked-lane layout (Recording mode).
   *
   * Every axis shows ONE nice range covering ALL of its channels and renders
   * at full height. Each channel's lane compresses that SAME range into its
   * own band (70% / 60% / 50% … ladder) — so a value's position inside its
   * lane always matches its position on the axis (11 A of 0–15 sits at 73%
   * of the lane, exactly like on the axis). A single channel draws directly
   * against the axis (classic). Domains are refreshed on every relayout even
   * when the pixel height is not laid out yet, so the axis can never go
   * stale while values move.
   */
  relayoutLanes = () => {
    const H = this.chartController.chartHeight;
    const selected = this.chartController.selectedChannels || [];

    for (const axis of this.chartController.yAxisDataset) {
      const chans = (axis.channelIds || [])
        .map((id) => selected.find((c) => c && c.id === id))
        .filter(Boolean);
      if (!chans.length) {
        continue;
      }

      // One nice range covering every channel on this axis.
      let lo = Infinity;
      let hi = -Infinity;
      for (const ch of chans) {
        if (Number.isFinite(ch.laneMin)) lo = Math.min(lo, ch.laneMin);
        if (Number.isFinite(ch.laneMax)) hi = Math.max(hi, ch.laneMax);
      }
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        lo = 0;
        hi = 10;
      }
      const [nlo, nhi] = niceRange(lo, hi);
      axis.ticks = 10;
      // Domain update needs no pixel height — never skip it.
      axis.scale.domain([nlo, nhi]).range(H > 0 ? [H, 0] : axis.scale.range());
      if (!(H > 0)) {
        continue;
      }

      if (chans.length === 1) {
        chans[0].scale = axis.scale;
        continue;
      }

      // Ladder: every lane maps the SAME axis range into its own band, so
      // curve positions stay honest against the axis ticks.
      const anchors = laneAnchors(chans.length);
      const step = anchors[0] - anchors[1];
      const band = Math.max(3.5, step * 0.8);
      chans.forEach((ch, i) => {
        if (!ch.laneScale) {
          ch.laneScale = d3.scaleLinear();
        }
        const topPx = H * (1 - anchors[i] / 100);
        const bottomPx = H * (1 - (anchors[i] - band) / 100);
        ch.laneScale.domain([nlo, nhi]).range([bottomPx, topPx]);
        ch.scale = ch.laneScale;
      });
    }
  }

  /** Rebuild every selected channel's series from the session, then render. */
  attachAndRender(session) {
    const selected = this.chartController.selectedChannels || [];
    for (const ch of selected) {
      this.attachChannelData(ch, session);
    }
    this.processedRows = session.rows.length;
    this.latestT = session.rows[session.rows.length - 1].t;
    // A remount (tab switch) on a long session jumps to the live window.
    this.chartController.advanceRecordingWindow(this.latestT);

    this.relayoutLanes();
    if (this.lineChartRef.current) {
      this.lineChartRef.current.changeSelectedChannelsHandler();
      const listWidth = this.channelListVisible ? ($('.channel-list').width() || 280) : 0;
      const w = $('#graphic-view-wrapper').width() - listWidth;
      if (w > 0) this.lineChartRef.current.setWidth(w);
    }
    this.setState({ noLoggingChannels: selected.length === 0 });
  }

  attachChannelData(ch, session) {
    const pts = [];
    let mn = Infinity;
    let mx = -Infinity;
    for (const row of session.rows) {
      const v = row.values[ch.id];
      pts.push({ time: new Date(row.t), value: v === undefined ? null : v });
      if (v !== null && v !== undefined) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    ch.summaryData = pts;
    if (mn !== Infinity) {
      // Lane domain for this channel (relayoutLanes builds the pixel scale).
      ch.laneMin = mn;
      ch.laneMax = mx;
      ch.minValue = mn;
      ch.maxValue = mx;
    }
  }

  /** New recorder events: append rows incrementally, slide the window. */
  onRecorderEvent(event) {
    const session = liveRecorder.getSessionSnapshot();
    const st = liveRecorder.getRecorderState();
    this.setState({
      recording: st.recording,
      samples: st.samples,
    });

    if (event === 'cleared') {
      this.anchorT = 0;
      this.latestT = 0;
      this.processedRows = 0;
      return;
    }
    if (!session.rows.length) return;

    // Session restarted (rows were reset) → re-anchor.
    if (this.anchorT && session.rows.length < this.processedRows) {
      this.startSessionWindow(session);
      this.attachAndRender(session);
      return;
    }
    if (!this.anchorT) {
      this.startSessionWindow(session);
      this.attachAndRender(session);
      return;
    }

    // History mode is frozen — only the counters keep moving.
    if (this.state.mode === 'history') {
      return;
    }

    const newRows = session.rows.slice(this.processedRows);
    this.processedRows = session.rows.length;
    this.latestT = session.rows[session.rows.length - 1].t;

    const selected = this.chartController.selectedChannels || [];
    if (newRows.length && selected.length) {
      for (const ch of selected) {
        this.appendRows(ch, newRows);
      }
    }

    this.scheduleLiveRedraw();
  }

  /**
   * Coalesce layout + window advance + redraw into one animation frame —
   * a burst of recorder events (e.g. timers catching up after the app is
   * re-activated) then costs one draw instead of one per event.
   */
  scheduleLiveRedraw() {
    if (this.redrawPending) {
      return;
    }
    this.redrawPending = true;
    requestAnimationFrame(() => {
      this.redrawPending = false;
      if (this.state.mode !== 'live' || !this.latestT) {
        return;
      }
      this.relayoutLanes();
      this.chartController.advanceRecordingWindow(this.latestT);
      if (this.lineChartRef.current) {
        this.lineChartRef.current.redrawLive();
      }
    });
  }

  appendRows(ch, rows) {
    for (const row of rows) {
      const v = row.values[ch.id];
      ch.summaryData.push({ time: new Date(row.t), value: v === undefined ? null : v });
      if (v !== null && v !== undefined) {
        if (!Number.isFinite(ch.laneMin) || v < ch.laneMin) ch.laneMin = v;
        if (!Number.isFinite(ch.laneMax) || v > ch.laneMax) ch.laneMax = v;
      }
    }
  }

  handleRangeChange(min) {
    this.rangeMinutes = min;
    this.setState({ rangeMin: min });
    if (this.chartController.datasourceMode !== 'Recording' || !this.latestT) {
      return;
    }
    if (this.state.mode === 'history') {
      // Keep the window's right edge where it is; just resize.
      const R = min * 60000;
      const session = liveRecorder.getSessionSnapshot();
      const first = session.rows.length ? session.rows[0].t : 0;
      const end = this.chartController.timePeriod.end.getTime();
      let start = end - R;
      start = Math.max(first, Math.min(start, this.latestT - R));
      this.applyHistoryWindow(start, start + R);
    } else {
      this.chartController.setRecordingRange(min, this.anchorT, this.latestT);
      if (this.lineChartRef.current) this.lineChartRef.current.redrawLive();
    }
  }

  /** Freeze refreshing and browse the recorded data like an existing file. */
  toggleBrowseMode() {
    if (this.state.mode === 'live') {
      const ctrl = this.chartController;
      ctrl.datasourceMode = 'RecordingHistory';
      ctrl.timePeriods.length = 0;
      ctrl.currentTimePeriodIndex = -1;
      if (this.lineChartRef.current) this.lineChartRef.current.hideTimePeriod();
      this.setState({ mode: 'history' });
      // Re-run the full layout pipeline so the plot area geometry is
      // re-established for browsing (advanceRecordingWindow is a no-op in
      // this mode, so the current window is kept).
      const session = liveRecorder.getSessionSnapshot();
      if (session.rows.length) {
        this.attachAndRender(session);
      }
      return;
    }
    // Back to live: restore the sliding recording window at the live edge.
    this.setState({ mode: 'live' });
    if (this.lineChartRef.current) this.lineChartRef.current.hideTimePeriod();
    const session = liveRecorder.getSessionSnapshot();
    if (session.rows.length && this.anchorT) {
      this.chartController.initRecordingWindow(this.anchorT, this.rangeMinutes);
      this.attachAndRender(session);
    }
  }

  /** Move the history window by ±¾ of its range, clamped to the session. */
  shiftHistoryWindow(dir) {
    const R = this.rangeMinutes * 60000;
    const session = liveRecorder.getSessionSnapshot();
    if (!session.rows.length) {
      return;
    }
    const first = session.rows[0].t;
    const last = session.rows[session.rows.length - 1].t;
    let start = this.chartController.timePeriod.start.getTime() + dir * R * 0.75;
    start = Math.max(first, Math.min(start, last - R));
    this.applyHistoryWindow(start, start + R);
  }

  /** Zoom out to the whole session. */
  showAllSession() {
    const session = liveRecorder.getSessionSnapshot();
    if (!session.rows.length) {
      return;
    }
    this.applyHistoryWindow(session.rows[0].t, session.rows[session.rows.length - 1].t);
  }

  applyHistoryWindow(startMs, endMs) {
    const ctrl = this.chartController;
    ctrl.timePeriod.start = new Date(startMs);
    ctrl.timePeriod.end = new Date(endMs);
    ctrl.timePeriod.now = new Date(endMs);
    if (ctrl.xScale) {
      ctrl.xScale.domain([ctrl.timePeriod.start, ctrl.timePeriod.end]);
    }
    if (this.lineChartRef.current) {
      // Full pipeline (not the light redraw): re-runs reviseYAxisLayout so
      // chartX/chartWidth bound the curves to the plot area — a plain
      // redrawLive lets curves span the whole view over the y-axes.
      this.lineChartRef.current.changeSelectedChannelsHandler();
    }
  }

  setPosition = (x = null) => {
    const listWidth = $('.channel-list').width() || 280;
    if (x === null) {
      x = this.channelListVisible ? listWidth : 0;
    }

    if (x === 0) {
      this.channelListRef.current.hide();
    } else {
      this.channelListRef.current.show();
    }

    const chartWidth = $('#graphic-view-wrapper').width() - (x === 0 ? 0 : listWidth);
    this.graphicView.style('left', x + 'px').style('width', chartWidth + 'px');
    if (this.lineChartRef.current) this.lineChartRef.current.setWidth(chartWidth);
  };

  switchChannelList = () => {
    this.channelListVisible = !this.channelListVisible;
    this.setPosition();
  };
}

export default LiveGraphicView;
