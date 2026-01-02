import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';

import YAxis from './YAxis';
import { SystemEvent } from '../../util/SystemConstant';

let self;

const yAxisStyle = {
  marginLeft: 40,
  marginRight: 20,
  hspace: 30
};



class AxisSeries extends Component {
  constructor() {
    super();
    self = this;

    this.yDataset = [];
    this.majorYAxisData = null;
  }
  

  render() {
    const yAxisItems = this.getYAxisItems();

    return(
      <g id="axis-container" transform="translate(0, 70)">
        <g id="grid-container">
          <g className="grid-line" transform="translate(4, 0)"/>
        </g>
        { yAxisItems }
        
        <g id="x-axis"/>

      </g>
    ); 
  }


  componentDidMount() {
    d3.select('#axis-container').on('changePosition', () => {
      const d = d3.event.detail.data;
      this.changePosition(d);
    }).on(SystemEvent.UPDATE_YAXIS_VIEW, () => {
      const type = d3.event.detail.type;
      const id = d3.event.detail.id;

      if (type === 'channel') {
        this.updateYAxisViewByChannelId(id);
      }else if (type === 'yaxis') {
        this.updateYAxisViewById(id);
      }
    });
    
    this.updateLineGrid();
  }

  componentDidUpdate() {
    this.updateDisplay();
  }


  setYDataset = (arr) => {
    const { chartController } = this.props;
    this.yDataset = chartController.yAxisDataset;

    if(!this.majorYAxisData && this.yDataset.length > 0) {
      this.majorYAxisData = this.yDataset[0];
    }

    this.forceUpdate();

    setTimeout(() => {
      self.updateYAxis();
    }, 0);
  }


  /**
   * Get react component by channel id
   * Multiple channels may use the same y-axis
   */
  getYAxisByChannelId(channelId) {
    const yAxisDataId = this.getYAxisIdByChannelId(channelId);
    const yAxis = this.refs[`yaxis-${ yAxisDataId }`];
    return yAxis;
  }


  getYAxisById(id) {
    const yAxis = this.refs[`yaxis-${ id }`];
    return yAxis;
  }

  updateDisplay = () => {
    if(!this.yDataset || this.yDataset.length === 0) {
      d3.select('#axis-container').attr('visibility', 'hidden');
      return;
    }
    
    this.reviseYAxisLayout();
    this.updateLineGrid(true);
    this.updateXAxis();
    this.updateYAxis();
    d3.selectAll('.y-axis').attr('visibility', 'visible');
    d3.select('#axis-container').attr('visibility', 'visible');
  }

  updateYAxis() {
    const { chartController } = this.props;
    this.yDataset = chartController.yAxisDataset;

    if(!this.yDataset) {
      return;
    }

    let d, yAxis;
    for (let i = 0; i < this.yDataset.length;  i++) {
      d = this.yDataset[i];
      yAxis = this.getYAxisById(d.id);
      if(yAxis) {
        yAxis.rerender();
      }
    }
  }


  getYAxisItems = () => {
    const { chartController } = this.props;
    const dataset = chartController.yAxisDataset;
    if(!dataset) {
      return null;
    }

    const items = dataset.map(d => {
      return <YAxis ref={ `yaxis-${d.id}` } key={ d.id } data={d}/>;
    });

    return items;
  }


  getYAxisIdByChannelId(channelId) {
    const { chartController } = this.props;
    const dataset = chartController.yAxisDataset;
    for (let i = 0; i < dataset.length; i++) {
      const d = dataset[i];
      if (d.channelIds.indexOf(channelId) !== -1) {
        return d.refId
      }
    }

    return null;
  }


  reviseYAxisLayout = (withAnimation = false) => {
    const { chartController } = this.props;
    let d;
    let y_axis;
    let chartStartX = 0,
        chartWidth = 0,
        chartEndX = 0;

    const dataset = chartController.yAxisDataset;
    
    //Position first y-axis
    d = dataset[0];
    y_axis = this.getYAxisById(d.id);

    d.x = yAxisStyle.marginLeft;
    y_axis.moveTo(d.x, withAnimation);
    chartStartX = y_axis.getX() + 1;
   
    //Postion other y-axis
    for (let i = dataset.length-1; i > 0;  i--) {
      d = dataset[i];
      y_axis = this.getYAxisById(d.id);

      //todo
      this.computeYAxisTX(i);
      y_axis.moveTo(d.x, withAnimation);
    }


    if(dataset.length > 1) {
      d = dataset[1];
      y_axis = this.getYAxisById(d.id);
      chartEndX = y_axis.getX() - 1;
    }else {
      chartEndX = $('#line-chart').width() - 80;
    }
    chartWidth = chartEndX - chartStartX;

    d3.select('#grid-container')
      .attr('transform', `translate(${chartStartX}, 0)`);
    

    chartController.setChartX(chartStartX);
    chartController.setChartWidth(chartWidth);
    
    //todo
    if(!withAnimation) {
      d3.select('#grid-back').attr('width', chartWidth);
    }
  };


  //todo
  computeYAxisTX = (index) => {
    const width = $('#line-chart').width();
    let rightSpace = yAxisStyle.marginRight;

    let d, y_axis;

    for (let i = this.yDataset.length-1; i >= index;  i--) {
      d = this.yDataset[i];
      if(d) {
        y_axis = this.getYAxisById(d.id);
        rightSpace +=  y_axis.getWidth() + yAxisStyle.hspace;
      }
    }

    d.x = width - rightSpace;
    return d.x;
  };


  changePosition = (d) => {
    const preData = this.yDataset[0];
    const currentIndex = d.index;
    const preIndex = preData.index;

    d.index = preIndex;
    preData.index = currentIndex;

    const currentAxis = this.getYAxisById(d.id);
    const preAxis = this.getYAxisById(preData.id);

    this.yDataset.sort(function(a,b) {
      return a.index > b.index ? 1 : -1;
    });

    if(preIndex === 0) {
      currentAxis.rerender();
      preAxis.rerender();

      currentAxis.moveTo(yAxisStyle.marginLeft, true);

      this.majorYAxisData = d;
      let y_axis;
      for (let i = this.yDataset.length-1; i > 0;  i--) {
        d = this.yDataset[i];
        y_axis = this.getYAxisById(d.id);
        this.computeYAxisTX(i);
        y_axis.moveTo(d.x, true);
      }

      setTimeout(() => {
        const x = self.computeChartX();
        self.positionLineGrid(x);
        self.updateLineGrid(true);
       
        d3.select('#line-chart').dispatch('updatePosition', {
          detail:{ 
            x: x
          }
        });
      }, 600);
    }else {
      currentAxis.moveTo(this.computeYAxisTX(d.index), true);
      preAxis.moveTo(this.computeYAxisTX(preData.index), true);
    }
  };


  relayoutYAxises = () => {
    
  }

  
  positionLineGrid = (x) => {
    const { chartController } = this.props;
    d3.select('#grid-container')
      .attr('transform', `translate(${x}, 0)`);

    const y = chartController.chartHeight;
    d3.select('#x-axis').attr('transform', `translate(${x}, ${y})`);
  }


  updateLineGrid = (withAnimation = false) => {
    if (!this.majorYAxisData) {
      return;
    }

    const { chartController } = this.props;
    const chartWidth = chartController.chartWidth;

    if (withAnimation) {
      d3.select('.grid-line').transition().duration(500)
        .call(d3.axisLeft(this.majorYAxisData.scale)
        .tickSizeInner(-chartWidth + 8));
    }else {
      d3.select('.grid-line')
        .call(d3.axisLeft(this.majorYAxisData.scale)
        .tickSizeInner(-chartWidth + 8));
    }

    d3.select('.grid-line').selectAll('.domain').remove();
    d3.select('.grid-line').selectAll('text').remove();
    d3.select('.grid-line').selectAll('.tick line')
      .style('stroke-opacity', 0.25)
      .attr('stroke', '#000')
      .attr('stroke-dasharray', '2, 2');
  };


  updateXAxis = () => {
    const { chartController } = this.props;
    const x = chartController.chartX;
    const y = chartController.chartHeight;

    const formatMillisecond = d3.timeFormat('.%L'),
          formatSecond = d3.timeFormat('%I:%M:%S'),
          formatMinute = d3.timeFormat('%I:%M'),
          formatHour = d3.timeFormat('%I %p'),
          formatDay = d3.timeFormat('%m/%d'),
          formatWeek = d3.timeFormat('%m/%d'),
          formatMonth = d3.timeFormat('%B'),
          formatYear = d3.timeFormat('%Y');
    
    d3.select('#x-axis').attr('transform', `translate(${x}, ${y})`);
    
    setTimeout(() => {
      d3.select('#x-axis').transition()
        .call(d3.axisBottom(chartController.xScale)
                .tickFormat(date => {
                  return (d3.timeSecond(date) < date ? formatMillisecond
                  : d3.timeMinute(date) < date ? formatSecond
                  : d3.timeHour(date) < date ? formatMinute
                  : d3.timeDay(date) < date ? formatHour
                  : d3.timeMonth(date) < date ? (d3.timeWeek(date) < date ? formatDay : formatWeek)
                  : d3.timeYear(date) < date ? formatMonth
                  : formatYear)(date);
                })
        );
    }, 0);
  }


  computeChartWidth = () => {
    if (!this.yDataset || this.yDataset.length === 0) {
      return 0;
    }

    let chartWidth = 0,
        chartStartX = 0,
        chartEndX = 0;
    
    const firstData = this.yDataset[0];
    const lastData = this.yDataset[this.yDataset.length - 1];
    
    //todo
    chartStartX = this.getYAxisById(firstData.id).getX() + 1;
    chartEndX = this.getYAxisById(lastData.id).getX() - 1;
    chartWidth = chartEndX - chartStartX;
    return chartWidth;
  };


  computeChartX = () => {
    if (!this.yDataset || this.yDataset.length === 0) {
      return 0;
    }

    let x = 0;
    const firstData = this.yDataset[0];  
    x = this.getYAxisById(firstData.id).getX() + 1;
    
    return x;  
  };


  updateYAxisViewByChannelId = (channelId) => {
    const yAxis = this.getYAxisByChannelId(channelId);
    if (yAxis) {
      yAxis.rerender();
    }

    this.updateLineGrid();
  }

  updateYAxisViewById = (id) => {
    const yAxis = this.getYAxisById(id);
    if (yAxis) {
      yAxis.rerender();
    }
  }
}

export default AxisSeries;