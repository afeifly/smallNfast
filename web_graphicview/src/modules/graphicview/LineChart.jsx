import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';
import intl from "react-intl-universal";
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import RefreshIcon from '@material-ui/icons/Refresh';
import AxisSeries from './AxisSeries';
import SplineGroup from './SplineGroup';
import LegendSvgGroup from './LegendSvgGroup';
import { saveSvgAsPng } from 'save-svg-as-png';
import html2canvas from 'html2canvas';
import { SystemEvent } from '../../util/SystemConstant';
import TimePeriod from './TimePeriod'

import './css/LineChart.css'; 
import { Button, Fab, Tooltip } from '@material-ui/core';

let self;
let yAxisData = [];


class LineChart extends Component {
  constructor() {
    super();  
    self = this; 
    this.state = {
      backButtonEnabled: false,
      nextButtonEnabled: false,
      dataType: 'Realtime',
      denoisingChecked: true,
    };
  }
  

  render() {
    const { chartController } = this.props;

    const buttonStyle = {
      marginLeft: 4
    };
    
    return(
      <div id="line-chart" ref="root">
        <svg id="line-chart-container"  width={'100%'} height={'100%'}>
          <AxisSeries ref="AxisSeries" chartController={ chartController }/>;
          <LegendSvgGroup ref="LegendGroup" chartController={ chartController} />
          <SplineGroup ref="SplineGroup" hideTimePeriod={ this.hideTimePeriod } chartController={ chartController }/>;
        </svg>
        <TimePeriod ref="TimePeriod" chartController={ chartController }/>
        <div className="chart-placeholder">
          <div className="no-data-tip">{ intl.get('NO_CHANNEL') }</div>
        </div>

        <div className="scale-actions" ref="scaleActions">
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

    const chartHeight = $('#line-chart').height() - 180;
    chartController.setChartHeight(chartHeight);

    // d3.select('.graphic-view').on('changeSelectedChannels', this.changeSelectedChannelsHandler);

    d3.select('#line-chart').on('updatePosition', () => {
      const x = d3.event.detail.x;
      chartController.setChartX(x);
      self.forceUpdate();
      self.positionLegend();
    })
    .on('changeTimePeriod', () => {
      this.refs.AxisSeries.updateXAxis();
      this.refs.SplineGroup.refreshData();

      // setTimeout(this.updateTimePeriodActions, 500);
    })
    .on('updateScaleActions', () => {
      this.updateTimePeriodActions();
    })
    .on(SystemEvent.UPDATE_CHANNEL_COLOR, () => {
      const detail = d3.event.detail;
      this.refs.SplineGroup.updateLineColor(detail.channelId, detail.color);
      this.refs.LegendGroup.updateColor();
    })
    .on(SystemEvent.UPDATE_YAXIS_AND_SPLINES, () => {
      this.refs.AxisSeries.updateDisplay();
      this.refs.SplineGroup.updateDisplay();
    })
  }


  updateYAxis = () => {
    this.refs.AxisSeries.updateYAxis();
  }

  updateTimePeriodActions = () => {
    const { chartController } = this.props;
    const { timePeriods, currentTimePeriodIndex } = chartController;
    
    if (currentTimePeriodIndex === 0) {
      this.setState({
        backButtonEnabled: false
      })
    }else if (currentTimePeriodIndex > 0) {
      this.setState({
        backButtonEnabled: true
      })
    }

    if (currentTimePeriodIndex === timePeriods.length - 1) {
      this.setState({
        nextButtonEnabled: false
      })
    }else {
      this.setState({
        nextButtonEnabled: true
      })
    }

    this.updateResetButton();
  };

  updateResetButton = () => {
    const { chartController } = this.props;
    if (!chartController.resetEnable) {
      return;
    }

    const x = chartController.chartX + chartController.chartWidth - 110;
    d3.select(this.refs.scaleActions)
      // .style('left', x + 'px')
      .attr('data-status', 'active');
  };

  gotoPreTimePeriod = () => {
    const { chartController } = this.props;

    if (chartController.currentTimePeriodIndex === 0) {
      this.resetTimePeriod();
      return;
    }

    chartController.gotoPreTimePeriod();
    this.refs.AxisSeries.updateXAxis();
    this.refs.SplineGroup.refreshData();
    
    this.updateTimePeriodActions();
    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA);
  };

  gotoNextTimePeriod = () => {
    const { chartController } = this.props;
    chartController.gotoNextTimePeriod();
    this.refs.AxisSeries.updateXAxis();
    this.refs.SplineGroup.refreshData();

    this.updateTimePeriodActions();
    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA);
  };


  setWidth(w) {
    $('#line-chart').width(w);
    
    if (yAxisData.length > 0) {
      setTimeout(() => {
        this.refs.AxisSeries.updateDisplay();
        this.refs.SplineGroup.updateDisplay();
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
    this.refs.AxisSeries.updateYAxis();
    this.refs.AxisSeries.updateLineGrid();
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
    self.refs.AxisSeries.setYDataset(selectedChannels);
    self.refs.SplineGroup.setData(selectedChannels);
    self.refs.LegendGroup.setData(selectedChannels);
    self.refs.SplineGroup.updateDisplay();
    self.positionLegend();
    d3.select('.chart-placeholder').attr('data-status', '');


    if (selectedChannels && selectedChannels.length > 0) {
      d3.select('.chart-placeholder').attr('data-status', '');
    }else {
      d3.select('.chart-placeholder').attr('data-status', 'active');
    }

    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA_COMPLETED);
  }


  positionLegend = () => {
    const panelHeight = $('#line-chart').height();
    const panelWidth = $('#line-chart').width();

    if ($('.legend-group').width() > panelWidth - 80) {
      $('.legend-group').width(panelWidth - 80);
    }
    
    var allWidth = 0;
    var index = 0;
    var maxLegendWidth = 0;
    var hasTwoLineLegend = false;
    d3.selectAll('.legend-item').each(function() {
      var tmpW = this.getBBox().width;           
      if(allWidth+tmpW+15*(index+1)>panelWidth){
        maxLegendWidth = allWidth;
        hasTwoLineLegend = true;
        d3.select(this).attr('transform','translate('+(15+allWidth)+',15)');
        allWidth = 0;
      }
      if(hasTwoLineLegend){
        d3.select(this).attr('transform','translate('+(15+allWidth)+',35)');
      }else{
        d3.select(this).attr('transform','translate('+(15+allWidth)+',15)');        
      }
      allWidth += tmpW+15*(index+1);
      
    });
    var x = Math.floor((panelWidth - allWidth)/2);
    if(hasTwoLineLegend){
      this.refs.LegendGroup.setWidth(maxLegendWidth+15);
      this.refs.LegendGroup.setHeight(50);
      x =  Math.floor((panelWidth - maxLegendWidth)/2);
    } else{
      this.refs.LegendGroup.setWidth(allWidth+15);      
    } 
    this.refs.LegendGroup.setPosition({x: x, y: panelHeight - 60});    
  }

  updateDenoisingSetting = () => {
    self.refs.SplineGroup.updateDisplay();
  };


  showChannelList() {
    d3.select('.graphic-view').dispatch(SystemEvent.SHOW_CHANNEL_LIST);
  }

  resetTimePeriod = () => {
    const { chartController } = this.props;
    chartController.openHistoryMode();
    d3.select(this.refs.scaleActions).attr('data-status', '');

    this.updateTimePeriodActions();

    //Hide time period component
    if(chartController.timePeriodVisible) {
      this.showOrHideTimePeriod();
    }

    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA);
  }

  hideScaleActionButtons = () => {
    d3.select(this.refs.scaleActions).attr('data-status', '');
  }


  showOrHideTimePeriod = () => {
    const { chartController } = this.props;
    chartController.timePeriodVisible = !chartController.timePeriodVisible; 
    
    if(chartController.timePeriodVisible) {
      this.refs.TimePeriod.show();
    }else {
      this.refs.TimePeriod.hide();
    }
  };

  hideTimePeriod = () => {
    const { chartController } = this.props;
    chartController.timePeriodVisible = false; 
    this.refs.TimePeriod.hide();
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