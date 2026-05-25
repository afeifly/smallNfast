import React, { Component } from 'react';
import * as d3 from 'd3';

import './css/style.css';

class Loading extends Component {
  constructor() {
    super();
    this.rootRef = React.createRef();
  }

  render() {
    const { defaultVisible } = this.props;

    return(
      <div className="loading-box" ref={this.rootRef} 
        data-status={ defaultVisible === true ? 'active' : ''}>
        <svg className="loading-svg" width="64" height="100">
          <g className="loading-back" transform="translate(32, 32)"/>
          <g transform="translate(32, 32)">
            <circle r="4" fill="#00ac86"/>
            <path id="loading-pointer" d="M-4 0 L0 -16 L4 0z" fill="#00ac86"/>
          </g>
          <text className="loading-label" x="4" y="88">Loading...</text>
        </svg>
      </div>
    );
  }

  componentDidMount() {
    this.draw();
  }

  draw() {
    let data = [
      {name: "1", value: 18, color: '#00ac86'},
      {name: "2", value: 18, color: '#00ac86'},
      {name: "3", value: 64, color: '#212121'}
    ];

    let pie = d3.pie()
    .padAngle(0.06)
    .sort(null)
    .value(d => d.value);

    const arcs = pie(data);

    const arc = d3.arc()
                  .innerRadius(24)
                  .outerRadius(32)
                  .cornerRadius(0);
    
    const container = d3.select(this.rootRef.current);
    container.select('.loading-back')
      .selectAll(".loading-sector")
      .data(arcs)
      .enter()
      .append("path")
      .classed('loading-sector', true)
      .attr("fill", d => d.data.color)
      .attr("d", arc);
  }

  show() {
    this.draw();
    d3.select(this.rootRef.current).attr('data-status', 'active');
  } 

  showWithMessage(message) {
    this.draw();
    if (this.rootRef.current) {
      d3.select(this.rootRef.current).select('.loading-label').text(message);
    }
    d3.select(this.rootRef.current).attr('data-status', 'active');
  }

  hide() {
    d3.select(this.rootRef.current).attr('data-status', '');
    setTimeout(() => {
      if (this.rootRef.current) {
        d3.select(this.rootRef.current).select('.loading-label').text('Loading...');
      }
    }, 300);
  } 

}

export default Loading;