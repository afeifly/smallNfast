import React, { Component } from 'react';
import * as d3 from 'd3';

const padding = 20;
// let scale;

class XAxis extends Component {
  constructor() {
    super();
    // scale = d3.scaleTime();
  }

  render() {
    return(
      <g id="x-axis"/>
    );
  }

  // componentDidMount() {
  //   const { computeWidth } = this.props;
  //   const chartWidth = computeWidth();
  //   scale = d3.scaleTime()
  //   .domain([new Date(2018, 6, 19, 15, 40), new Date(2018, 6, 19, 15, 41)])
  //   .range([0, chartWidth]);

  //   this.updateView();
  // }

  updateView = (x, y, width) => {
    const { xScale } = this.props;
    // scale.domain([new Date(2019, 0, 17), new Date()])
    //      .range([0, width]);
    // scale = d3.scaleTime()
    //   .domain([new Date(2017, 6, 19, 15, 40), new Date(2018, 6, 19, 15, 41)])
    //   .range([0, width]);

    if (!xScale) {
      return;
    }

    d3.select('#x-axis').attr('transform', `translate(${x}, ${y})`)
      .call(d3.axisBottom(xScale));
  }

  updateScale(domain) {
    const { xScale } = this.props;
    xScale.domain(domain);
    d3.select('#x-axis').transition().call(d3.axisBottom(xScale));
  }

  updatePosition = (x, y) => {
    d3.select('#x-axis').attr('transform', `translate(${x}, ${y})`);
  }
}

export default XAxis;