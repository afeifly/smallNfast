
import React, { Component } from 'react';
import $ from 'jquery';
import * as d3 from  'd3';

import Checkbox from '@mui/material/Checkbox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBoxOutlined';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import ChannelItem from './ChannelItem';


class ChannelGroup extends Component {

  constructor() {
    super();
    this.channelListRef = React.createRef();
    this.state = {
      data: {},
      checked: false
    }
  }

  render() {
    const { data } = this.props;
    const { checked } = this.state;
    let hasOneSelected = this.hasOneSelected();

    const channelItems = data.channels.map(d => {
      return <ChannelItem key={ d.id } data={ d } change={ this.subItemChange }/>
    });

    return (
      <div className="channel-group">
        <div className="channel-group-header">
          <Checkbox 
            checked={ checked }
            onChange={this.handleChange(data)}
            color="primary"
            icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
            checkedIcon={<CheckBoxIcon fontSize="small" />}
            indeterminateIcon={<IndeterminateCheckBoxIcon fontSize="small"/>}
            indeterminate = { !checked && hasOneSelected }
            value={ data.name }
            sx={{
              padding: '4px',
              color: '#cbd5e1',
              '&.Mui-checked': { color: '#00ac86' },
              '&.MuiCheckbox-indeterminate': { color: '#00ac86' }
            }}
          />
          <div className="sensor-group-title">{ data.name }</div>
        </div>

        <div className="CG-channel-list" ref={this.channelListRef}>
          { channelItems }
        </div>
      </div>
    );
  }

  subItemChange = (d) => {
    const changeFunc = this.props.change;

    if (typeof changeFunc === 'function') {
      changeFunc(d);
    }

    this.checkSelectedStatus();
  }

  /**
   * Check that all channels are selected
   */
  getAllSeleted(channels) {
    if (!channels || channels.length === 0) {
      return false;
    }

    let d;
    for (let i = 0; i < channels.length; i++) {
      d = channels[i];
      if(!d.selected) {
        return false;
      }
    }

    return true;
  }

  hasOneSelected() {
    const { data } = this.props;
    if(!data || !data.channels) {
      return false;
    }

    let result = false;
    data.channels.forEach(d => {
      if(d && d.selected) {
        result = true;
      }
    });

    return result;
  }

  handleChange = data => event => {
    data.selected = event.target.checked;
    data.visible = data.selected;
    this.updateAllChannels();
    this.setState({ checked: data.selected });

    const changeFunc = this.props.change;
    data.channels.forEach(d => {
      if (typeof changeFunc === 'function') {
        changeFunc(d);
      }
    });
  };

  updateAllChannels() {
    const { data } = this.props;
    if(!data || !data.channels) {
      return;
    }

    data.channels.forEach(d => {
      if(d) {
        d.selected = data.selected;
      }
    });
  }

  checkSelectedStatus() {
    let { data } = this.props;
    if(!data ) {
      return;
    }

    const allSelected = this.getAllSeleted(data.channels);
    data.selected = allSelected;
    data.visible = data.selected;
    this.setState({ checked: data.selected });
  }
}

export default ChannelGroup;