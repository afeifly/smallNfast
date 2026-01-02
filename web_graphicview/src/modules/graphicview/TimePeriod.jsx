import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import 'react-datepicker/dist/react-datepicker-cssmodules.css';
import intl from "react-intl-universal";

import './css/TimePeriod.css';
import { SystemEvent } from '../../util/SystemConstant';

let brushMode = true;
let scale = d3.scaleTime();

class TimePeriod extends Component {

  constructor() {
    super();

    this.state = {
      startDate: new Date(),
      endDate: new Date()
    }

  }



  render() {
    const now = new Date();

    // const buttonStyle = {
    //   paddingTop: 10,
    //   width: 44,
    //   height: 44
    // };

    return (
      <div className="time-period" ref="root">
        <span className="time-period-label">{intl.get('TIME_PERIOD')}</span>
        <svg id='time-period-brush' data-status="active">
          <g className="overall-xaxis">
            <g id="x-axis2" />
            <g className="x-brush" />
          </g>
        </svg>

        <div className="time-pickup-group" >
          <div className="field-name">From</div>
          <DatePicker
            selected={this.state.startDate}
            timeInputLabel="Start Time:"
            onChange={this.changeStart}
            dateFormat="MM/dd/yyyy h:mm aa"
            maxDate={this.state.endDate}
            showMonthDropdown
            useShortMonthInDropdown
            showTimeInput
          />
          <div className="field-name">To</div>
          <DatePicker
            selected={this.state.endDate}
            timeInputLabel="End Time:"
            onChange={this.changeEnd}
            dateFormat="MM/dd/yyyy h:mm aa"
            maxDate={now}
            minDate={this.state.startDate}
            showMonthDropdown
            useShortMonthInDropdown
            showTimeInput
          />
        </div>

        <div className="tp-button-container">
          <div className="tp-icon-button" data-type="switch"
            onClick={this.toggleTimeTool}
          />

          <div className="tp-icon-button" data-type="close"
            onClick={this.hide}
          />
        </div>

      </div>
    );
  }


  show() {
    const { chartController } = this.props;

    this.setState({
      startDate: chartController.timePeriod.start,
      endDate: chartController.timePeriod.end
    });

    d3.select('.time-period')
      .attr('data-status', 'active')
      .style('visibility', 'visible');
    this.updateXBrush();
  }


  hide = () => {
    const { chartController } = this.props;
    chartController.timePeriodVisible = false;
    d3.select('.time-period').attr('data-status', '');
  }

  toggleTimeTool() {
    brushMode = !brushMode;

    const container = $('.time-period');
    const brush = $('#time-period-brush');
    const datePicker = $('.time-pickup-group');

    container.css('overflow', 'hidden');
    brush.show();

    if (!brushMode) {
      datePicker.attr('data-status', 'active');
      brush.attr('data-status', '');
    } else {
      datePicker.attr('data-status', '');
      brush.attr('data-status', 'active');
    }

    setTimeout(() => {
      if (brushMode) {
        container.css('overflow', 'hidden');
      } else {
        container.css('overflow', 'visible');
        brush.hide();
      }
    }, 300);
  }


  changeStart = (date) => {
    this.updateTimePeriod(date, null);
  };

  changeEnd = (date) => {
    this.updateTimePeriod(null, date);
  };


  updateXBrush() {
    const { chartController } = this.props;
    const width = $('.time-period').width() - 270;
    const x = 40;
    const y = 0;

    scale.domain([
      chartController.historyTimeRange.start,
      chartController.historyTimeRange.end
    ]).range([0, width]);

    let brush = d3.brushX().extent([[0, -1], [width, 66]])
      .on("end", () => this.onBrushEnd());
    d3.select('.x-brush').call(brush);

    d3.select('.overall-xaxis').attr('transform', `translate(${x}, ${y})`);

    d3.select('#x-axis2')
      .attr('transform', `translate(0, 40)`)
      .call(d3.axisTop(scale));

    d3.select('#x-axis2').selectAll('text').attr('y', -12);
    // d3.select('#x-axis2').selectAll('path')
    //   .style('stroke', 'rgba(255, 255, 255, 0.5)');

    //   d3.select('#x-axis2').selectAll('line')
    //   .style('stroke', 'rgba(255, 255, 255, 0.5)');
  }

  onBrush = () => {
    var domain = d3.event.selection.map(scale.invert);
    this.refs.xAxis.updateScale(domain);
  }

  onBrushEnd = () => {
    if (!d3.event.selection) {
      return;
    }

    const domain = d3.event.selection.map(scale.invert);

    if (!domain || domain.length < 1) {
      return;
    }

    this.updateTimePeriod(domain[0], domain[1]);
    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA);

  }

  updateTimePeriod = (start, end) => {
    const { chartController } = this.props;
    if (!start) {
      start = this.state.startDate
    }

    if (!end) {
      end = this.state.endDate
    }

    this.setState({
      startDate: start,
      endDate: end
    })


    const timePeriod = {
      start: start,
      end: end
    }
    chartController.setTimePeriod(timePeriod);
    d3.select('#line-chart').dispatch('changeTimePeriod');
    d3.select('#line-chart').dispatch('updateScaleActions');
  }
}

export default TimePeriod;