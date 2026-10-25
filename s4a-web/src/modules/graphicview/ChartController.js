import * as d3 from 'd3';
import DataUtil from '../../util/DataUtil';
import { SystemEvent } from '../../util/SystemConstant';

/**
 * Pure sliding-window computation for the live recording chart.
 *
 * The x-axis keeps a fixed `rangeMs` window anchored at the recording start.
 * While the newest sample is inside the window nothing moves. Once it reaches
 * the right edge, the whole window jumps forward by 3/4 of the range (i.e.
 * the axis "moves 3/4 to the left"), so a quarter of the old curves stays
 * visible and the range never changes. Long gaps may require several jumps.
 *
 * @returns {{start: number, end: number, shifted: boolean}}
 */
export function nextRecordingWindow(latestMs, startMs, endMs, rangeMs) {
  if (!(rangeMs > 0) || !(endMs > startMs)) {
    return { start: startMs, end: endMs, shifted: false };
  }
  if (latestMs < endMs) {
    return { start: startMs, end: endMs, shifted: false };
  }
  const shift = rangeMs * 0.75;
  let end = endMs;
  while (latestMs >= end) {
    end += shift;
  }
  return { start: end - rangeMs, end, shifted: true };
}

/** Max distinct units (= y-axes). Same-unit channels on one axis are unlimited. */
export const MAX_Y_AXIS_COUNT = 4;

/**
 * A "reasonable" human y-axis range for [min, max]:
 *  - non-negative data starts at 0 (4.30–4.45 → 0–5, 156–160 → 0–200)
 *  - all-negative data ends at 0; mixed data keeps nice ends on both sides
 *  - the outer ends get ~5% headroom and round to 1/2/2.5/5 × 10ⁿ steps
 * The range never hugs the data — a handful of early samples still produce
 * a wide, readable scale.
 */
export function niceRange(min, max) {
  const round6 = (v) => Math.round(v * 1e6) / 1e6;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0, 10];
  }
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  }
  const niceStep = (x) => {
    if (!(x > 0)) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(x)));
    for (const m of [1, 2, 2.5, 5, 10]) {
      if (x <= m * pow) {
        return m * pow;
      }
    }
    return 10 * pow;
  };
  const step = niceStep(Math.max(Math.abs(min), Math.abs(max)) / 5);

  let lo = 0;
  let hi = 0;
  if (min < 0) {
    lo = Math.floor((min * 1.05) / step) * step;
  }
  if (max > 0) {
    hi = Math.ceil((max * 1.05) / step) * step;
  }
  if (hi === lo) {
    hi = lo + step;
  }
  return [round6(lo), round6(hi)];
}

/**
 * Top anchors (percent of chart height) for the stacked lanes of channels
 * sharing one y-axis: the axis' first (main) channel tops out at 70%, the
 * next at 60%, 50%, … — a clear 10% ladder. The step compresses only when
 * many channels share one axis and a 10% ladder would fall below the limit.
 */
export function laneAnchors(count, topPercent = 70, bottomLimitPercent = 8) {
  const n = Math.max(1, Math.floor(count));
  if (n === 1) {
    return [topPercent];
  }
  const step = Math.min(10, (topPercent - bottomLimitPercent) / (n - 1));
  const round6 = (v) => Math.round(v * 1e6) / 1e6;
  return Array.from({ length: n }, (_, i) => round6(topPercent - i * step));
}

class ChartController {

  constructor() {
    this.chartWidth = 0;
    this.chartHeight = 0;
    this.chartX = 0;
    this.denoising = false;
    this.selectedChannels = [];
    this.displayChannels = null;  //Get the settings from server
    this.yAxisDataset = [];
    this.channelVisible = false;
    this.datasourceMode = 'Realtime'; // or History

    if (this.datasourceMode === 'Realtime') {
      this.initTimePeriodForRealtime();
    }

    const now = new Date();
    const currentYearJan1 = new Date(now.getFullYear(), 0, 1);

    this.historyTimeRange = {
      start: currentYearJan1,
      end: now
    };
    this.timePeriodVisible = false;

    //Record the time period each time the user selects
    this.timePeriods = [];
    this.currentTimePeriodIndex = -1;


    this.xScale = d3.scaleTime().domain([this.timePeriod.start, this.timePeriod.end]);
    this.timer = null;
    this.resetEnable = false;
  }

  /**
   * set the chart computed width
   * @param width 
   */
  setChartWidth(width) {
    this.chartWidth = width;
    if (this.xScale) {
      this.xScale.range([0, width]);
    }
  }

  setChartHeight(height) {
    this.chartHeight = height;
  }

  setChartX(x) {
    this.chartX = x;
  }

  setXScale(scale) {
    this.xScale = scale;
  }


  /**
   * 
   * @param {Map} channelsObj 
   */
  setDisplayChannels(channelsObj) {
    this.displayChannels = channelsObj;
  }

  isDisplayChannel(channelId) {
    if (!channelId || !this.displayChannels) {
      return false;
    }

    if (this.displayChannels.hasOwnProperty(channelId)) {
      return true;
    } else {
      return false;
    }
  }

  setColorFromSetting(channel) {
    if (!channel || !channel.id || !this.displayChannels) {
      return;
    }

    //Setting object
    const displayChannel = this.displayChannels[channel.id];
    if (displayChannel && displayChannel.color) {
      channel.color = displayChannel.color;
    }
  }


  setTimePeriod(timePeriod) {
    clearInterval(this.timer);

    this.timePeriods.push(timePeriod);
    this.currentTimePeriodIndex = this.timePeriods.length - 1;

    this.timePeriod = timePeriod;
    if (this.xScale) {
      this.xScale.domain([timePeriod.start, timePeriod.end]);
      this.resetEnable = true;
    }
  }

  gotoPreTimePeriod() {
    this.currentTimePeriodIndex--;
    const tempTimeperiod = this.getTimePeriodByIndex(this.currentTimePeriodIndex);

    if (tempTimeperiod) {
      this.timePeriod = tempTimeperiod;
      if (this.xScale) {
        this.xScale.domain([this.timePeriod.start, this.timePeriod.end]);
      }
    }
  }

  gotoNextTimePeriod() {
    this.currentTimePeriodIndex++;
    const tempTimeperiod = this.getTimePeriodByIndex(this.currentTimePeriodIndex);

    if (tempTimeperiod) {
      this.timePeriod = tempTimeperiod;
      if (this.xScale) {
        this.xScale.domain([this.timePeriod.start, this.timePeriod.end]);
      }
    }
  }

  getTimePeriodByIndex(index) {
    if (index > -1 && index < this.timePeriods.length) {
      return this.timePeriods[index];
    }

    return null;
  }

  addSelectedChannel(channel) {
    if (!channel) {
      return false;
    }

    if (this.isSelectedChannel(channel.id)) {
      return false;
    }

    // Cap distinct units (= y-axes) at the single choke point — this covers
    // manual selection, init auto-selection and stale localStorage picks.
    // Same-unit channels keep joining their existing axis without limit.
    const unitKnown = this.yAxisDataset.some((d) => d && d.unit === channel.unit);
    if (!unitKnown && this.yAxisDataset.length >= MAX_Y_AXIS_COUNT) {
      console.warn(
        `[ChartController] max ${MAX_Y_AXIS_COUNT} y-axes reached — channel ${channel.id} (${channel.unit || 'no unit'}) rejected`
      );
      return false;
    }

    channel.visible = true;
    this.selectedChannels.push(channel);
    const yAxisData = this.channelToYAxisData(channel);
    if (yAxisData) {
      this.yAxisDataset.push(yAxisData);
    }
    return true;
  }

  isSelectedChannel(id) {
    for (let i = 0; i < this.selectedChannels.length; i++) {
      const d = this.selectedChannels[i];
      if (d.id === id) {
        return true;
      }
    }

    return false;
  }


  setSelectedChannels(channels) {
    this.selectedChannels = channels;

    for (let i = 0; i < this.yAxisDataset.length; i++) {
      const d = this.yAxisDataset[i];
      if (d) {
        d.valid = false;
      }
    }

    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      const yAxisData = this.channelToYAxisData(channel);

      if (yAxisData) {
        this.yAxisDataset.push(yAxisData);
      }
    }

    //remove invaild y-data(the channel has been unselected)
    this.yAxisDataset = this.yAxisDataset.filter(d => d.valid);
  }


  channelToYAxisData(channel) {
    if (!channel) {
      return null;
    }

    for (let i = 0; i < this.yAxisDataset.length; i++) {
      const d = this.yAxisDataset[i];

      //same unit
      if (d && d.unit === channel.unit) {
        let min = d.scale.domain()[0];
        let max = d.scale.domain()[1];
        let domainChanged = false;

        channel.yAxisData = d;
        channel.scale = d.scale;
        d.channelIds.push(channel.id);
        d.valid = true;

        if (channel.minValue >= min && channel.maxValue <= max) {
          return null;
        }

        if (channel.minValue < min) {
          min = channel.minValue;
          domainChanged = true;
        }

        if (channel.maxValue > max) {
          max = channel.maxValue;
          domainChanged = true;
        }

        if (domainChanged) {
          channel.minValue = min;
          channel.maxValue = max;
          d.scale.domain([min, max]);
        }
        return null;
      }
    }

    let min = 0,
      max = 0;
    if (channel.minValue) {
      min = channel.minValue;
    }

    if (channel.maxValue) {
      max = channel.maxValue;
    }

    const newYData = {
      id: DataUtil.randomString(8),
      index: this.yAxisDataset.length,
      channelIds: [channel.id],
      scale: d3.scaleLinear()
        .domain([min, max])
        .rangeRound([this.chartHeight, 0]),
      color: channel.color,
      x: 0,
      y: 0,
      minValue: 0,
      maxValue: 0,
      ticks: 10,
      unit: channel.unit,
      valid: true
    }

    channel.yAxisData = newYData;
    channel.scale = newYData.scale;
    return newYData;
  }

  computeTableInterval() {
    let interval = 1;
    let timeLength = 1;

    if (this.datasourceMode === 'History') {
      timeLength = (this.timePeriod.end.getTime() - this.timePeriod.start.getTime()) / 1000;
    } else {
      timeLength = (new Date().getTime() - this.timePeriod.start.getTime()) / 1000;
    }

    if ((timeLength > (10 * 3600)) && (timeLength <= (2.5 * 24 * 3600))) {
      interval = 10;
    } else if ((timeLength > (2.5 * 24 * 3600)) && (timeLength <= (25 * 24 * 3600))) {
      interval = 60;
    } else if ((timeLength > (25 * 24 * 3600)) && (timeLength < (150 * 24 * 3600))) {
      interval = 600;
    } else if ((timeLength > (150 * 24 * 3600))) {
      interval = 3600;
    }

    return interval;
  }


  computetimesPerPix() {
    let timesPerPix = (this.timePeriod.end.getTime() - this.timePeriod.start.getTime())
      / this.chartWidth;
    return timesPerPix;
  }


  removeSelectedChannel(id) {
    let index = -1;

    //Get index in selected channels Array
    for (let i = 0; i < this.selectedChannels.length; i++) {
      const channel = this.selectedChannels[i];
      if (channel.id === id) {
        index = i;
        break;
      }
    }

    //Remove from selected channels Array
    if (index !== -1) {
      this.selectedChannels.splice(index, 1);
    }

    //Handle the related y-axis data 
    for (let j = 0; j < this.yAxisDataset.length; j++) {
      const yData = this.yAxisDataset[j];
      const yIndex = yData.channelIds.indexOf(id);
      if (yIndex !== -1) {
        yData.channelIds.splice(yIndex, 1);

        if (yData.channelIds.length === 0) {
          //Remove the invalid yData
          yData.valid = false;
          this.yAxisDataset = this.yAxisDataset.filter(d => d.valid);

          //Reset index
          for (let k = 0; k < this.yAxisDataset.length; k++) {
            const d = this.yAxisDataset[k];
            d.index = k;
          }
        }

        break;
      }
    }
  }

  openHistoryMode() {
    this.datasourceMode = 'History';
    this.denoising = true;
    this.resetEnable = false;

    //Stop the timer of reading data realtime
    clearInterval(this.timer);

    // Restore the full time range from historyTimeRange.
    // In CSD mode historyTimeRange.end is the file's stop timestamp (not today),
    // so Reset always brings back the whole file view regardless of the current time.
    this.timePeriod.start = new Date(this.historyTimeRange.start);
    this.timePeriod.end   = new Date(this.historyTimeRange.end);

    //Reset time periods record
    this.timePeriods.length = 0;
    this.currentTimePeriodIndex = -1;

    this.xScale.domain([this.timePeriod.start, this.timePeriod.end]);
    d3.select('#line-chart').dispatch('changeTimePeriod');
  }

  openRealtimeMode() {
    this.datasourceMode = 'Realtime';
    this.denoising = false;
    this.resetEnable = false;

    this.startTimer();
  };

  // ---- Live recording window mode ----
  // Used by the live Graphic View while a recording session is running.
  // The window is anchored at the first sample and slides in 3/4-range jumps
  // (see nextRecordingWindow). Data is fed externally by the live view — this
  // mode never polls TestAPI and never starts a timer.

  initRecordingWindow(anchorMs, rangeMinutes = 30) {
    this.clearTimer();
    this.datasourceMode = 'Recording';
    this.denoising = false;
    this.resetEnable = false;
    this.recordingRangeMs = rangeMinutes * 60000;
    this.timePeriods.length = 0;
    this.currentTimePeriodIndex = -1;
    this.timePeriod = {
      start: new Date(anchorMs),
      end: new Date(anchorMs + this.recordingRangeMs),
      now: new Date(anchorMs),
    };
    if (this.xScale) {
      this.xScale.domain([this.timePeriod.start, this.timePeriod.end]);
    }
  }

  /** Switch between the 30 / 60 min window without losing the anchor. */
  setRecordingRange(rangeMinutes, anchorMs, latestMs) {
    this.recordingRangeMs = rangeMinutes * 60000;
    if (this.datasourceMode !== 'Recording' || !this.recordingRangeMs) {
      return;
    }
    // Guard against falsy-zero timestamps (a 0 anchor is a legitimate value).
    const anchor = Number.isFinite(anchorMs) ? anchorMs : this.timePeriod.start.getTime();
    const latest = Number.isFinite(latestMs) ? latestMs : anchor;
    const start = Math.max(anchor, latest - this.recordingRangeMs);
    this.timePeriod.start = new Date(start);
    this.timePeriod.end = new Date(start + this.recordingRangeMs);
    this.timePeriod.now = new Date(latest);
    if (this.xScale) {
      this.xScale.domain([this.timePeriod.start, this.timePeriod.end]);
    }
  }

  /**
   * Slide the window when the newest sample reaches the right edge.
   * The caller (LiveGraphicView) owns redrawing — no d3 event is dispatched
   * here, because the stock 'changeTimePeriod' handler refetches via TestAPI.
   * @returns {boolean} whether the window shifted
   */
  advanceRecordingWindow(latestMs) {
    if (this.datasourceMode !== 'Recording' || !this.recordingRangeMs) {
      return false;
    }
    this.timePeriod.now = new Date(latestMs);
    const next = nextRecordingWindow(
      latestMs,
      this.timePeriod.start.getTime(),
      this.timePeriod.end.getTime(),
      this.recordingRangeMs
    );
    if (next.shifted) {
      this.timePeriod.start = new Date(next.start);
      this.timePeriod.end = new Date(next.end);
      if (this.xScale) {
        this.xScale.domain([this.timePeriod.start, this.timePeriod.end]);
      }
    }
    return next.shifted;
  }

  startTimer = () => {
    this.clearTimer();

    //Refresh data immediately
    this.showRealtimeData();

    //Continuously refresh data by timer
    let interval = Math.round(3600000 / this.chartWidth) * 2; //1 hour
    if (interval < 1000) {
      interval = 1000;
    }

    this.timer = setInterval(() => {
      this.showRealtimeData();
    }, interval);
  }

  initTimePeriodForRealtime() {
    let now = new Date();
    // now = new Date(now.getTime() + 3600000 * 8);

    this.timePeriod = {
      start: new Date(now.getTime() - 3600000 * 0.3),
      end: new Date(now.getTime() + 3600000 * 0.7),
      now: now
    };
  }

  showRealtimeData() {
    let now = new Date();

    if (now.getTime() >= this.timePeriod.end.getTime()) {
      this.timePeriod.start = new Date(now.getTime() - 3600000 * 0.3);
      this.timePeriod.end = new Date(now.getTime() + 3600000 * 0.7);
      this.xScale.domain([this.timePeriod.start, this.timePeriod.end]);
    }
    this.timePeriod.now = now;
    d3.select('#line-chart').dispatch('changeTimePeriod');
  }


  handleDataLoadingStatus() {
    let allDone = true;  //All channels get data complete
    this.selectedChannels.forEach(d => {
      if (d.dataLoading) {
        allDone = false;
      }
    });

    if (allDone) {
      d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA_COMPLETED);
    }
  }


  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
};

export default ChartController;