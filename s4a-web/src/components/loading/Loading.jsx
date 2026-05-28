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

    return (
      <div className="loading-box" ref={this.rootRef} 
        data-status={ defaultVisible === true ? 'active' : ''}>
        
        <div className="loading-content-card">
          <svg className="loading-svg" width="64" height="64">
            <g className="loading-back" transform="translate(32, 32)"/>
            <g transform="translate(32, 32)">
              <circle r="4" fill="#00ac86"/>
              <path id="loading-pointer" d="M-4 0 L0 -16 L4 0z" fill="#00ac86"/>
            </g>
          </svg>
          
          <div className="loading-text-container">
            <span className="loading-main-message">Loading...</span>
            <span className="loading-percentage-text"></span>
          </div>

          <div className="loading-progress-bar-container">
            <div className="loading-progress-bar-filler indeterminate" style={{ width: '100%' }}></div>
          </div>
        </div>
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
    const container = d3.select(this.rootRef.current);
    container.attr('data-status', 'active');
    
    container.select('.loading-progress-bar-filler')
      .classed('determinate', false)
      .classed('indeterminate', true)
      .style('width', null);
    container.select('.loading-percentage-text').text('');
    container.select('.loading-main-message').text('Loading...');
  } 

  showWithMessage(message) {
    this.draw();
    const container = d3.select(this.rootRef.current);
    container.attr('data-status', 'active');

    const percentMatch = message.match(/(\d+)\s*%/);
    const percent = percentMatch ? parseInt(percentMatch[1], 10) : null;
    const cleanMessage = message.replace(/\s*\d+\s*%/, '');

    container.select('.loading-main-message').text(cleanMessage);

    const filler = container.select('.loading-progress-bar-filler');
    const pctText = container.select('.loading-percentage-text');

    if (percent !== null) {
      filler
        .classed('indeterminate', false)
        .classed('determinate', true)
        .style('width', `${percent}%`);
      pctText.text(`${percent}%`);
    } else {
      filler
        .classed('determinate', false)
        .classed('indeterminate', true)
        .style('width', null);
      pctText.text('');
    }
  }

  hide() {
    d3.select(this.rootRef.current).attr('data-status', '');
    setTimeout(() => {
      if (this.rootRef.current) {
        const container = d3.select(this.rootRef.current);
        if (container.attr('data-status') !== 'active') {
          container.select('.loading-main-message').text('Loading...');
          container.select('.loading-percentage-text').text('');
          container.select('.loading-progress-bar-filler')
            .classed('determinate', false)
            .classed('indeterminate', true)
            .style('width', null);
        }
      }
    }, 300);
  } 

}

export default Loading;