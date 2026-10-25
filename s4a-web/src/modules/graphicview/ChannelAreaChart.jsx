import React, { Component } from 'react';
import * as d3 from 'd3';
import TestAPI from '../../api/TestAPI';
import DataUtil from '../../util/DataUtil';
import { SystemEvent } from '../../util/SystemConstant';


class ChannelAreaChart extends Component {
  constructor() {
    super();
    this.rootRef = React.createRef();
    this.channel = null;
    this.summaryData = [];
    this.dataset = [];
    this.linePath = null;
    this.curveLinePath = null;
    this.needHandleData = true;
    this.realtimeMark = 0;
  }
 

  render() {
    this.channel = this.props.channel;

    return(
      <g className="spline" ref={this.rootRef} style={{ pointerEvents:'none' }}/>
    );
  }

  setVisible = (show) => {
    if (show) {
      d3.select(this.rootRef.current).attr('visibility', 'visible');
    } else {
      d3.select(this.rootRef.current).attr('visibility', 'hidden');
    }
  }

  draw = () => {
    const { chartController } = this.props;
    if(!chartController) {
      return;
    }
    
    const container = d3.select(this.rootRef.current);
    const summaryData = this.channel.summaryData;

    if (!this.curveLinePath) {
      this.curveLinePath = d3.area()
                              .x(d => chartController.xScale(d.time))
                              .y0(d => this.channel.scale(d.min))
                              .y1(d => this.channel.scale(d.max));
      // this.curveLinePath = d3.line().x(d => chartController.xScale(d.time))
      //                          .y(d => this.channel.scale(d.value))
      //                          .curve(d3.curveBasis);
    }

    if(!this.linePath) {
      this.linePath = d3.line().x(d => chartController.xScale(d.time))
                               .y(d => this.channel.scale(d.value));
    }
    
    if(this.needHandleData) {
      let timesPerPix = chartController.computetimesPerPix();
      // Clip the series to the visible window — the live session keeps every
      // sample in memory, and unfiltered points would be drawn outside the
      // plot area, over the y-axes. (File mode data already fits its window,
      // so this is a no-op there.)
      let data = summaryData;
      const startT = chartController.timePeriod.start
        ? chartController.timePeriod.start.getTime() : null;
      const endT = chartController.timePeriod.end
        ? chartController.timePeriod.end.getTime() : null;
      if (startT !== null && endT !== null && endT > startT) {
        data = DataUtil.filterDataToPeriod(summaryData, startT, endT);
      }
      this.dataset = DataUtil.handleSegmentData(data,
                      chartController.denoising,
                      timesPerPix);
    }

    const lines = container.selectAll('.sub-line')
                           .data(this.dataset);
    lines.enter()
         .append('path')
         .attr('data-cid', this.channel.id)
         .classed('sub-line', true)
         .style('fill', this.channel.color)
         .style('stroke', this.channel.color);
    
    // Realtime and Recording modes draw thin lines; History (file analysis)
    // keeps the filled area style.
    if (chartController.datasourceMode !== 'History') {
      container.selectAll('.sub-line')
        .style('fill', 'none')
        .attr('stroke-width', 2);
    } else {
      container.selectAll('.sub-line')
        .style('fill', this.channel.color)
        .attr('stroke-width', 0.5)
        .attr('fill-opacity', 0.5);
    }

    if(chartController.denoising) {
      container.selectAll('.sub-line')
            //  .transition(100)
             .attr('d', d => this.curveLinePath(d));
    }else {
      container.selectAll('.sub-line')
            //  .transition(100)
             .attr('d', d => this.linePath(d));
    }
    
    lines.exit().remove();
  }

  /**
   * Get measurement data of channel
   */
  getData = () => {
    const { chartController } = this.props;

    // Live-recording history browsing: data already lives in summaryData —
    // just redraw against the (already updated) x domain. Never fetch.
    if (chartController.datasourceMode === 'RecordingHistory') {
      this.draw();
      d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA_COMPLETED);
      return;
    }

    const interval = chartController.computeTableInterval();

    let startTime = chartController.timePeriod.start.getTime();
    let endTime = chartController.timePeriod.end.getTime();

    if (chartController.datasourceMode === 'Realtime') {
      endTime = chartController.timePeriod.now.getTime();
    }

    if (chartController.datasourceMode === 'History') {
      this.channel.dataLoading = true;
    }

    startTime += 3600000 * 8;
    endTime += 3600000 * 8;

    TestAPI.getMeasurementData(this.channel.id, 
      startTime, endTime,
      interval, 2, 
      (responseData) => this.getMeasurementDataHandler(responseData));
  }

  getMeasurementDataHandler(responseData) {
    if(!responseData) {
      return;
    }

    const { chartController } = this.props;
    const result = responseData[0];
    DataUtil.handleMeasurementData(this.channel, result);

    if (chartController.datasourceMode === 'History') {
      this.channel.dataLoading = false;
      chartController.handleDataLoadingStatus();
      this.realtimeMark = 0;
    } else {
      this.draw();
      if(this.realtimeMark === 0) {
        this.channel.dataLoading = false;
        chartController.handleDataLoadingStatus();
        this.realtimeMark = 1;
      }

      d3.select('#axis-container').dispatch(SystemEvent.UPDATE_YAXIS_VIEW, {
        detail: {
          type: 'channel',
          id: this.channel.id
        }
      });
    }
  }

  updateColor() {
    const { chartController } = this.props;
    const container = d3.select(this.rootRef.current);

    if (chartController.datasourceMode !== 'History') {
      container.selectAll('.sub-line')
        .style('fill', 'none')
        .style('stroke', this.channel.color);
    } else {
      container.selectAll('.sub-line')
        .style('fill', this.channel.color)
        .style('stroke', this.channel.color);
    }
    
    this.updateVisible();
  }

  updateVisible() {
    const { channel } = this.props;
    const visible = channel.visible ? 'visible' : 'hidden';
    d3.select(this.rootRef.current).attr('visibility', visible).raise();
  }
}

export default ChannelAreaChart;