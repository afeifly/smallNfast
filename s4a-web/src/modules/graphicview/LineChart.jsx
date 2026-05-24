import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';
import intl from "react-intl-universal";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import AxisSeries from './AxisSeries';
import SplineGroup from './SplineGroup';
import LegendSvgGroup from './LegendSvgGroup';
import { saveSvgAsPng } from 'save-svg-as-png';
import html2canvas from 'html2canvas';
import { SystemEvent } from '../../util/SystemConstant';
import TimePeriod from './TimePeriod'
import TestAPI from '../../api/TestAPI';

import './css/LineChart.css'; 
import { Button, Fab, Tooltip } from '@mui/material';

let self;
let yAxisData = [];


class LineChart extends Component {
  constructor() {
    super();  
    self = this; 
    this.rootRef = React.createRef();
    this.AxisSeriesRef = React.createRef();
    this.LegendGroupRef = React.createRef();
    this.SplineGroupRef = React.createRef();
    this.TimePeriodRef = React.createRef();
    this.scaleActionsRef = React.createRef();
    this.state = {
      backButtonEnabled: false,
      nextButtonEnabled: false,
      dataType: 'Realtime',
      denoisingChecked: true,
      fileLoaded: false,
    };
  }
  

  render() {
    const { chartController } = this.props;
    const isCsdMode = import.meta.env.VITE_USE_CSD === 'true';

    let placeholderText = intl.get('NO_CHANNEL');
    if (isCsdMode) {
      if (this.state.fileLoaded || (TestAPI.isFileLoaded && TestAPI.isFileLoaded())) {
        placeholderText = 'No channel selected';
      } else {
        placeholderText = 'Open a CSD file to show data';
      }
    }

    const buttonStyle = {
      marginLeft: 4
    };
    
    return(
      <div id="line-chart" ref={this.rootRef}>
        <svg id="line-chart-container"  width={'100%'} height={'100%'}>
          <AxisSeries ref={this.AxisSeriesRef} chartController={ chartController }/>;
          <LegendSvgGroup ref={this.LegendGroupRef} chartController={ chartController} />
          <SplineGroup ref={this.SplineGroupRef} hideTimePeriod={ this.hideTimePeriod } chartController={ chartController }/>;
        </svg>
        <TimePeriod ref={this.TimePeriodRef} chartController={ chartController }/>
        <div className="chart-placeholder">
          <div className="no-data-tip">{ placeholderText }</div>
        </div>

        <div className="scale-actions" ref={this.scaleActionsRef}>
          <Tooltip title="Previous scale">
            <div>
              <Button style={ buttonStyle } margin="dense" size="small" variant="outlined" 
                disabled={ !this.state.backButtonEnabled }
                onClick={ this.gotoPreTimePeriod }>
                <ArrowBackIcon/>
              </Button>
            </div>
          </Tooltip>

          <Tooltip title="Next scale">
            <div>
              <Button style={ buttonStyle } size="small" variant="outlined" 
                disabled={ !this.state.nextButtonEnabled }
                onClick={ this.gotoNextTimePeriod }>
                <ArrowForwardIcon/>
              </Button>
            </div>
          </Tooltip>

          <Tooltip title="Reset">
            <Button style={ buttonStyle } size="small" variant="outlined" 
              onClick={ this.resetTimePeriod } >
              <RefreshIcon/>
            </Button>
          </Tooltip>
        </div>
      </div>
    );
  }

  componentDidMount() {
    const { chartController } = this.props;

    const isCsdMode = import.meta.env.VITE_USE_CSD === 'true';
    if (isCsdMode && TestAPI.onFileLoaded) {
      TestAPI.onFileLoaded(() => {
        this.setState({ fileLoaded: true });
      });
    }

    const chartHeight = $('#line-chart').height() - 180;
    chartController.setChartHeight(chartHeight);

    // d3.select('.graphic-view').on('changeSelectedChannels', this.changeSelectedChannelsHandler);

    d3.select('#line-chart').on('updatePosition', (event) => {
      const x = event.detail.x;
      chartController.setChartX(x);
      self.forceUpdate();
      self.positionLegend();
    })
    .on('changeTimePeriod', () => {
      this.AxisSeriesRef.current.updateXAxis();
      this.SplineGroupRef.current.refreshData();

      // setTimeout(this.updateTimePeriodActions, 500);
    })
    .on('updateScaleActions', () => {
      this.updateTimePeriodActions();
    })
    .on(SystemEvent.UPDATE_CHANNEL_COLOR, (event) => {
      const detail = event.detail;
      this.SplineGroupRef.current.updateLineColor(detail.channelId, detail.color);
      this.LegendGroupRef.current.updateColor();
    })
    .on(SystemEvent.UPDATE_YAXIS_AND_SPLINES, () => {
      this.AxisSeriesRef.current.updateDisplay();
      this.SplineGroupRef.current.updateDisplay();
    })
  }


  updateYAxis = () => {
    this.AxisSeriesRef.current.updateYAxis();
  }

  updateTimePeriodActions = () => {
    const { chartController } = this.props;
    const { timePeriods, currentTimePeriodIndex } = chartController;

    const hasHistory = timePeriods.length > 0;
    const atFirst    = currentTimePeriodIndex <= 0;
    const atLast     = currentTimePeriodIndex >= timePeriods.length - 1;

    this.setState({
      backButtonEnabled: hasHistory && !atFirst,
      nextButtonEnabled: hasHistory && !atLast,
    });

    // Show the whole scale-actions panel whenever there are time periods to navigate
    if (hasHistory) {
      d3.select(this.scaleActionsRef.current).attr('data-status', 'active');
    } else {
      d3.select(this.scaleActionsRef.current).attr('data-status', '');
    }
  };

  updateResetButton = () => {
    const { chartController } = this.props;
    if (!chartController.resetEnable) {
      return;
    }

    const x = chartController.chartX + chartController.chartWidth - 110;
    d3.select(this.scaleActionsRef.current)
      // .style('left', x + 'px')
      .attr('data-status', 'active');
  };

  gotoPreTimePeriod = () => {
    const { chartController } = this.props;

    // Guard: already at the beginning — do nothing
    if (chartController.currentTimePeriodIndex <= 0) {
      return;
    }

    chartController.gotoPreTimePeriod();
    this.AxisSeriesRef.current.updateXAxis();
    this.SplineGroupRef.current.refreshData();

    this.updateTimePeriodActions();
    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA);
  };

  gotoNextTimePeriod = () => {
    const { chartController } = this.props;

    // Guard: already at the newest zoom — do nothing
    if (chartController.currentTimePeriodIndex >= chartController.timePeriods.length - 1) {
      return;
    }

    chartController.gotoNextTimePeriod();
    this.AxisSeriesRef.current.updateXAxis();
    this.SplineGroupRef.current.refreshData();

    this.updateTimePeriodActions();
    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA);
  };


  setWidth(w) {
    $('#line-chart').width(w);
    
    if (yAxisData.length > 0) {
      setTimeout(() => {
        this.AxisSeriesRef.current.updateDisplay();
        this.SplineGroupRef.current.updateDisplay();
        this.positionLegend();
      }, 100);
    }
  }

  updateHeight() {
    const { chartController } = this.props;
    const chartHeight = $('#line-chart').height() - 180;

    for (let i = 0; i < yAxisData.length; i++) {
      const channel = yAxisData[i];
      channel.scale.rangeRound([chartHeight, 0]);
    }

    chartController.setChartHeight(chartHeight);
    this.AxisSeriesRef.current.updateYAxis();
    this.AxisSeriesRef.current.updateLineGrid();
  }

  setX(x) {
    const { chartController } = this.props;
    $('#line-chart').css({left: x});

    if (x === 0) {
      chartController.channelVisible = false;
    }else {
      chartController.channelVisible = true;
    }

    const visible = chartController.channelVisible ? 'hidden' : 'visible';
    d3.select('.channelBtn').style('visibility', visible);
  }

  
  changeSelectedChannelsHandler = () => {
    const { chartController } = this.props;
    const selectedChannels = chartController.selectedChannels;
    
    yAxisData = selectedChannels;
    self.AxisSeriesRef.current.setYDataset(selectedChannels);
    self.SplineGroupRef.current.setData(selectedChannels);
    self.LegendGroupRef.current.setData(selectedChannels);
    self.SplineGroupRef.current.updateDisplay();

    // Defer positionLegend so it runs after LegendSvgGroup.forceUpdate() has
    // re-rendered the legend items and their getBBox() returns correct sizes.
    setTimeout(() => {
      if (self.LegendGroupRef.current) {
        self.positionLegend();
      }
    }, 50);

    d3.select('.chart-placeholder').attr('data-status', '');

    if (selectedChannels && selectedChannels.length > 0) {
      d3.select('.chart-placeholder').attr('data-status', '');
    } else {
      d3.select('.chart-placeholder').attr('data-status', 'active');
    }

    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA_COMPLETED);
  }


  positionLegend = () => {
    const panelHeight = $('#line-chart').height();
    const panelWidth = $('#line-chart').width();

    // Layout legend items in rows, wrapping when they would exceed panel width.
    // Each item is placed with a fixed 15px left-gap from the previous item's
    // right edge. When a row overflows, start a new row at y=35.
    let rowX = 0;         // running x within the current row
    let row = 0;          // 0 = first row, 1 = second row
    let maxRowX = 0;      // widest row (used to centre the legend box)
    const GAP = 15;

    d3.selectAll('.legend-item').each(function() {
      const itemW = this.getBBox().width;
      if (row === 0 && rowX > 0 && rowX + GAP + itemW > panelWidth - 30) {
        // Wrap to second row
        maxRowX = rowX;
        row = 1;
        rowX = 0;
      }
      const y = row === 0 ? 15 : 35;
      d3.select(this).attr('transform', `translate(${GAP + rowX}, ${y})`);
      rowX += itemW + GAP;
    });

    if (row === 0) maxRowX = rowX;
    const legendW = Math.max(maxRowX, rowX) + GAP;
    const legendH = row > 0 ? 50 : 30;
    const x = Math.max(0, Math.floor((panelWidth - legendW) / 2));

    this.LegendGroupRef.current.setWidth(legendW);
    this.LegendGroupRef.current.setHeight(legendH);
    this.LegendGroupRef.current.setPosition({ x, y: panelHeight - 60 });
  }

  updateDenoisingSetting = () => {
    self.SplineGroupRef.current.updateDisplay();
  };


  showChannelList() {
    d3.select('.graphic-view').dispatch(SystemEvent.SHOW_CHANNEL_LIST);
  }

  resetTimePeriod = () => {
    const { chartController } = this.props;

    // In CSD mode the historyTimeRange was set to the file's actual time range.
    // openHistoryMode() restores timePeriod from historyTimeRange and resets the
    // zoom history, then dispatches changeTimePeriod to redraw the X axis.
    chartController.openHistoryMode();

    // Hide the scale-actions panel and update button states
    d3.select(this.scaleActionsRef.current).attr('data-status', '');
    this.updateTimePeriodActions();

    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA);
  }

  hideScaleActionButtons = () => {
    d3.select(this.scaleActionsRef.current).attr('data-status', '');
  }


  showOrHideTimePeriod = () => {
    const { chartController } = this.props;
    chartController.timePeriodVisible = !chartController.timePeriodVisible; 
    
    if(chartController.timePeriodVisible) {
      this.TimePeriodRef.current.show();
    }else {
      this.TimePeriodRef.current.hide();
    }
  };

  hideTimePeriod = () => {
    const { chartController } = this.props;
    chartController.timePeriodVisible = false; 
    this.TimePeriodRef.current.hide();
  };


  printChart() {
    var svg = document.getElementById("line-chart-container")
    saveSvgAsPng(svg,"tmp.png", { 
      backgroundColor: '#ffffff',
      scale: 2
    });
  }

  
  printdiv() {
    html2canvas(document.getElementById('line-chart')).then(function(canvas) {
      document.getElementById('export-image-container')
      $('#export-image-container').append(canvas)
        .attr('data-status', 'active');
    });
  }

  updateViewForRealtimeMode = () => {
    this.hideTimePeriod();
    this.hideScaleActionButtons();
  };

  setNoLoggingChannels = (bool) => {
    if(bool) {
      d3.select('.chart-placeholder').attr('data-status', 'active');
    }else {
      d3.select('.chart-placeholder').attr('data-status', '');
    }
  }
}

export default LineChart;