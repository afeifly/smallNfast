import React, { Component } from 'react';
import * as d3 from 'd3';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import intl from "react-intl-universal";


import { SystemEvent } from '../../util/SystemConstant';

class YAxisSetting extends Component {

  constructor() {
    super();
    this.state = {
      open: false,
      auto: true,
    };

    this.yAxisData = null;
    this.minValue = 0;
    this.maxValue = 0;
    this.steps = 10;
  }

  componentDidMount() {
  }

  close = () => {
    d3.select('.graphic-view').dispatch('closeYAxisSetting');
  };


  handleClickOpen = (yAxisData) => {
    this.yAxisData = yAxisData;

    this.minValue = this.yAxisData.scale.domain()[0];
    this.maxValue = this.yAxisData.scale.domain()[1];

    this.setState({
      open: true,
    });
  }


  onAutoClick = (event) => {    
    this.setState({    
      auto: !this.state.auto
    });     
  }


  handleClose = () => {
    this.setState({
      open: false,
    });
  }


  render() {
    const w_style = {
      width: '400px',
      padding: '15px'     
    }

    let description = '';
    return (

      <Dialog maxWidth='md' onClose={this.handleClose} open={this.state.open} >
       <DialogTitle className="dialog-title" onClose={this.handleClose}>
          { intl.get('YAXIS_SETTING') }
       </DialogTitle>
        <DialogContent>
          <Grid container direction="column" justifyContent="space-around" alignItems="flex-start" style={ w_style }>
            <FormControlLabel d='yAxisAutoScalingCB'
              // checked= {this.state.auto}
              control={
                <Checkbox color="primary" checked= {this.state.auto} onClick={this.onAutoClick } />
              } 
              label={ intl.get('AUTO_SCALING') }
              // onClick={this.onAutoClick }
            />
            <Grid container direction="row" justifyContent="flex-start" alignItems="flex-start" >
              <TextField type="number" label={ intl.get('FROM') }
                         defaultValue={ this.minValue } margin="normal"
                         inputProps={{ step: 'any' }}
                         onChange={ event => this.changeMinValue(event) }/>
              <TextField type="number" label={ intl.get('TO') }
                         defaultValue={ this.maxValue } margin="normal"
                         inputProps={{ step: 'any' }}
                         onChange={ event => this.changeMaxValue(event) }/>
            </Grid>
            
            <TextField type="number" label={ intl.get('NUMBER_OF_STEPS') }
                       defaultValue={ this.steps } margin="normal"
                       onChange={ event => this.changeSteps(event) }/>
          
          </Grid>
        </DialogContent> 

        <DialogActions className="dialog-footer">
          {this.yAxisData && this.yAxisData.index !== 0 && (
            <Button onClick={this.setAsMain} color="secondary" style={{ marginRight: 'auto' }}>
              { intl.get('SET_AS_MAIN_YAXIS') }
            </Button>
          )}
          <Button onClick={this.handleClose}>
            { intl.get('CANCEL') }
          </Button>
          <Button onClick={this.saveSetting} color="primary" variant="contained">
            { intl.get('OK') }
          </Button>
        </DialogActions>
      </Dialog>

    );
  }

  setAsMain = () => {
    if (this.yAxisData) {
      d3.select('#axis-container').dispatch('changePosition', { detail: { data: this.yAxisData } });
    }
    this.handleClose();
  }

  changeMinValue = (event) => {
    this.minValue = event.target.value;
  }

  changeMaxValue = (event) => {
    this.maxValue = event.target.value;
  }

  changeSteps = (event) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value > 0) {
      this.steps = value;
    }
  }

  saveSetting = () => {
    const min = parseFloat(this.minValue);
    const max = parseFloat(this.maxValue);

    if (isNaN(min) || isNaN(max)) {
      window.showAppNotification(intl.get('YAXIS_SETTING') || "Y-Axis Setting", "Please enter valid numbers for the Y-axis range.", "warning");
      return;
    }

    if (min === max) {
      window.showAppNotification(intl.get('YAXIS_SETTING') || "Y-Axis Setting", "From and To values cannot be equal.", "warning");
      return;
    }

    this.yAxisData.scale.domain([min, max]);
    this.yAxisData.ticks = this.steps;

    d3.select('#line-chart').dispatch(SystemEvent.UPDATE_YAXIS_AND_SPLINES);

    this.handleClose();
  }

}

export default YAxisSetting;