
import React, { Component } from 'react';
import $ from 'jquery';
import * as d3 from  'd3';

import Checkbox from '@material-ui/core/Checkbox';
import CheckBoxOutlineBlankIcon from '@material-ui/icons/CheckBoxOutlineBlank';
import IndeterminateCheckBoxIcon from '@material-ui/icons/IndeterminateCheckBoxOutlined';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import ChannelItem from './ChannelItem';


class ChannelGroup extends Component {

  constructor() {
    super();
    this.state = {
      data: {},
      checked: false,
      expand: true,
      listHeight: 0
    }
  }

  render() {
    const { data } = this.props;
    const { expand, checked } = this.state;
    let hasOneSelected = this.hasOneSelected();

    const channelItems = data.channels.map(d => {
      return <ChannelItem key={ d.id } data={ d } change={ this.subItemChange }/>
    });

    return (
      <div className="channel-group" onDoubleClick={ this.switchGroup }>
        <div className="channel-group-header">
          <a className="triangle-btn" ref="triangleBtn" data-expend={ expand } 
            onClick={ this.switchGroup }/>
          <Checkbox 
            checked={ checked }
            onChange={this.handleChange(data)}
            color="primary"
            icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
            checkedIcon={<CheckBoxIcon fontSize="small" />}
            indeterminateIcon={<IndeterminateCheckBoxIcon fontSize="small"/>}
            indeterminate = { !checked && hasOneSelected }
            value={ data.name }
          />
          <div className="CL-item-label" data-type="sensor">{ data.name }</div>
        </div>

        <div className="CG-channel-list" ref="channelList">
          { channelItems }
        </div>
      </div>
      
    );
  }

  componentDidMount() {
    const channelList = $(this.refs.channelList);
    const h = channelList.height();
    channelList.css('height', h + 'px');
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

  switchGroup = () => {
    let { data } = this.props;
    let { expand } = this.state;

    expand = !expand;
    this.setState({
      expand: expand
    });

    if(expand) {
      const h = data.channels.length * 32;
      d3.select(this.refs.channelList).style('height', h + 'px');
    }else  {
      d3.select(this.refs.channelList).style('height', 0);
    }
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