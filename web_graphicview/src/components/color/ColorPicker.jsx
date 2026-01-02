import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';

import './css/style.css';


class ColorPicker extends Component {
  constructor() {
    super();

    this.state = {
      colors: [
        ['#d32f2f', '#f44336'],
        ['#c2185b', '#e91e63'],
        ['#7B1FA2', '#9c27b0'],
        ['#512da8', '#673ab7'],
        ['#303f9f', '#3f51b5'],
        ['#1976d2', '#2196f3'],
        ['#0288d1', '#03a9f4'],
        ['#0097a7', '#00BCD4'],
        ['#00796b', '#009688'],
        ['#388E3C', '#4CAF50'],
        
        ['#33691E', '#689F38'],
        ['#827717', '#AFB42B'],
        ['#F57F17', '#FBC02D'],
        ['#FF6F00', '#FFA000'],
        ['#E65100', '#F57C00'],
        ['#E64A19', '#FF5722'],
        ['#5D4037', '#795548'],
        ['#455A64', '#607D8B']
      ]
    };
  }

  render() {
    const { value } = this.props;
    const items = this.state.colors.map(d => 
      <div className="color-group" key={ d }>
        {
          d.map(color => {
            let status;

            if (value === color) {
              status = 'selected';
            }else {
              status = '';
            }

            return(
              <div className="color-cell" 
                   key={color} data-value={color} 
                   data-status={ status }
                   style={{backgroundColor: color}}
                   onMouseDown={ () => this.doSelect(color) }
                   onClick={() => this.clickCell()}/>
            );
          })
        }
      </div>
    )
    return(
      <div className="color-picker">
        { items }
      </div>
    );
  }

  doSelect(color) {
    const { onChange } = this.props;
    d3.selectAll('.color-cell').attr('data-status', '');
    d3.select(`.color-cell[data-value="${color}"]`).attr('data-status', 'selected');

    if (typeof(onChange) === 'function') {
      onChange(color);
    }
  }

  clickCell = () => {
    const { onClose } = this.props;

    if (typeof(onClose) === 'function') {
      onClose();
    }
  }
}

export default ColorPicker;