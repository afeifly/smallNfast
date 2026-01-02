import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';

import './css/style.css';
import ColorPicker from './ColorPicker';


class ColorPickerPopup extends Component {
  constructor() {
    super();
    this.color = '#03a9f4';
  }

  render() {
    return(
      <div className="color-picker-box">
       <div className="color-picker-btn" ref="btn" onClick={ this.openColorBoard }/>
       <div className="color-board">
        <ColorPicker onChange={ this.setColor } onClose={ this.closeColorBoard }/>
       </div>
      </div>
    );
  }

  componentDidMount() {
    this.setColor(this.color);
    d3.select(document).on('mousedown.colorPicker', () => {
      const el = d3.event.target.className;
      if (el === 'color-picker-btn' || el === 'color-cell') {
        return;
      }
      
      const colorBoard = d3.select('.color-board');
      if(colorBoard && colorBoard.attr('data-status') === 'active') {
        colorBoard.attr('data-status', '');
      }
    });
  }

  componentWillUnmount() {
    d3.select(document).on('mousedown.colorPicker', null);
  }

  openColorBoard() {
    d3.select('.color-board').attr('data-status', 'active');
  }

  closeColorBoard() {
    d3.select('.color-board').attr('data-status', '');
  }

  setColor = (color) => {
    const { onChange } = this.props;

    this.color = color;
    d3.select(this.refs.btn).style('background-color', color);

    if (typeof(onChange) === 'function') {
      onChange(color);
    }
  }

  
}

export default ColorPickerPopup;