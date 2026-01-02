import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';

import Tooltip from '@material-ui/core/Tooltip';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Snackbar from '@material-ui/core/Snackbar';
import SnackbarContent from '@material-ui/core/SnackbarContent';
import Slide from '@material-ui/core/Slide';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import InfoIcon from '@material-ui/icons/Info';
import intl from "react-intl-universal";


import { SystemEvent } from '../../util/SystemConstant';
import TestAPI from '../../api/TestAPI';
import DataUtil from '../../util/DataUtil';

import './css/style.css';
import { Menu, MenuItem } from '@material-ui/core';
import ChannelGroup from './ChannelGroup';

let colors = ['#0052CC', '#FF5630', '#00B8D9', '#6554C0',
  '#FFAB00', '#36B37E', '#FFC400', '#FF7452', '#57D9A3', '#172B4D'];

class ChannelList extends Component {

  constructor() {
    super();

    this.state = {
      data: [],
      noMeasurementData: false,
      openAlert: false,

      anchorLocationBtn: null,
      locationList: [],
      currentLocationId: null,
      currentLocation: null,
      currentSensorList: []
    }

    this.timePeriod = {
      start: null,
      end: null
    };

    this.locations = [];
    this.sensorList = [];
    this.newSelectedChannel = null;
  }

  render() {
    const { anchorLocationBtn, currentLocation, currentSensorList } = this.state;

    const locationItems = this.locations.map(d =>
      <MenuItem key={d.id} onClick={() => this.changeLocation(d)}>
        {d.name}
      </MenuItem>
    );


    let noData;
    const items = currentSensorList.map(d => {
      return <ChannelGroup key={d.id} data={d} change={this.changeChannel} />
    });

    let emptyStatus;
    if (!currentSensorList || currentSensorList.length === 0) {
      noData = (
        <div className="empty-placeholder">
          <div className="empty-icon"></div>
          <div className="empty-label">No Data</div>
        </div>
      );
    }

    if (!currentLocation) {
      emptyStatus = 'empty';
    }

    return (
      <div className="channel-list" ref="root">
        <div className="app-window-title">
          <span>{intl.get('CHANNEL')}</span>

          <Tooltip title={intl.get('LOCATION')}>
            <div className="location-info" data-status={emptyStatus}
              onClick={this.handleClick}>
              {currentLocation ? currentLocation.name : intl.get('NO_LOCATION')}
            </div>
          </Tooltip>

          <Menu id="simple-menu" anchorEl={anchorLocationBtn}
            open={Boolean(anchorLocationBtn)}
            onClose={this.handleClose}>
            {locationItems}
          </Menu>
        </div>
        {/* <div className="close-button" onClick={ this.hide }/> */}
        <div className="list-container" onScroll={this.scrollList}>
          {items}
          {noData}
        </div>

        <Dialog
          open={this.state.openAlert}
          onClose={this.handleClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">{intl.get('MAX_SELECTED_CHANNELS_TITLE')}</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              {intl.get('MAX_SELECTED_CHANNELS_NOTE')}
            </DialogContentText>
          </DialogContent>
          {/* <DialogActions>
            <Button onClick={ this.handleClose } autoFocus>
              Close
            </Button>
          </DialogActions> */}
        </Dialog>

        <Snackbar
          open={this.state.noMeasurementData}
          onClose={this.handleClose}
          TransitionComponent={Slide}
          autoHideDuration={5000}
        >
          <SnackbarContent style={{ backgroundColor: '#2196f3' }}
            message={
              <div id="info-snackbar-content">
                <InfoIcon />
                <span style={{ paddingLeft: 8 }}>
                  {intl.get('CHANNEL_NO_MEASURING_DATA')}
                </span>
              </div>
            }
            action={[
              <IconButton key="close" aria-label="Close" color="inherit"
                onClick={this.handleClose}>
                <CloseIcon />
              </IconButton>,
            ]}>

          </SnackbarContent>
        </Snackbar>
      </div>
    );
  }

  getWidth() {
    const container = $(this.refs.root);
    let w = 0;
    if (container) {
      w = container.width();
    }

    return w;
  }

  getData() {
    TestAPI.getLocations(responseData => this.getLocaltionHandler(responseData));
  }


  getLocaltionHandler = (responseData) => {
    if (!responseData) {
      return;
    }

    this.locations.length = 0;  //empty
    const locations = responseData.locations;
    let locationObj;

    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      locationObj = {
        id: location.location_id,
        name: location.description,
        index: location.location_index,
        background_img: location.background_img,
        sensors: location.sensors
      };

      this.locations.push(locationObj);
    }

    TestAPI.getChannels(responseData => this.getChannelHandler(responseData));
  };


  getChannelHandler = (responseData) => {
    if (!responseData) {
      return;
    }

    const { chartController } = this.props;
    const channels = responseData.logging_chs;
    let channel;
    let channelObj;
    let sensor;
    let selected;
    let color;
    let arr = [];

    for (let i = 0; i < channels.length; i++) {
      channelObj = channels[i];
      selected = this.checkChannelSelected(channelObj.channel_id);
      color = this.getcolorFromLocal(channelObj.channel_id);

      channel = {
        id: channelObj.channel_id,
        locationId: channelObj.location_id,
        sensorId: channelObj.sensor_id,
        index: i,
        x: 0,
        y: 0,
        baseWidth: 40,
        name: channelObj.logic_channel_description,
        unit: channelObj.unit_in_ascii,
        sensorDescription: channelObj.sensor_description,
        scale: null,
        yAxisData: null,
        ticks: 10,
        dataLoading: false,   //Set true when loading data from server, and set false after got the data;
        color: color,
        selected: selected,
        visible: selected
      };

      if (selected) {

        if (!channel.color) {
          chartController.setColorFromSetting(channel);
          // channel.color = colors[chartController.selectedChannels.length];
        }
        chartController.addSelectedChannel(channel);
      }

      sensor = this.getSensorById(channel.sensorId);
      if (sensor) {
        if (sensor.channels) {
          sensor.channels.push(channel);
        }
      } else {
        sensor = {
          id: channel.sensorId,
          locationId: channel.locationId,
          name: channel.sensorDescription,
          channels: [channel]
        };
        this.addNewSensor(sensor);
      }

      arr.push(channel);
    }

    this.handleData();
  }

  handleData() {
    const { chartController } = this.props;

    if (!this.locations || this.locations.length === 0) {
      return;
    }

    const defaultLocation = this.locations[0];
    const sensors = this.getSensorListByLocation(defaultLocation);

    this.setState({
      currentLocation: defaultLocation,
      currentLocationId: defaultLocation.id,
      currentSensorList: sensors
    });

    if (chartController.selectedChannels.length > 0) {
      d3.select('.graphic-view').dispatch(SystemEvent.INIT_SELECTED_CHANNELS);
    } else {
      d3.select('.graphic-view').dispatch(SystemEvent.NO_SELECTED_CHANNELS);
    }
  }

  getSensorById = (id) => {
    let sensor;
    for (let i = 0; i < this.sensorList.length; i++) {
      sensor = this.sensorList[i];
      if (sensor.id === id) {
        return sensor;
      }
    }

    return null;
  };

  addNewSensor = (sensor) => {
    this.sensorList.push(sensor);
  };

  handleClick = (event) => {
    this.setState({
      anchorLocationBtn: event.currentTarget
    });

  };


  handleClose = () => {
    this.setState({
      anchorLocationBtn: null,
      openAlert: false,
      noMeasurementData: false
    })
  };

  scrollList() {
    const scrollTop = $('.list-container').scrollTop();
    if (scrollTop === 0) {
      $('.list-container').attr('data-status', '');
    } else {
      $('.list-container').attr('data-status', 'scrolled');
    }
  }




  /**
   * Select or unselect channel
   */
  changeChannel = (channel) => {
    const { chartController } = this.props;

    if (!channel) {
      return;
    }

    //unselect channel
    if (!channel.selected) {
      chartController.removeSelectedChannel(channel.id);
      this.deleteSelectedChannelFromLocal(channel);
      d3.select('.graphic-view').dispatch('changeSelectedChannels');
      return;
    }

    //Has selected
    const isSelected = chartController.isSelectedChannel(channel.selected);
    if (isSelected) {
      return;
    }

    //select channel
    //The number of selected channels is more than maximum
    if (chartController.selectedChannels
      && chartController.selectedChannels.length === 4) {
      this.setState({
        openAlert: true
      });
      channel.selected = false;
      return;
    }

    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA);
    channel.color = colors[chartController.selectedChannels.length];
    channel.index = chartController.selectedChannels.length;
    this.newSelectedChannel = channel;

    const interval = chartController.computeTableInterval();
    let startTime = chartController.timePeriod.start.getTime();
    let endTime = chartController.timePeriod.end.getTime();

    if (chartController.datasourceMode === 'Realtime') {
      endTime = chartController.timePeriod.now.getTime();
    }

    startTime += 3600000 * 8;
    endTime += 3600000 * 8;

    chartController.addSelectedChannel(channel);
    //Save to local
    this.saveSelectedChannelToLocal(channel);

    TestAPI.getMeasurementData(channel.id,
      startTime,
      endTime,
      interval,
      2,
      (responseData) => this.getMeasurementDataHandler(channel, responseData)
    );
  }

  getMeasurementDataHandler = (channel, responseData) => {
    if (!channel || !responseData) {
      return;
    }

    const result = responseData[0];
    const { chartController } = this.props;

    DataUtil.handleMeasurementData(channel, result);
    // chartController.addSelectedChannel(channel);

    if (channel.summaryData.length === 0) {
      this.setState({
        noMeasurementData: true
      });
    }


    d3.select('.graphic-view').dispatch('changeSelectedChannels');
    // this.newSelectedChannel = null;
  };


  /**
   * Check channel is selected, If selected, set color for it
   * @param {*} channelId 
   */
  checkChannelSelected(channelId) {
    const { chartController } = this.props;
    let selected = chartController.isDisplayChannel(channelId);

    if (!selected) {
      selected = this.checkSelectedFromLocal(channelId);
    }

    return selected;
    // const selectedChannels = chartController.selectedChannels;

    // for (let i = 0; i < selectedChannels.length; i++) {
    //   const c = selectedChannels[i];
    //   if (c.id === channelId) {
    //     return true;
    //   }
    // }
    // return false;
  }


  changeLocation = (d) => {
    const sensorList = this.getSensorListByLocation(d);
    this.setState({
      anchorLocationBtn: null,
      currentLocationId: d.id,
      currentLocation: d,
      currentSensorList: sensorList
    });
  };


  getSensorListByLocation = (location) => {

    const list = [];
    this.sensorList.forEach(d => {
      if (d.locationId == location.id) {
        list.push(d);
      }
    });

    return list;
  }

  show = () => {
    d3.select(this.refs.root).attr('data-status', 'active');

  };

  hide = () => {
    d3.select(this.refs.root).attr('data-status', '');
  };

  checkSelectedFromLocal(channelId) {
    let localChannels = JSON.parse(localStorage.getItem("selectedChannels"));
    if (!localChannels || localChannels.length === 0) {
      return false;
    }

    for (let i = 0; i < localChannels.length; i++) {
      const c = localChannels[i];

      if (c && c.id === channelId) {
        return true;
      }
    }

    return false;
  }


  getcolorFromLocal(channelId) {
    let localChannels = JSON.parse(localStorage.getItem("selectedChannels"));
    if (!localChannels || localChannels.length === 0) {
      return null;
    }

    for (let i = 0; i < localChannels.length; i++) {
      const c = localChannels[i];

      if (c && c.id === channelId) {
        return c.color;
      }
    }

    return null;
  }

  saveSelectedChannelToLocal(channel) {
    let localChannels = JSON.parse(localStorage.getItem("selectedChannels"));
    if (!localChannels) {
      localChannels = [];
    }

    if (localChannels.length >= 6) {
      return;
    }

    for (let i = 0; i < localChannels.length; i++) {
      const c = localChannels[i];
      if (c && c.id && c.id === channel.id) {
        return;
      }
    }

    // Create a lightweight object to save
    const simpleChannel = {
      id: channel.id,
      color: channel.color,
      locationId: channel.locationId,
      sensorId: channel.sensorId
    };

    localChannels.push(simpleChannel);
    try {
      localStorage.setItem('selectedChannels', JSON.stringify(localChannels));
    } catch (e) {
      console.warn("LocalStorage quota exceeded, clearing selectedChannels");
      localStorage.removeItem('selectedChannels');
      // Retry once with empty array
      localStorage.setItem('selectedChannels', JSON.stringify([simpleChannel]));
    }
  }

  deleteSelectedChannelFromLocal(channel) {
    let localChannels = JSON.parse(localStorage.getItem("selectedChannels"));
    if (!localChannels) {
      return;
    }

    let index = -1;
    for (let i = 0; i < localChannels.length; i++) {
      const c = localChannels[i];
      if (c && c.id === channel.id) {
        index = i;
        break;
      }
    }

    if (index !== -1) {
      localChannels.splice(index, 1);
      localStorage.setItem('selectedChannels', JSON.stringify(localChannels));
    }
  }
}

export default ChannelList;