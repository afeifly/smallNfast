import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';

import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PrintIcon from '@mui/icons-material/Print';
import RangeIcon from '@mui/icons-material/DateRange';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
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

// CSD mode is active when the app is started with `npm run dev:csd`
const isCsdMode = import.meta.env.VITE_USE_CSD === 'true';


class GraphicView extends Component {

  constructor() {
    super();
    this.channelListRef = React.createRef();
    this.graphicViewRef = React.createRef();
    this.lineChartRef = React.createRef();
    this.loadingRef = React.createRef();
    this.ySettingRef = React.createRef();
    this.channelSettingRef = React.createRef();
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
        <ChannelList ref={this.channelListRef} chartController={this.chartController} />

        <div className="graphic-view" ref={this.graphicViewRef}>
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

              {/* Open CSD File button — only shown in CSD mode */}
              {isCsdMode && (
                <Tooltip title="Open CSD File">
                  <IconButton
                    id="open-csd-file-btn"
                    style={{ ...buttonStyle, color: '#00B8D9' }}
                    onClick={this.openCsdFile}
                  >
                    <FolderOpenIcon style={iconStyle} />
                  </IconButton>
                </Tooltip>
              )}

              {/* Channel list button */}
              <Tooltip title={intl.get('CHANNEL')}>
                <IconButton onClick={() => this.switchChannelList()} style={buttonStyle}>
                  <ListAltIcon style={iconStyle} />
                </IconButton>
              </Tooltip>
            </div>

          </div>

          <LineChart ref={this.lineChartRef} chartController={this.chartController} />
          <Loading ref={this.loadingRef} />
          <YAxisSetting ref={this.ySettingRef} />
          <ChannelSetting ref={this.channelSettingRef} />
        </div>
      </div>

    );
  }

  componentDidMount() {
    this.graphicView = d3.select(this.graphicViewRef.current);

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

    // In CSD mode: register callback so we refresh immediately once a file is loaded
    if (isCsdMode && TestAPI.onFileLoaded) {
      TestAPI.onFileLoaded(() => {
        console.log('[GraphicView] CSD file loaded — refreshing data...');
        this.getData();
      });
    }

    this.setPosition(0);
    this.initToggleButton('realtime');

    d3.select(window).on('resize.updateChart', () => {
      let chartX = 0;

      if (this.channelListVisible) {
        chartX = $('.channel-list').width() + 20;
      }

      const chartWidth = window.innerWidth - chartX;
      this.graphicView.style('width', chartWidth + 'px');
      this.lineChartRef.current.updateHeight();
      this.lineChartRef.current.setWidth(chartWidth);
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
        this.loadingRef.current.show();
      })
      .on(SystemEvent.LOADING_DATA_COMPLETED, () => {
        this.loadingRef.current.hide();
        this.lineChartRef.current.updateYAxis();
      })
      .on(SystemEvent.NO_SELECTED_CHANNELS, () => {
        d3.select('.chart-placeholder').attr('data-status', 'active');
        this.loadingRef.current.hide();
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
      .on(SystemEvent.SHOW_YAXIS_SETTING, (event) => {
        const channel = event.detail;
        if (!channel) {
          return;
        }

        this.ySettingRef.current.handleClickOpen(channel);
      })
      .on(SystemEvent.CLOSE_YAXIS_SETTING, () => {
        this.setState({
          showYAxisSetting: false
        });
      })
      .on(SystemEvent.SHOW_CHANNEL_SETTING, (event) => {
        const channel = event.detail;
        if (!channel) {
          return;
        }

        this.channelSettingRef.current.handleClickOpen(channel);
      });
  }

  componentWillUnmount() {
    this.chartController.clearTimer();
    d3.select(window).on('resize.updateChart', null);
  }


  getUserSettingsHandler = (responseData) => {
    if (!responseData) {
      this.loadingRef.current.hide();
      return;
    }

    const result = responseData[0];

    if (!result) {
      this.channelListRef.current.getData();
      this.setState({
        noLoggingChannels: true
      });
      this.loadingRef.current.hide();
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
      this.lineChartRef.current.setNoLoggingChannels(true);
      this.loadingRef.current.hide();
    }


    this.channelListRef.current.getData();
  };


  getData = () => {
    this.loadingRef.current.show();
    const username = localStorage.getItem('username');

    if (username) {
      TestAPI.getUserSettings(username, this.getUserSettingsHandler);
    } else {
      this.loadingRef.current.hide();
    }
  };


  initData = () => {
    const selectedChannels = this.chartController.selectedChannels;
    if (!selectedChannels) {
      this.loadingRef.current.hide();
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
      if (this.lineChartRef.current) {
        this.lineChartRef.current.changeSelectedChannelsHandler();
      }

      this.loadingRef.current.hide();
    }
  };


  setPosition = (x = null) => {
    let chartX = 0;
    let chartWidth = 0;

    if (x === 0) {
      chartX = x;
      this.channelListRef.current.hide();
    } else {
      chartX = $('.channel-list').width() + 20;
      this.channelListRef.current.show();
    }

    chartWidth = $('#graphic-view-wrapper').width() - chartX;

    this.graphicView.style('left', x + 'px')
      .style('width', chartWidth + 'px');

    this.lineChartRef.current.setWidth(chartWidth);
  };



  switchDataSource = (type) => {
    this.loadingRef.current.show();
    this.initToggleButton(type);

    setTimeout(() => {
      if (type === 'realtime') {
        this.chartController.openRealtimeMode();
        this.lineChartRef.current.updateViewForRealtimeMode();
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
    this.lineChartRef.current.updateDenoisingSetting();

    this.setState({
      denoisingChecked: checked,
    })
  };


  resetTimePeriod = () => {
    this.lineChartRef.current.resetTimePeriod();
  }


  showOrHideTimePeriod = () => {
    this.lineChartRef.current.showOrHideTimePeriod();
  };


  switchChannelList = () => {
    this.channelListVisible = !this.channelListVisible;

    if (this.channelListVisible) {
      this.setPosition(420);
    } else {
      this.setPosition(0);
    }
  };


  openCsdFile = () => {
    if (TestAPI.openFile) {
      // Register a one-shot callback to reload data once the file parses
      TestAPI.onFileLoaded(() => {
        console.log('[GraphicView] CSD file loaded — refreshing data...');
        this.getData();
      });
      TestAPI.openFile();
    }
  };


  printChart = () => {
    this.lineChartRef.current.printChart();
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

    this.lineChartRef.current.changeSelectedChannelsHandler();
  };

}


export default GraphicView;
