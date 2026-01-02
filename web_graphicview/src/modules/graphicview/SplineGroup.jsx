import React, { Component } from 'react';
import * as d3 from 'd3';
import Spline from './Spline';
import { SystemEvent } from '../../util/SystemConstant';
import ChannelAreaChart from './ChannelAreaChart';

let self;
let dataset = [];
let lines;

const dateFormat = d3.timeFormat('%Y-%m-%d %H:%M:%S');

class SplineGroup extends Component {
  constructor() {
    super();
    self = this;

    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragEnabled = false;   //Can select time period by dragging
    this.dataTipPanel = null;
  }

  setData(data) {
    dataset = data;
    this.forceUpdate();
  }

  render() {
    const { chartController } = this.props;

    const x = chartController.chartX,
      width = chartController.chartWidth,
      height = chartController.chartHeight;

    const items = dataset.map(d =>
      <ChannelAreaChart ref={`spline${d.id}`}
        channel={d} key={d.id}
        chartController={chartController}
      />
    );

    const dataTipPanel = this.getDataTip();

    return (
      <g id="line-container" ref="root" transform={`translate(${x}, 70)`}>
        <defs>
          <filter id="drop-shadow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="4" dy="4" result="offsetblur" />
            <feFlood floodColor="rgba(0, 0, 0, 0.2)" />
            <feComposite in2="offsetblur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="spline-container" ref="root" transform="translate(0, 0)">
          {items}
          <rect id="drag-bound" style={{ pointerEvents: 'none' }}
            width={0} height={0}
            fill="rgba(33, 150, 243, 0.15)"
            visibility="hiden"
          />
          <rect className="line-background"
            width={width} height={height}
            fill="rgba(0, 0, 0, 0.01)"
          />
        </g>
        <path className="mouse-line" ref="mouse-line" />

        <g className="current-date-tip" transform={`translate(0, -27)`}>
          <path className="date-tip-back" />
          <text className="date-tip-label" x="10" y="4" alignmentBaseline="before-edge">
            {'00/00/0000'}
          </text>
        </g>
        {dataTipPanel}
      </g>
    );
  }


  componentDidMount() {
    this.updateDisplay();

    this.dataTipPanel = d3.select('.data-tip-panel');

    d3.select('#line-container').on('switch', () => {
      const data = d3.event.detail.data;
      const show = d3.event.detail.show;

      data.visible = show;
      self.refs[`spline${data.id}`].setVisible(show);
    });


    const drag = d3.drag()
      .on('start', this.startDrag)
      .on('drag', this.dragging)
      .on('end', this.endDrag);
    d3.select('.line-background').call(drag);

    d3.select('#line-container')
      .on('mouseover', function () {
        const mouse = d3.mouse(this);
        self.mouseOver(mouse);
      })
      .on('mousemove', function () {
        const mouse = d3.mouse(this);
        self.mouseMove(mouse);
      })
      .on('mouseout', () => {
        d3.select('.mouse-line').style('opacity', 0);
        d3.selectAll('.mouse-per-line').style('opacity', 0);
        this.hideDataTipPanel();
        this.hideDateTip();
      });
  }

  updateDisplay = () => {
    const { chartController } = this.props;

    const width = chartController.chartWidth,
      height = chartController.chartHeight;

    //Update line background size
    d3.select('.line-background')
      .attr('width', width)
      .attr('height', height);

    //Redraw the lines
    let lineItem;
    dataset.forEach(d => {
      lineItem = self.refs[`spline${d.id}`];
      if (lineItem) {
        lineItem.draw();
      }
    });

    setTimeout(() => {
      lines = document.getElementsByClassName('sub-line');
      self.initMousePerLine();
      // self.initDataTipContent();
      // self.hideLoading();

      d3.select('.mouse-line')
        .style('stroke', 'rgba(0, 0, 0, 1)')
        .style('stroke-width', 1);
      // .style('opacity', 0);  
    }, 1000);

  }

  refreshData = () => {
    let lineItem;
    dataset.forEach(d => {
      lineItem = this.refs[`spline${d.id}`];
      if (lineItem) {
        lineItem.getData();
      }
    });
  }

  initMousePerLine() {
    let mousePerLine = d3.select('#line-container')
      .selectAll('.mouse-per-line')
      .data(dataset)
      .enter()
      .append('g')
      .attr('class', 'mouse-per-line')
      .attr('data-id', d => d.id)
      .style('pointer-events', 'none');

    mousePerLine.append('circle')
      .attr('r', 5)
      .attr('class', 'current-point')
      .style('stroke', d => d.color)
      .style('fill', '#fff')
      .style('stroke-width', 5)
      .style('opacity', 0);
  }


  getDataTip = () => {
    let panelHeight = dataset.length * 28 + 16;
    const tipItems = dataset.map((d, i) => {
      return (
        <g className="data-tip-item" key={d.id} data-id={d.id}
          opacity={0.1}
          transform={`translate(0, ${i * 28})`}>

          <rect className="data-tip-item-symbol"
            x="10" y="12"
            width="10" height="8"
            fill={d.color} />

          <text className="data-tip-item-text" alignmentBaseline="before-edge"
            x="28" y="6">
            <tspan className="dtit-name" alignmentBaseline="before-edge">
              {d.sensorDescription + ' - ' + d.name + ':  '}
            </tspan>
            <tspan className="dtit-value" alignmentBaseline="before-edge"
              fill={d.color}>
              {'--.--'}
            </tspan>
            <tspan className="dtit-unit" alignmentBaseline="before-edge">
              {'  ' + d.unit}
            </tspan>
          </text>
        </g>
      );
    });

    return (
      <g className="data-tip-panel">
        <rect className="data-tip-back" rx="4"
          strokeWidth="2"
          filter="url(#drop-shadow)"
          width={0} height={panelHeight}
        />

        <g className="data-tip-content" transform="translate(8, 8)">
          {tipItems}
        </g>
      </g>
    );
  }


  mouseOver(mouse) {
    d3.select('.mouse-line').style('opacity', 1);
    d3.selectAll('.mouse-per-line').style('opacity', 1);
    d3.selectAll('.current-point').style('opacity', 1);
    this.showDataTipPanel(mouse);
    this.showDateTip(mouse);
  }

  /**
   * When mouse move on the chart, show the value tip
   */
  mouseMove = (mouse) => {
    const { chartController } = this.props;
    if (!chartController) {
      return;
    }

    d3.select('.mouse-line')
      .attr('stroke-dasharray', '1,1')
      .attr('d', function () {
        const x = Math.floor(mouse[0]) + 0.5;
        let d = `M${x}, ${chartController.chartHeight} ${x}, 0`;
        return d;
      });

    d3.selectAll('.mouse-per-line')
      .attr('transform', function (d, i) {

        const currentLine = self.getLineOnMouseX(d.id, mouse[0]);
        // console.log(currentLine);

        if (!d.visible || !currentLine) {
          d3.select(this).attr('visibility', 'hidden');
          self.hideDataTipItem(d);
          return;
        } else {
          d3.select(this).attr('visibility', 'visible');
          self.showDataTipItem(d);
        }
        // const xDate = xScale.invert(mouse[0]),
        //       bisect = d3.bisector(function(d) { return d.date; }).right,
        // idx = bisect(d.values, xDate),
        // y;
        let beginning = 0;
        let end = currentLine.getTotalLength();
        let target = null;
        let pos, value;

        while (true) {
          target = Math.floor((beginning + end) / 2);

          pos = currentLine.getPointAtLength(target);
          if ((target === end || target === beginning) && pos.x !== mouse[0]) {
            break;
          }

          if (pos.x > mouse[0]) {
            end = target;
          } else if (pos.x < mouse[0]) {
            beginning = target;
          } else {
            break; //position found
          }
        }

        value = d.scale.invert(pos.y).toFixed(2);
        self.setDataTipContent(d, value);

        return "translate(" + Math.floor(mouse[0]) + "," + Math.floor(pos.y) + ")";
      });


    this.positionDataTipPanel(chartController, mouse[0], mouse[1]);
    this.positionDateTip(chartController, mouse);
    // this.dataTipPanel.attr('transform', `translate(${mouse[0] + 6}, ${mouse[1] + 10})`);
  }

  positionDataTipPanel = (chartController, x, y) => {
    x = x + 10;
    y = y + 18;
    let w = Math.floor(this.dataTipPanel.node().getBBox().width);
    let containerX = 0;

    if (chartController.channelVisible) {
      containerX = 320;
    }

    if (x + w + chartController.chartX + containerX > window.screen.width) {
      x = x - w - 12;
    }

    this.dataTipPanel.attr('transform', `translate(${x}, ${y})`);
  }

  setDataTipContent = (d, value) => {
    const dataTipItem = d3.select(`.data-tip-item[data-id="${d.id}"]`);
    if (!dataTipItem.node()) {
      return;
    }

    const text = dataTipItem.select('.data-tip-item-text');
    if (!text.node()) {
      return;
    }

    text.select('.dtit-value').text(value);

    const tipPanelBack = d3.select('.data-tip-back');
    let w = Math.round(text.node().getBBox().width + 60);
    let panelWidth = parseInt(tipPanelBack.attr('width'));

    if (w > panelWidth) {
      tipPanelBack.attr('width', w);
    }
  };

  updateDataTipColor = (channelId, color) => {
    const dataTipItem = d3.select(`.data-tip-item[data-id="${channelId}"]`);
    if (!dataTipItem.node()) {
      return;
    }

    const rect = dataTipItem.select('.data-tip-item-symbol');
    if (!rect.node()) {
      return;
    }
    rect.attr('fill', color);

    const text = dataTipItem.select('.data-tip-item-text');
    if (!text.node()) {
      return;
    }
    text.select('.dtit-value').attr('fill', color);
  };

  hideDataTipItem(d) {
    const dataTipItem = d3.select(`.data-tip-item[data-id="${d.id}"]`);
    if (!dataTipItem.node()) {
      return;
    }

    dataTipItem.select('.dtit-value').text('--.--');
    dataTipItem.attr('opacity', 0.1);
  }

  showDataTipItem(d) {
    const dataTipItem = d3.select(`.data-tip-item[data-id="${d.id}"]`);
    if (!dataTipItem.node()) {
      return;
    }

    dataTipItem.attr('opacity', 1);
  }

  showDataTipPanel = (mouse) => {
    let w = Math.floor(this.dataTipPanel.node().getBBox().width);
    const back = this.dataTipPanel.select('.data-tip-back');
    const backWidth = parseInt(back.attr('width'));

    if (backWidth === 0) {
      w = w + 40;
      back.attr('width', w);
    }

    this.dataTipPanel.raise()
      .attr('transform', `translate(${mouse[0] + 6}, ${mouse[1] + 10})`)
      .attr('data-status', 'active');
  }


  showDateTip = (mouse) => {
    let w = Math.floor(d3.select('.date-tip-label').node().getBBox().width) + 20;
    let h = 27;

    if (w % 2 === 0) {
      w += 1;
    }
    let path = `M0 0 L${w} 0 L${w} ${h} L${w / 2 + 4} ${h} L${w / 2} ${h + 4} L${w / 2 - 4} ${h} L0 ${h}z`;
    d3.select('.date-tip-back').attr('d', path);
    d3.select('.current-date-tip').attr('data-status', 'active');
  }

  hideDateTip = () => {
    d3.select('.current-date-tip').attr('data-status', '');
  }


  positionDateTip = (chartController, mouse) => {
    const label = d3.select('.date-tip-label');
    const date = chartController.xScale.invert(mouse[0]);
    let w = Math.round(d3.select('.date-tip-back').node().getBBox().width);
    const x = Math.round(mouse[0] - w / 2);

    label.text(dateFormat(date));
    d3.select('.current-date-tip').attr('transform', `translate(${x}, -27)`);

    let labelWidth = Math.floor(label.node().getBBox().width);
    let labelX = Math.round((w - labelWidth) / 2);
    label.attr('x', labelX);
  }


  hideDataTipPanel = () => {
    this.dataTipPanel.attr('data-status', '');
  }


  /**
   * Get all sub lines of channel
   * @param {String} channelId 
   */
  getLinesOfChannel(channelId) {
    const arr = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.dataset.cid === channelId + '') {
        arr.push(line);
      }
    }
    return arr;
  }

  /**
   * Get the sub line of lines of channel by mouse x
   * @param {String} cid 
   * @param {Number} mouseX 
   */
  getLineOnMouseX(cid, mouseX) {
    const subLines = self.getLinesOfChannel(cid);
    for (let i = 0; i < subLines.length; i++) {
      const line = subLines[i];

      if (!line) {
        continue;
      }

      const box = line.getBBox();
      if (box.x <= mouseX && mouseX <= (box.x + box.width)) {
        return line;
      }
    }

    return null;
  }


  updateLineColor(channelId, color) {
    this.refs[`spline${channelId}`].updateColor(color);

    d3.selectAll('.current-point')
      .style("stroke", d => d.color);

    this.updateDataTipColor(channelId, color);
  }


  startDrag = () => {
    const { chartController } = this.props;

    if (chartController.datasourceMode === 'History') {
      this.dragEnabled = true;
    } else {
      this.dragEnabled = false;
      return;
    }

    const { x, y } = d3.event;
    this.dragStartX = x;
    this.dragStartY = y;

    this.hideDataTipPanel();
    this.hideDateTip();

    d3.select('#drag-bound')
      .attr('visibility', 'visible');
  }

  dragging = () => {
    if (!this.dragEnabled) {
      return;
    }

    let x = this.dragStartX,
      y = this.dragStartY,
      w = d3.event.x - this.dragStartX,
      h = d3.event.y - this.dragStartY;


    if (w < 0) {
      w = Math.abs(w);
      x = d3.event.x;
    }

    if (h < 0) {
      h = Math.abs(h);
      y = d3.event.y;
    }

    d3.select('#drag-bound')
      .attr('x', x)
      .attr('y', y)
      .attr('width', w)
      .attr('height', h);
  }

  endDrag = () => {
    if (!this.dragEnabled) {
      return;
    }

    const { chartController } = this.props;
    if (!chartController) {
      return;
    }

    const x = this.dragStartX;
    const w = parseInt(d3.select('#drag-bound').attr('width'));

    let timesPerPix = chartController.computetimesPerPix(); //unit: millisecond
    let start = new Date(chartController.timePeriod.start.getTime() + x * timesPerPix);
    let end = new Date(start.getTime() + timesPerPix * w);

    const timePeriod = {
      start: start,
      end: end
    }

    //Compute current scale
    timesPerPix = (end.getTime() - start.getTime()) / chartController.chartWidth;

    //Min scale
    if (timesPerPix >= 500) {
      chartController.setTimePeriod(timePeriod);
      d3.select('#line-chart').dispatch('changeTimePeriod');
      d3.select('#line-chart').dispatch('updateScaleActions');
      d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA);
    }

    //Reset and hide the drag bound rect
    d3.select('#drag-bound')
      .attr('width', 0)
      .attr('height', 0)
      .attr('visibility', 'hiden');

    //Hide the time period selector if it's visible
    const { hideTimePeriod } = this.props;
    if (typeof (hideTimePeriod) === 'function') {
      hideTimePeriod();
    }


  }

}

export default SplineGroup;