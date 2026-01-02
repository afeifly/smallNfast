import React, { Component } from 'react';
import * as d3 from 'd3';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
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
          <Grid container direction="column" justify="space-around" alignItems="flex-start" style={ w_style }>
            <TextField label={ intl.get('YAXIS_DESCRIPTION') } margin="normal"/>
            <FormControlLabel d='yAxisAutoScalingCB'
              // checked= {this.state.auto}
              control={
                <Checkbox color="primary" checked= {this.state.auto} onClick={this.onAutoClick } />
              } 
              label={ intl.get('AUTO_SCALING') }
              // onClick={this.onAutoClick }
            />
            <Grid container direction="row" justify="flex-start" alignItems="flex-start" >
              <TextField type="number" label={ intl.get('FROM') }
                         defaultValue={ this.minValue } margin="normal"
                         onChange={ event => this.changeMinValue(event) }/>
              <TextField type="number" label={ intl.get('TO') }
                         defaultValue={ this.maxValue } margin="normal"
                         onChange={ event => this.changeMaxValue(event) }/>
            </Grid>
            
            <TextField type="number" label={ intl.get('NUMBER_OF_STEPS') }
                       defaultValue={ this.steps } margin="normal"
                       onChange={ event => this.changeSteps(event) }/>
          
          </Grid>
        </DialogContent> 

        <DialogActions className="dialog-footer">
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

  changeMinValue = (event) => {
    const value = event.target.value;

    if(value < this.maxValue) {
      this.minValue = event.target.value;
    }
  }

  changeMaxValue = (event) => {
    const value = event.target.value;

    if(value > this.minValue) {
      this.maxValue = event.target.value;
    }
  }

  changeSteps = (event) => {
    const value = event.target.value;

    if (value > 0) {
      this.steps = value;
    }
  }

  saveSetting = () => {
    //todo save the change to server

    this.yAxisData.scale.domain([this.minValue, this.maxValue]);
    this.yAxisData.ticks = this.steps;

    d3.select('#line-chart').dispatch(SystemEvent.UPDATE_YAXIS_AND_SPLINES);

    this.handleClose();
  }

}

export default YAxisSetting;