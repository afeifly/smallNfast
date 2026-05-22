import React, { Component } from 'react';
import * as d3 from 'd3';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';


// import './css/YAxisSetting.css';
import ColorPicker from '../../components/color/ColorPicker';
import { SystemEvent } from '../../util/SystemConstant';
import { Switch } from '@mui/material';
import intl from "react-intl-universal";

class ChannelSetting extends Component {

  constructor() {
    super();
    this.state = {
      open: false,
      visibleChecked: true,
    };

    this.channel = null;
    this.color = null;
  }

  componentDidMount() {
  }

  close = () => {
    d3.select('.graphic-view').dispatch('closeYAxisSetting');
  };


  handleClickOpen = (channel) => {
    this.channel = channel;
    this.setState({
      open: true,
      visibleChecked: channel.visible
    });
  }



  handleClose = () => {
    this.setState({
      open: false,
    });
  }


  render() {
    let color = '';

    if(this.channel) {
      color = this.channel.color;
    }

    return (
      <Dialog maxWidth='md' onClose={this.handleClose} open={this.state.open} >
       <DialogTitle className="dialog-title" onClose={this.handleClose}>
        { intl.get('DISPLAY_SETTING') }
       </DialogTitle>
        <DialogContent>
          <div style={{ paddingTop: 8 }}>{ intl.get('COLOR') }</div>
          <ColorPicker value={ color } onChange={ this.setColor }/>
          
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center' }}>
            <span>{ intl.get('VISIBLE') }</span>
            <Switch color="primary" checked={ this.state.visibleChecked }
              onChange={ this.setVisible }/>
          </div>
        </DialogContent> 

        <DialogActions className="dialog-footer">
        <Button onClick={this.handleClose}>
            { intl.get('CANCEL') }
          </Button>
          <Button onClick={this.handleOk} color="primary" variant="contained">
            { intl.get('OK') }
          </Button>
        </DialogActions>
      </Dialog>
    );
  }


  setColor = (color) => {
    this.color = color;
  }

  setVisible = () => {
    const visible = !this.state.visibleChecked;
    this.channel.visible = visible;

    this.setState({
      visibleChecked: visible
    })
  }

  /**
   * Set channel color and update the spline and legend
   */
  handleOk = () => {
    if(this.color) {
      this.channel.color = this.color;
    }

    //TODO: to save the setting 
    d3.select('#line-chart').dispatch(SystemEvent.UPDATE_CHANNEL_COLOR, 
      {
        detail:{ 
          channelId: this.channel.id,
          color: this.color
        }
      }
    );

    this.handleClose();
  }
}

export default ChannelSetting;