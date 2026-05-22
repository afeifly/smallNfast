import * as d3 from 'd3';
import DataUtil from '../../util/DataUtil';
import { SystemEvent } from '../../util/SystemConstant';

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
    if (!channel || !channel.id) {
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
      return;
    }

    if (this.isSelectedChannel(channel.id)) {
      return;
    }

    channel.visible = true;
    this.selectedChannels.push(channel);
    const yAxisData = this.channelToYAxisData(channel);
    if (yAxisData) {
      this.yAxisDataset.push(yAxisData);
    }
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

    this.timePeriod.start = new Date(this.historyTimeRange.start);
    this.timePeriod.end = new Date();

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

  startTimer = () => {
    clearInterval(this.timer);

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
    if (this.datasourceMode === 'Realtime') {
      clearInterval(this.timer);
    }
  }
};

export default ChartController;