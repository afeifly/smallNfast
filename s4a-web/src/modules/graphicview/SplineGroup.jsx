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

    this.rootRef = React.createRef();
    this.mouseLineRef = React.createRef();
    this.splineRefs = new Map();

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
      <ChannelAreaChart ref={el => this.splineRefs.set(d.id, el)}
        channel={d} key={d.id}
        chartController={chartController}
      />
    );

    const dataTipPanel = this.getDataTip();

    return (
      <g id="line-container" ref={this.rootRef} transform={`translate(${x}, 70)`}>
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

        <g className="spline-container" transform="translate(0, 0)">
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
        <path className="mouse-line" ref={this.mouseLineRef} />

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

    d3.select('#line-container').on('switch', (event) => {
      const data = event.detail.data;
      const show = event.detail.show;

      data.visible = show;
      const spline = this.splineRefs.get(data.id);
      if (spline) {
        spline.setVisible(show);
      }
    });


    const drag = d3.drag()
      .on('start', this.startDrag)
      .on('drag', this.dragging)
      .on('end', this.endDrag);
    d3.select('.line-background').call(drag);

    d3.select('#line-container')
      .on('mouseover', function (event) {
        const mouse = d3.pointer(event);
        self.mouseOver(mouse);
      })
      .on('mousemove', function (event) {
        const mouse = d3.pointer(event);
        self.mouseMove(mouse);
      })
      .on('mouseout', () => {
        d3.select('.mouse-line').style('opacity', 0);
        d3.selectAll('.mouse-per-line').style('opacity', 0);
        this.hideDataTipPanel();
        this.hideDateTip();
      });
  }

  /**
   * After React re-renders (triggered by setData → forceUpdate), re-draw the
   * splines. This is critical for the re-select case: when a channel is deselected,
   * its ChannelAreaChart unmounts and its ref is set to null. On re-select,
   * forceUpdate re-mounts it and the ref becomes valid again — but updateDisplay()
   * called immediately after setData() still sees the null ref. This
   * componentDidUpdate runs after the re-render, so the refs are valid.
   */
  componentDidUpdate() {
    const { chartController } = this.props;
    const x = chartController.chartX;
    const width = chartController.chartWidth;
    const height = chartController.chartHeight;

    // Keep the container transform in sync
    d3.select('#line-container').attr('transform', `translate(${x}, 70)`);
    d3.select('.line-background').attr('width', width).attr('height', height);

    // Re-draw each channel's spline with now-valid refs
    dataset.forEach(d => {
      const lineItem = this.splineRefs.get(d.id);
      if (lineItem) {
        lineItem.draw();
      }
    });
  }

  updateDisplay = () => {
    const { chartController } = this.props;

    const x = chartController.chartX;
    const width = chartController.chartWidth;
    const height = chartController.chartHeight;

    // Sync the container's SVG transform with the current chartX so lines always
    // start at the Y-axis, not the left edge of the SVG. chartX is set by
    // AxisSeries.reviseYAxisLayout() which may run after React's render pass.
    d3.select('#line-container').attr('transform', `translate(${x}, 70)`);

    //Update line background size
    d3.select('.line-background')
      .attr('width', width)
      .attr('height', height);

    //Redraw the lines
    let lineItem;
    dataset.forEach(d => {
      lineItem = this.splineRefs.get(d.id);
      if (lineItem) {
        lineItem.draw();
      }
    });

    setTimeout(() => {
      lines = document.getElementsByClassName('sub-line');
      self.initMousePerLine();

      d3.select('.mouse-line')
        .style('stroke', 'rgba(0, 0, 0, 1)')
        .style('stroke-width', 1);
    }, 1000);

  }

  refreshData = () => {
    let lineItem;
    dataset.forEach(d => {
      lineItem = this.splineRefs.get(d.id);
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

    if (!this.dragEnabled && (d3.select('.current-date-tip').attr('data-status') !== 'active' ||
        (this.dataTipPanel && this.dataTipPanel.attr('data-status') !== 'active'))) {
      this.mouseOver(mouse);
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

        const res = d.resolution !== undefined ? d.resolution : 2;
        value = d.scale.invert(pos.y).toFixed(res);
        self.setDataTipContent(d, value);

        return "translate(" + Math.floor(mouse[0]) + "," + Math.floor(pos.y) + ")";
      });


    this.positionDataTipPanel(chartController, mouse[0], mouse[1]);
    this.positionDateTip(chartController, mouse);
    // this.dataTipPanel.attr('transform', `translate(${mouse[0] + 6}, ${mouse[1] + 10})`);
  }

  positionDataTipPanel = (chartController, x, y) => {
    const tipOffsetX = x + 10;
    const tipOffsetY = y + 18;
    let w = Math.floor(this.dataTipPanel.node().getBBox().width);

    // Flip the tip to the LEFT side of the cursor when it would overflow the right
    // edge of the chart data area. x is in #line-container coordinates
    // (origin = left edge of the chart area), so chartWidth is the correct boundary.
    // The old code compared against window.screen.width (monitor resolution) which
    // is always much larger than the chart, so the flip never triggered.
    const finalX = (tipOffsetX + w > chartController.chartWidth)
      ? (x - w - 10)
      : tipOffsetX;

    this.dataTipPanel.attr('transform', `translate(${finalX}, ${tipOffsetY})`);
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
    const spline = this.splineRefs.get(channelId);
    if (spline) {
      spline.updateColor(color);
    }

    d3.selectAll('.current-point')
      .style("stroke", d => d.color);

    this.updateDataTipColor(channelId, color);
  }


  startDrag = (event) => {
    const { chartController } = this.props;

    if (chartController.datasourceMode === 'History') {
      this.dragEnabled = true;
    } else {
      this.dragEnabled = false;
      return;
    }

    const { x, y } = event;
    this.dragStartX = x;
    this.dragStartY = y;

    this.hideDataTipPanel();
    this.hideDateTip();

    d3.select('#drag-bound')
      .attr('visibility', 'visible');
  }

  dragging = (event) => {
    if (!this.dragEnabled) {
      return;
    }

    let x = this.dragStartX,
      y = this.dragStartY,
      w = event.x - this.dragStartX,
      h = event.y - this.dragStartY;


    if (w < 0) {
      w = Math.abs(w);
      x = event.x;
    }

    if (h < 0) {
      h = Math.abs(h);
      y = event.y;
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

    this.dragEnabled = false;
  }

}

export default SplineGroup;