import React, { Component } from 'react';
import * as d3 from 'd3';

import './css/LegendGroup.css';
import { SystemEvent } from '../../util/SystemConstant';

class LegendSvgItem extends Component {
  constructor() {
    super();

    this.state = {
      selected: true
    }
  }

  componentDidMount() {
   
  }

  render() {
    const { data } = this.props;
    let color,fontColor;

    if(this.state.selected && data.visible) {
      color = data.color;      
      fontColor = '#666666'; 
    } else{
      color = "rgb(170, 170, 170)"; 
      fontColor = "rgb(170, 170, 170)"; 
    }
    return(
      <g transform="translate(15, 15)" className="legend-item"  onClick={ () => this.onClick() } >
        <rect  y='-2' rx="3" ry="3" width="24" height="5" style={{ fill:color }} />
        <circle  cx="12.5" cy="0.5" r="4" stroke={ color } strokeWidth="2.1" fill="white"/>
        <text x="28" y="1" dominantBaseline="central" fill={ fontColor }   fontSize="12" className="legend-item-text">{ data.sensorDescription + ' - ' + data.name }</text>	
      </g>
    );
  }


  onClick = () => {
    d3.select('.graphic-view').dispatch(SystemEvent.SHOW_CHANNEL_SETTING, {
      detail: this.props.data
    });
    // let { selected } = this.state;
    // const { data } = this.props;

    // this.setState({
    //   selected: !selected
    // });

    // d3.select('#line-container').dispatch('switch', 
    //   {
    //     detail:{ 
    //       data: data, 
    //       show: !selected 
    //     }
    //   }
    // );
  }

}

export default LegendSvgItem;