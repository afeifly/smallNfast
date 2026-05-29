import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';

import './css/style.css';


class ColorPicker extends Component {
  constructor() {
    super();

    this.state = {
      colors: [
        // Column 1 (Reds/Pinks) - Row 1
        ['#b71c1c', '#FF5630'],
        // Column 2 (Oranges/Yellows) - Row 1
        ['#e64a19', '#ff9800'],
        // Column 3 (Greens/Teals) - Row 1
        ['#1b5e20', '#00ac86'],
        // Column 4 (Blues) - Row 1
        ['#1565c0', '#1e88e5'],
        // Column 5 (Purples) - Row 1
        ['#6554C0', '#3f51b5'],
        // Column 6 (Browns/Greys/Blacks) - Row 1
        ['#172B4D', '#212121'],

        // Column 1 (Reds/Pinks) - Row 2
        ['#FF7452', '#e91e63'],
        // Column 2 (Oranges/Yellows) - Row 2
        ['#FFAB00', '#FFC400'],
        // Column 3 (Greens/Teals) - Row 2
        ['#36B37E', '#57D9A3'],
        // Column 4 (Blues) - Row 2
        ['#2196f3', '#90caf9'],
        // Column 5 (Purples) - Row 2
        ['#9c27b0', '#4a148c'],
        // Column 6 (Browns/Greys/Blacks) - Row 2
        ['#5d4037', '#8d6e63'],

        // Column 1 (Reds/Pinks) - Row 3
        ['#d81b60', '#f8bbd0'],
        // Column 2 (Oranges/Yellows) - Row 3
        ['#fbc02d', '#fff59d'],
        // Column 3 (Greens/Teals) - Row 3
        ['#00B8D9', '#c8e6c9'],
        // Column 4 (Blues) - Row 3
        ['#e3f2fd', '#455a64'],
        // Column 5 (Purples) - Row 3
        ['#b39ddb', '#e1bee7'],
        // Column 6 (Browns/Greys/Blacks) - Row 3
        ['#616161', '#e0e0e0']
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

            if (value && color && value.toLowerCase() === color.toLowerCase()) {
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