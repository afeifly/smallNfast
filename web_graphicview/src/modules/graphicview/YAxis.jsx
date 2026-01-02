import React, { Component } from 'react';
import * as d3 from 'd3';

import { SystemEvent } from '../../util/SystemConstant';

class YAxis extends Component {
  constructor() {
    super();

    this.state = {
      axisWidth: 0
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    return false;
  }

  
  render() {
    return(
      <g className="y-axis" ref="root"  visibility="hidden">
        <rect className="y-axis-background" fill="rgb(25, 118, 210)" onClick={ this.showYAxisSetting }/>
      </g>
    );
  }


  componentDidMount() {
    this.rerender();  
  }


  updateAxisName = (name) => {
    const { data } = this.props;
    const container = d3.select(this.refs.root);
    let axis_info = container.select('.y-axis-info');
    let name_text;



    if (!axis_info || !axis_info.node()) {
      data.baseWidth = this.getWidth() + 10; 
      axis_info = container.append('g').classed('y-axis-info', true);
      axis_info.append('text')
        .classed(`y-axis-name`, true)
        .attr('text-anchor', 'left')
        .on('click', this.changePosition);
    }

    name_text = axis_info.select('.y-axis-name');
    name_text.text(name);

    
    axis_info.attr('transform', `translate(0, -16)`);
  };


  reviseLayout = (x, withAnimation) => {
    const container = d3.select(this.refs.root);
    let axis_info = container.select('.y-axis-info');

    if(!axis_info) return;

    let w = this.getWidth();
    let measuredX = w + x; 

    if (withAnimation) {
      container.transition().duration(500)
        .attr('transform', `translate(${measuredX}, 0)`);
      
    }else {
      container.attr('transform', `translate(${measuredX}, 0)`);
    }
  }


  getWidth = () => {
    const w = Math.round(this.refs.root.getBBox().width);
    return w;
  }

  getHeight = () => {
    const h = Math.round(this.refs.root.getBBox().height);
    return h;
  }

  moveTo = (x, withAnimation = false) => {
    const { data } = this.props;
    
    if(data.index === 0) {
      this.reviseLayout(x, withAnimation);
      return;
    }

    if(withAnimation) {
      d3.select(this.refs.root)
        .transition().duration(500)
        .attr('transform', `translate(${x}, 0)`);
    }else {
      d3.select(this.refs.root)
        .attr('transform', `translate(${x}, 0)`);
    }
  }


  getX = () => {
    return this.getTXByTransfrom(d3.select(this.refs.root));
  }

  getTXByTransfrom(el) {
    if(!el) {
      return null;
    }

    return Number(el.attr("transform").match(/((-|\+)?\d+)(\.\d+)?/g)[0]);
  }

  changePosition = () => {
    const { data } = this.props;
    if(data.index === 0){      
      // d3.select('.graphic-view').dispatch(SystemEvent.SHOW_YAXIS_SETTING);
      return;
    }
    d3.select('#axis-container').dispatch('changePosition', {detail: {data: data}});
  }


  rerender = () => {
    const { data } = this.props;

    const container = d3.select(this.refs.root);
    let thickness = 1;
    let foo;
    
    let direction;

    if(data.index === 0) {
      direction = 'left';
    }else {
      direction = 'right';
    }

    if (direction === 'left') {
      foo = d3.axisLeft(data.scale);
    } else {
      foo = d3.axisRight(data.scale);
    }


    // if (isMajor) {
    //   thickness = 2;
    // }
    
    container.call(foo.ticks(data.ticks));

    container.selectAll('path')
             .style('stroke-width', thickness);
      // .style('stroke', data.color);

    container.selectAll('line')
             .style('stroke-width', thickness);

    //Major YAxis display effect
    if (direction === 'left') {
      container.attr('text-anchor', 'end');
    }else {
      container.attr('text-anchor', 'start');
    }
    
    this.updateAxisName(data.unit);
    this.updateBackground(container);
  }

  updateBackground = (container) => {
    const { data } = this.props;

    //Reset width and height of back to 0, 
    //than compute the y-axis width and height 
    container.select('.y-axis-background')
             .attr('height', 0)
             .attr('width', 0);

    const w = this.getWidth();
    const h = this.getHeight() - 35;
    let x = 0;

    if(data.index === 0) {
      x = 0 - w;
    }

    container.select('.y-axis-background')
      .attr('x', x)
      .attr('width', w)
      .attr('height', h)
      .raise();
  }


  showYAxisSetting = () => {
    const { data } = this.props;
    d3.select('.graphic-view').dispatch(SystemEvent.SHOW_YAXIS_SETTING, {
      detail: data
    });
  }
}

export default YAxis;