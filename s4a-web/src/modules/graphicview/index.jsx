import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';

import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ShareIcon from '@mui/icons-material/Share';
import RangeIcon from '@mui/icons-material/DateRange';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
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
      dataType: isCsdMode ? 'History' : 'Realtime',
      denoisingChecked: true,
      noLoggingChannels: true,
      recentFilesOpen: false,
      recentFiles: [],
      shareMenuAnchorEl: null,
    }

    this.chartController = new ChartController();
    if (isCsdMode) {
      this.chartController.datasourceMode = 'History';
    }
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
              {!isCsdMode && (
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
              )}

              {/* Channel list button */}
              <Tooltip title={intl.get('CHANNEL')}>
                <div>
                  <IconButton onClick={() => this.switchChannelList()} style={buttonStyle}
                    disabled={noLoggingChannels}
                    disableRipple>
                    <ListAltIcon style={iconStyle} />
                  </IconButton>
                </div>
              </Tooltip>

              {/* Time period button */}
              <Tooltip title={intl.get('TIME_PERIOD')}>
                <div>
                  <IconButton style={buttonStyle}
                    disabled={noLoggingChannels || !timeSelectorEnabled}
                    onClick={() => this.showOrHideTimePeriod()}
                    disableRipple>
                    <RangeIcon style={iconStyle} />
                  </IconButton>
                </div>
              </Tooltip>

              {/* Open CSD File button — only shown in CSD mode */}
              {isCsdMode && (
                <Tooltip title="Open CSD File">
                  <IconButton
                    id="open-csd-file-btn"
                    style={buttonStyle}
                    onClick={this.openCsdFile}
                    disableRipple
                  >
                    <FolderOpenIcon style={iconStyle} />
                  </IconButton>
                </Tooltip>
              )}

              {/* Print / Export button */}
              <Tooltip title={isCsdMode ? "Export / Print" : intl.get('PRINT')}>
                <div>
                  <IconButton style={buttonStyle}
                    disabled={noLoggingChannels}
                    onClick={this.handleShareClick}
                    disableRipple>
                    <ShareIcon style={iconStyle} />
                  </IconButton>
                </div>
              </Tooltip>

              <Menu
                anchorEl={this.state.shareMenuAnchorEl}
                open={Boolean(this.state.shareMenuAnchorEl)}
                onClose={this.handleShareClose}
              >
                <MenuItem onClick={this.handlePrintOption}>
                  {intl.get('PRINT')}
                </MenuItem>
                {isCsdMode && (
                  <MenuItem onClick={this.handleExportCsvOption}>
                    Export all CSD to CSV
                  </MenuItem>
                )}
                {isCsdMode && (
                  <MenuItem onClick={this.handleExportExcelOption}>
                    Export all CSD to Excel
                  </MenuItem>
                )}
              </Menu>
            </div>

          </div>

          <LineChart ref={this.lineChartRef} chartController={this.chartController} />
          <Loading ref={this.loadingRef} />
          <YAxisSetting ref={this.ySettingRef} />
          <ChannelSetting ref={this.channelSettingRef} />

          <Dialog maxWidth='md' onClose={this.handleCloseRecentFiles} open={this.state.recentFilesOpen}>
            <DialogTitle className="dialog-title" onClose={this.handleCloseRecentFiles}>
              { intl.get('RECENT_CSD_FILES') }
            </DialogTitle>
            <DialogContent>
              <List style={{ width: '400px', maxHeight: '300px', overflow: 'auto' }}>
                {this.state.recentFiles.map((file, idx) => (
                  <ListItem disablePadding key={idx}>
                    <ListItemButton onClick={() => this.loadRecentFile(file)}>
                      <ListItemText 
                        primary={file.name} 
                        secondary={file.path || (file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '')} 
                        primaryTypographyProps={{ style: { fontWeight: 'bold' } }}
                        secondaryTypographyProps={{ style: { fontSize: '11px', wordBreak: 'break-all' } }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </DialogContent>
            <DialogActions className="dialog-footer">
              <Button onClick={this.handleOpenNewCsd} color="primary" variant="contained">
                { intl.get('OPEN_NEW_CSD_FILE') }
              </Button>
              <Button onClick={this.handleCloseRecentFiles}>
                { intl.get('CANCEL') }
              </Button>
            </DialogActions>
          </Dialog>
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

    // Initialize chartWidth from the actual DOM so the chart renders correctly
    // on the very first data load (before AxisSeries.reviseYAxisLayout runs).
    const wrapperWidth = $('#graphic-view-wrapper').width();
    if (wrapperWidth > 0) {
      // Approximate: full wrapper width minus left-margin for the Y-axis (~40px)
      this.chartController.setChartWidth(wrapperWidth - 40);
    }

    //Read current user settings
    this.getData();

    // In CSD mode: when a file is opened, switch chart to History mode spanning
    // the file's actual date range, then reload channel + measurement data.
    if (isCsdMode && TestAPI.onFileLoaded) {
      TestAPI.onFileLoaded(() => {
        console.log('[GraphicView] CSD file loaded — refreshing with correct time range...');
        this._applyCsdTimeRange();
        this.getData();
      });
    }

    this.setPosition(0);
    this.initToggleButton(isCsdMode ? 'history' : 'realtime');

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
      if (this.loadingRef.current) {
        this.loadingRef.current.hide();
      }
      return;
    }

    const result = responseData[0];

    if (!result) {
      if (this.channelListRef.current) {
        this.channelListRef.current.getData();
      }
      this.setState({
        noLoggingChannels: true
      });
      if (this.loadingRef.current) {
        this.loadingRef.current.hide();
      }
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
      if (this.lineChartRef.current) {
        this.lineChartRef.current.setNoLoggingChannels(true);
      }
      if (this.loadingRef.current) {
        this.loadingRef.current.hide();
      }
    }


    if (this.channelListRef.current) {
      this.channelListRef.current.getData();
    }
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

        // Force a layout pass so the chart uses the correct pixel width.
        // AxisSeries.reviseYAxisLayout() sets chartWidth only during its own
        // updateDisplay, which may not have run yet when channelWidth is still 0.
        // Calling setWidth() triggers updateDisplay on both AxisSeries and SplineGroup.
        const chartWidth = $('#graphic-view-wrapper').width() - (this.channelListVisible ? 440 : 0);
        if (chartWidth > 0) {
          this.lineChartRef.current.setWidth(chartWidth);
        }
      }

      if (this.loadingRef.current) {
        this.loadingRef.current.hide();
      }
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
    if (!currentBtn || currentBtn.length === 0 || !currentBtn.position()) {
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


  /**
   * Switch the chart to History mode using the CSD file's actual time range.
   * Must be called before getData() so getMeasurementData() receives valid timestamps.
   */
  _applyCsdTimeRange = () => {
    if (!TestAPI.getFileTimeRange) return;
    const { start, stop } = TestAPI.getFileTimeRange();
    if (!start || !stop || stop <= start) return;

    const startDate = new Date(start);
    const stopDate  = new Date(stop);

    const cc = this.chartController;
    cc.datasourceMode = 'History';
    cc.denoising = true;
    clearInterval(cc.timer);

    // Replace the timePeriod used for data fetch and the X scale domain.
    // Also set the xScale range so it knows pixel boundaries before AxisSeries renders.
    cc.timePeriod = { start: startDate, end: stopDate };
    cc.historyTimeRange = { start: startDate, end: stopDate };
    const wrapperWidth = $('#graphic-view-wrapper').width();
    if (wrapperWidth > 0) {
      cc.xScale.range([0, wrapperWidth - 40]);
    }
    cc.xScale.domain([startDate, stopDate]);
    cc.timePeriods = [];
    cc.currentTimePeriodIndex = -1;

    // Dispatch changeTimePeriod so the X axis redraws immediately
    d3.select('#line-chart').dispatch('changeTimePeriod');

    // Update the toggle button UI to reflect History mode
    this.initToggleButton('history');

    console.log(`[GraphicView] CSD time range: ${startDate.toISOString()} → ${stopDate.toISOString()}`);
  };


  openCsdFile = () => {
    const hasFs = !!(window.require && window.require('fs'));
    const hasFsa = !!(TestAPI && TestAPI.hasFSA);
    const recentFilesStr = localStorage.getItem('recentCsdFiles');
    const recentFiles = recentFilesStr ? JSON.parse(recentFilesStr) : [];

    if ((hasFs || hasFsa) && recentFiles.length > 0) {
      this.setState({
        recentFilesOpen: true,
        recentFiles
      });
    } else {
      if (TestAPI.openFile) {
        TestAPI.openFile();
      }
    }
  };

  loadRecentFile = async (file) => {
    this.setState({ recentFilesOpen: false });
    this.loadingRef.current.show();
    let success = false;
    if (file.path && TestAPI.loadFileFromPath) {
      success = await TestAPI.loadFileFromPath(file.path);
    } else if (TestAPI.getHandleForFile && TestAPI.loadFileFromHandle) {
      const handle = await TestAPI.getHandleForFile(file.name);
      if (handle) {
        success = await TestAPI.loadFileFromHandle(handle);
      }
    }
    if (!success) {
      this.loadingRef.current.hide();
    }
  };

  handleOpenNewCsd = () => {
    this.setState({ recentFilesOpen: false });
    if (TestAPI.openFile) {
      TestAPI.openFile();
    }
  };

  handleCloseRecentFiles = () => {
    this.setState({ recentFilesOpen: false });
  };


  printChart = () => {
    this.lineChartRef.current.printChart();
  };

  handleShareClick = (event) => {
    this.setState({ shareMenuAnchorEl: event.currentTarget });
  };

  handleShareClose = () => {
    this.setState({ shareMenuAnchorEl: null });
  };

  handlePrintOption = () => {
    this.handleShareClose();
    this.printChart();
  };

  handleExportCsvOption = async () => {
    this.handleShareClose();
    if (!TestAPI.isFileLoaded || !TestAPI.isFileLoaded()) {
      alert("No CSD file is currently loaded.");
      return;
    }
    this.loadingRef.current.showWithMessage("Exporting to CSV... 0%");
    try {
      await TestAPI.exportAllChannelsToCsv((progress) => {
        this.loadingRef.current.showWithMessage(`Exporting to CSV... ${Math.round(progress * 100)}%`);
      });
    } catch (e) {
      console.error(e);
      alert("Failed to export CSD to CSV: " + e.message);
    } finally {
      this.loadingRef.current.hide();
    }
  };

  handleExportExcelOption = async () => {
    this.handleShareClose();
    if (!TestAPI.isFileLoaded || !TestAPI.isFileLoaded()) {
      alert("No CSD file is currently loaded.");
      return;
    }
    this.loadingRef.current.showWithMessage("Exporting to Excel... 0%");
    try {
      await TestAPI.exportAllChannelsToExcel((progress) => {
        this.loadingRef.current.showWithMessage(`Exporting to Excel... ${Math.round(progress * 100)}%`);
      });
    } catch (e) {
      console.error(e);
      alert("Failed to export CSD to Excel: " + e.message);
    } finally {
      this.loadingRef.current.hide();
    }
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
