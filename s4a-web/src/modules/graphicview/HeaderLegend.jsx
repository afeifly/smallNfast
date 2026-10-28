import React, { Component } from 'react';
import * as d3 from 'd3';
import { SystemEvent } from '../../util/SystemConstant';
import TestAPI from '../../api/TestAPI';
import './css/HeaderLegend.css';

class HeaderLegend extends Component {
  constructor(props) {
    super(props);
    this.scrollRef = React.createRef();
    this.state = {
      channels: (props.chartController && props.chartController.selectedChannels) || [],
      isDragging: false,
    };

    // Drag-to-scroll tracking
    this.isPointerDown = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.hasMoved = false;
  }

  componentDidMount() {
    this._isMounted = true;

    if (TestAPI.onFileLoaded) {
      this.fileLoadedUnsubscribe = TestAPI.onFileLoaded(() => {
        if (!this._isMounted) return;
        const channels = this.props.chartController?.selectedChannels || [];
        this.setState({ channels: [...channels] });
      });
    }

    // Listen to channel and color changes via D3 events
    d3.select('.graphic-view').on(SystemEvent.CHANGE_SELECTED_CHANNELS + '.headerLegend', () => {
      if (!this._isMounted) return;
      const channels = this.props.chartController?.selectedChannels || [];
      this.setState({ channels: [...channels] });
    });

    d3.select('#line-chart').on(SystemEvent.UPDATE_CHANNEL_COLOR + '.headerLegend', () => {
      if (!this._isMounted) return;
      this.forceUpdate();
    });
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (this.fileLoadedUnsubscribe) {
      this.fileLoadedUnsubscribe();
    }
    d3.select('.graphic-view').on(SystemEvent.CHANGE_SELECTED_CHANNELS + '.headerLegend', null);
    d3.select('#line-chart').on(SystemEvent.UPDATE_CHANNEL_COLOR + '.headerLegend', null);
  }

  updateChannels = (channels) => {
    if (!this._isMounted) return;
    this.setState({ channels: channels ? [...channels] : [] });
  };

  handleMouseDown = (e) => {
    const container = this.scrollRef.current;
    if (!container) return;
    this.isPointerDown = true;
    this.startX = e.pageX;
    this.scrollLeft = container.scrollLeft;
    this.hasMoved = false;
  };

  handleMouseMove = (e) => {
    if (!this.isPointerDown) return;
    const container = this.scrollRef.current;
    if (!container) return;
    const distance = e.pageX - this.startX;

    if (Math.abs(distance) > 4) {
      this.hasMoved = true;
      if (!this.state.isDragging) {
        this.setState({ isDragging: true });
      }
    }

    container.scrollLeft = this.scrollLeft - distance;
  };

  handleMouseUp = () => {
    this.isPointerDown = false;
    if (this.state.isDragging) {
      // Delay resetting isDragging slightly so click handler knows a drag occurred
      setTimeout(() => {
        if (this._isMounted) {
          this.setState({ isDragging: false });
        }
      }, 50);
    }
  };

  handleTouchStart = (e) => {
    const container = this.scrollRef.current;
    if (!container || !e.touches || e.touches.length === 0) return;
    this.isPointerDown = true;
    this.startX = e.touches[0].pageX;
    this.scrollLeft = container.scrollLeft;
    this.hasMoved = false;
  };

  handleTouchMove = (e) => {
    if (!this.isPointerDown || !e.touches || e.touches.length === 0) return;
    const distance = e.touches[0].pageX - this.startX;
    if (Math.abs(distance) > 5) {
      this.hasMoved = true;
    }
  };

  handleTouchEnd = () => {
    this.isPointerDown = false;
  };

  handleItemClick = (e, channel) => {
    if (this.hasMoved || this.state.isDragging) {
      // User dragged or scrolled the header legend, suppress dialog popup
      return;
    }
    d3.select('.graphic-view').dispatch(SystemEvent.SHOW_CHANNEL_SETTING, {
      detail: channel
    });
  };

  render() {
    const { channels, isDragging } = this.state;
    if (!channels || channels.length === 0) {
      return <div className="header-legend-wrapper" />;
    }

    return (
      <div className="header-legend-wrapper">
        <div 
          className={`header-legend-scroll ${isDragging ? 'is-dragging' : ''}`}
          ref={this.scrollRef}
          onMouseDown={this.handleMouseDown}
          onMouseMove={this.handleMouseMove}
          onMouseUp={this.handleMouseUp}
          onMouseLeave={this.handleMouseUp}
          onTouchStart={this.handleTouchStart}
          onTouchMove={this.handleTouchMove}
          onTouchEnd={this.handleTouchEnd}
        >
          {channels.map((channel, idx) => {
            const isVisible = channel.visible !== false;
            const color = isVisible ? (channel.color || '#00ac86') : '#94a3b8';
            const title = channel.fullName
              || (channel.sensorDescription && channel.name ? `${channel.sensorDescription} - ${channel.name}` : '')
              || channel.name
              || channel.sensorDescription
              || (channel.id ? `Channel ${channel.id}` : '');
            const unit = channel.unit || channel.unit_in_ascii || '';
            const unitText = unit && !title.includes(unit) ? ` (${unit})` : '';

            return (
              <div 
                key={channel.id != null ? channel.id : idx}
                className={`header-legend-item ${isVisible ? 'active' : 'inactive'}`}
                onClick={(e) => this.handleItemClick(e, channel)}
                title={`${title}${unitText}`}
              >
                <span className="header-legend-symbol">
                  <span className="header-legend-line" style={{ backgroundColor: color }} />
                  <span className="header-legend-dot" style={{ borderColor: color }} />
                </span>
                <span className="header-legend-text">
                  {title}{unitText}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

export default HeaderLegend;
