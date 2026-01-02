import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';

import Tooltip from '@material-ui/core/Tooltip';
import IconButton from '@material-ui/core/IconButton';
import ListAltIcon from '@material-ui/icons/ListAlt';
import PrintIcon from '@material-ui/icons/Print';
import RangeIcon from '@material-ui/icons/DateRange';
import intl from "react-intl-universal";

import ChannelList from '../channel/ChannelList';
import LineChart from './LineChart';
import YAxisSetting from './YAxisSetting';
import { SystemEvent } from '../../util/SystemConstant';
import ChartController from './ChartController';
import ChannelSetting from '../channel/ChannelSetting';
import TestAPI from '../../api/TestAPI';
import DataUtil from '../../util/DataUtil';
import Loading from '../../components/loading/Loading';

import './css/GraphicView.css';

class GraphicView extends Component {

  constructor() {
    super();
    this.state = {
      showYAxisSetting: false,
      showChannelSetting: false,
      dataType: 'Realtime',
      denoisingChecked: true,
      noLoggingChannels: true,
    }

    this.chartController = new ChartController();
    this.graphicView = null;
    this.channelListVisible = false;
  }

  render() {
    const { noLoggingChannels } = this.state;
    let actionButtonsEnabled = '';

    const buttonStyle = {
      paddingTop: 8,
      width: 40,
      height: 40,
      marginLeft: 4
    };

    const iconStyle = {
      fontSize: "24px"
    }

    let timeSelectorEnabled = true;

    if (this.chartController.datasourceMode === 'Realtime') {
      timeSelectorEnabled = false;
    }

    if (noLoggingChannels) {
      actionButtonsEnabled = 'disabled';
    }

    return (
      <div id="graphic-view-wrapper">
        <ChannelList ref="channelList" chartController={this.chartController} />

        <div className="graphic-view" ref="graphicView">
          <div className="app-window-title">
            <span>{intl.get('GRAPHIC_VIEW')}</span>

            <div className="window-title-right-area">
              <div className="toggle-button-group" >
                <div className="toggle-selected-mask" />
                <div className="toggle-button" data-type="realtime"
                  onClick={() => this.switchDataSource('realtime')}>
                  {intl.get('REALTIME_DATA')}
                </div>
                <div className="toggle-button" data-type="history"
                  onClick={() => this.switchDataSource('history')}>
                  {intl.get('HISTORY_DATA')}
                </div>
              </div>

              {/* Time period button */}
              <Tooltip title={intl.get('TIME_PERIOD')}>
                <div>
                  <IconButton style={buttonStyle}
                    disabled={!timeSelectorEnabled}
                    onClick={() => this.showOrHideTimePeriod()}>
                    <RangeIcon style={iconStyle} />
                  </IconButton>
                </div>
              </Tooltip>

              {/* Print button */}
              <Tooltip title={intl.get('PRINT')}>
                <div>
                  <IconButton style={buttonStyle}
                    disabled={noLoggingChannels}
                    onClick={this.printChart}>
                    <PrintIcon style={iconStyle} />
                  </IconButton>
                </div>
              </Tooltip>

              {/* Channel list button */}
              <Tooltip title={intl.get('CHANNEL')}>
                <IconButton onClick={() => this.switchChannelList()} style={buttonStyle}>
                  <ListAltIcon style={iconStyle} />
                </IconButton>
              </Tooltip>
            </div>

          </div>

          <LineChart ref="lineChart" chartController={this.chartController} />
          <Loading ref="loading" />
          <YAxisSetting ref="ySetting" />
          <ChannelSetting ref="channelSetting" />
        </div>
      </div>

    );
  }

  componentDidMount() {
    this.graphicView = d3.select(this.refs.graphicView);

    // Expose for Flutter/External control
    window.updateChannelData = (channelId, data) => {
      const channel = this.chartController.selectedChannels.find(c => c.id === channelId);
      if (channel) {
        // Mocking the structure expected by DataUtil.handleMeasurementData
        // The API returns [ { ... } ], so we expect 'data' to be that object
        DataUtil.handleMeasurementData(channel, data);
        d3.select('#line-chart').dispatch('changeTimePeriod');
      } else {
        console.warn('Channel not found:', channelId);
      }
    };

    // allow accessing controller
    window.chartController = this.chartController;


    //Read current user settings
    this.getData();

    this.setPosition(0);
    this.initToggleButton('realtime');

    d3.select(window).on('resize.updateChart', () => {
      let chartX = 0;

      if (this.channelListVisible) {
        chartX = $('.channel-list').width() + 20;
      }

      const chartWidth = window.innerWidth - chartX;
      this.graphicView.style('width', chartWidth + 'px');
      this.refs.lineChart.updateHeight();
      this.refs.lineChart.setWidth(chartWidth);
    });

    //Change browser tabs, need to hand the timer of reading data
    d3.select('#App').on('checkTimer', () => {
      if (this.chartController.datasourceMode !== 'Realtime') {
        return;
      }

      if (document.visibilityState === 'hidden') {
        this.chartController.clearTimer();
      } else {
        this.chartController.startTimer();
      }
    });

    this.graphicView
      .on(SystemEvent.REFRESH_GRAPHIC_VIEW, () => {
        this.getData();
      })
      .on(SystemEvent.LOADING_DATA, () => {
        this.refs.loading.show();
      })
      .on(SystemEvent.LOADING_DATA_COMPLETED, () => {
        this.refs.loading.hide();
        this.refs.lineChart.updateYAxis();
      })
      .on(SystemEvent.NO_SELECTED_CHANNELS, () => {
        d3.select('.chart-placeholder').attr('data-status', 'active');
        this.refs.loading.hide();
      })
      .on(SystemEvent.CHANGE_SELECTED_CHANNELS, this.changeSelectedChannelsHandler)
      .on(SystemEvent.HIDE_CHANNEL_LIST, () => {
        this.setPosition(0);
      })
      .on(SystemEvent.SHOW_CHANNEL_LIST, () => {
        this.setPosition();
      })
      .on(SystemEvent.INIT_SELECTED_CHANNELS, () => {
        this.initData();
      })
      .on(SystemEvent.SHOW_YAXIS_SETTING, () => {
        const channel = d3.event.detail;
        if (!channel) {
          return;
        }

        this.refs.ySetting.handleClickOpen(channel);
      })
      .on(SystemEvent.CLOSE_YAXIS_SETTING, () => {
        this.setState({
          showYAxisSetting: false
        });
      })
      .on(SystemEvent.SHOW_CHANNEL_SETTING, () => {
        const channel = d3.event.detail;
        if (!channel) {
          return;
        }

        this.refs.channelSetting.handleClickOpen(channel);
      });
  }

  componentWillUnmount() {
    this.chartController.clearTimer();
    d3.select(window).on('resize.updateChart', null);
  }


  getUserSettingsHandler = (responseData) => {
    if (!responseData) {
      this.refs.loading.hide();
      return;
    }

    const result = responseData[0];

    if (!result) {
      this.refs.channelList.getData();
      this.setState({
        noLoggingChannels: true
      });
      this.refs.loading.hide();
      return;
    }

    const displayChannelOption = result.display_channel_option;
    const displayChannels = {};

    let d, id, channelObj;
    for (let i = 0; i < displayChannelOption.length; i++) {
      d = displayChannelOption[i];
      id = d.channel_id.channel_id;
      channelObj = {
        id: id,
        color: d.color,
      };

      displayChannels[id] = channelObj;
    }

    //displayChannels is not {}
    if (Object.keys(displayChannels).length > 0) {
      this.setState({
        noLoggingChannels: false
      });
      this.chartController.setDisplayChannels(displayChannels);
    } else {
      this.refs.lineChart.setNoLoggingChannels(true);
      this.refs.loading.hide();
    }


    this.refs.channelList.getData();
  };


  getData = () => {
    this.refs.loading.show();
    const username = localStorage.getItem('username');

    if (username) {
      TestAPI.getUserSettings(username, this.getUserSettingsHandler);
    } else {
      this.refs.loading.hide();
    }
  };


  initData = () => {
    const selectedChannels = this.chartController.selectedChannels;
    if (!selectedChannels) {
      this.refs.loading.hide();
      return;
    }

    if (this.chartController.datasourceMode === 'Realtime') {
      setTimeout(() => {
        //Scenario: switch to "History" mode in 5 seconds
        if (this.chartController.datasourceMode === 'Realtime') {
          this.chartController.startTimer();
        }
      }, 5000);
    }

    for (let i = 0; i < selectedChannels.length; i++) {
      const channel = selectedChannels[i];
      if (channel) {
        channel.dataLoading = true; //Set the status
        this.getMeasurementData(channel);
      }
    }
  }


  getMeasurementData(channel) {
    const interval = this.chartController.computeTableInterval();
    let startTime = this.chartController.timePeriod.start.getTime();
    let endTime = this.chartController.timePeriod.end.getTime();

    if (this.chartController.datasourceMode === 'Realtime') {
      endTime = this.chartController.timePeriod.now.getTime();
    }

    startTime += 3600000 * 8;
    endTime += 3600000 * 8;

    TestAPI.getMeasurementData(channel.id,
      startTime,
      endTime,
      interval,
      2,
      (responseData) => this.getMeasurementDataHandler(channel, responseData)
    );
  }


  getMeasurementDataHandler = (channel, responseData) => {
    channel.dataLoading = false;  //Reset the status
    if (responseData) {
      const result = responseData[0];
      DataUtil.handleMeasurementData(channel, result);
    }

    let allDone = true;  //All channels get data complete
    this.chartController.selectedChannels.forEach(d => {
      if (d.dataLoading) {
        allDone = false;
      }
    });

    if (allDone) {
      if (this.refs.lineChart) {
        this.refs.lineChart.changeSelectedChannelsHandler();
      }

      this.refs.loading.hide();
    }
  };


  setPosition = (x = null) => {
    let chartX = 0;
    let chartWidth = 0;

    if (x === 0) {
      chartX = x;
      this.refs.channelList.hide();
    } else {
      chartX = $('.channel-list').width() + 20;
      this.refs.channelList.show();
    }

    chartWidth = $('#graphic-view-wrapper').width() - chartX;

    this.graphicView.style('left', x + 'px')
      .style('width', chartWidth + 'px');

    this.refs.lineChart.setWidth(chartWidth);
  };



  switchDataSource = (type) => {
    this.refs.loading.show();
    this.initToggleButton(type);

    setTimeout(() => {
      if (type === 'realtime') {
        this.chartController.openRealtimeMode();
        this.refs.lineChart.updateViewForRealtimeMode();
      } else {
        // if(this.chartController.displayChannels
        //   && this.chartController.displayChannels.length > 0) {
        //   this.refs.loading.show();
        // }

        this.chartController.openHistoryMode();
      }

      this.updateControlButtons(type);
    }, 350);
  }


  initToggleButton(type) {
    const currentBtn = $(`.toggle-button[data-type=${type}]`);
    if (!currentBtn) {
      return;
    }

    const x = Math.round(currentBtn.position().left);
    const w = Math.round(currentBtn.width()) + 62;

    $('.toggle-button').attr('data-status', '');
    currentBtn.attr('data-status', 'selected');

    $('.toggle-selected-mask')
      .attr('data-type', type)
      .css('width', w + 'px')
      .css('transform', `translateX(${x}px)`);
  }

  updateDenoisingSetting = (event) => {
    // const { chartController } = this.props;
    const checked = event.target.checked;

    this.chartController.denoising = checked;
    this.refs.lineChart.updateDenoisingSetting();

    this.setState({
      denoisingChecked: checked,
    })
  };


  resetTimePeriod = () => {
    this.refs.lineChart.resetTimePeriod();
  }


  showOrHideTimePeriod = () => {
    this.refs.lineChart.showOrHideTimePeriod();
  };


  switchChannelList = () => {
    this.channelListVisible = !this.channelListVisible;

    if (this.channelListVisible) {
      this.setPosition(420);
    } else {
      this.setPosition(0);
    }
  };


  printChart = () => {
    this.refs.lineChart.printChart();
  };


  updateControlButtons = (type) => {
    this.setState({
      dataType: type
    });
  };


  changeSelectedChannelsHandler = () => {
    const { selectedChannels } = this.chartController;
    if (selectedChannels && selectedChannels.length === 0) {
      this.setState({
        noLoggingChannels: true
      });
    } else {
      this.setState({
        noLoggingChannels: false
      });
    }

    this.refs.lineChart.changeSelectedChannelsHandler();
  };

}


export default GraphicView;
