import React, { Component } from 'react';
import * as d3 from 'd3';

const padding = 10;

let yAxisData;
let x = 0;
let width = 0;


class LineGrid extends Component {
  constructor() {
    super();

    this.state = {
      axisWidth: 0
    };
  }


  render() {
    return(
      <g id="grid-container" transform="translate(0, 80)">
        <g className="grid-line" transform="translate(4, 0)"/>
      </g>
    );
  }


  componentDidMount() {
    const { yAxisData  } = this.props;
    this.setYAxisData(yAxisData);

    
    // this.updateHLine();
  }


  setYAxisData = (value) => {
    yAxisData = value;
    this.updateHLine();
  }


  setX = (value) => {
    x = value;
    d3.select('#grid-container')
      .attr('transform', `translate(${x}, 80)`);
  };


  setWidth = (value) => {
    width = value;
  }


  updateHLine = (withAnimation = false) => {
    if (!yAxisData) {
      return;
    }


    if (withAnimation) {
      d3.select('.grid-line')
        .transition().duration(500)
        .call(d3.axisLeft(yAxisData.scale)
        .tickSizeInner(-width + 8));
    }else {
      d3.select('.grid-line')
        .call(d3.axisLeft(yAxisData.scale)
        .tickSizeInner(-width + 8));
    }


    d3.select('.grid-line').selectAll(".domain").remove();
    d3.select('.grid-line').selectAll("text").remove();
    // d3.select('.grid-line').select(".tick:first-of-type line").remove();

    d3.select('.grid-line').selectAll(".tick line")
      .style('stroke-opacity', 0.1)
      .attr("stroke", '#000')
      .attr("stroke-dasharray", "2,2");
  };


  // positionGridBack = () => {
  //   const { yDataset } = this.props;

  //   let chartStartX = 0,
  //       chartEndX = 0;
    
  //   const firstData = yDataset[0];
  //   // const lastData = yAxisData[yAxisData.length - 1];
  //   chartStartX = this.refs[firstData.id].getX() + 1;
  //   // chartEndX = this.refs[lastData.id].getX() - 1;
  //   // chartWidth = chartEndX - chartStartX;
  //   chartX  = chartStartX;
  //   d3.select('#grid-container')
  //     .attr('transform', `translate(${chartStartX}, 80)`);
  // };
}

export default LineGrid;