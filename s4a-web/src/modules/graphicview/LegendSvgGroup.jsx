import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';

import LegendSvgItem from './LegendSvgItem';

let dataset = [];
class LegendSvgGroup extends Component {

  setData(data) {
    dataset = data;
    this.forceUpdate();
  }

  render() {
    const items = dataset.map(d => <LegendSvgItem key={ dataset.indexOf(d) } data={d}/>);
    return(
      <g id="legend-group" >
        <rect className='legend-group-back' x="0.5" y="0.5"  rx="3" ry="3"  
          height="30" style={{fill:'none',stroke:'rgb(170,170,170)',strokeWidth:0.9,opacity:0.5}} />
        { items }
      </g>

    );
  }

  setWidth(w) {
    $('.legend-group-back').attr('width', w);
  }
  setHeight(h) {
    $('.legend-group-back').attr('height', h);
  }

  setPosition(p) {
    d3.select('#legend-group').attr('transform',`translate(${p.x},${p.y})`);
  }

  updateColor() {
    this.forceUpdate();
  }
}

export default LegendSvgGroup;