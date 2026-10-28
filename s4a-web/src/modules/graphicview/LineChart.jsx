import React, { Component } from 'react';
import * as d3 from 'd3';
import $ from 'jquery';
import intl from "react-intl-universal";
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation';
import AxisSeries from './AxisSeries';
import SplineGroup from './SplineGroup';
import LegendSvgGroup from './LegendSvgGroup';
import { saveSvgAsPng, svgAsPngUri } from 'save-svg-as-png';
import TauriSutoAPI from '../../api/TauriSutoAPI';
import html2canvas from 'html2canvas';
import { SystemEvent } from '../../util/SystemConstant';
import TimePeriod from './TimePeriod'
import TestAPI from '../../api/TestAPI';

import { isSmallLandscapeMode } from './screenUtil';
import './css/LineChart.css'; 

let self;
let yAxisData = [];

class LineChart extends Component {
  constructor() {
    super();  
    self = this; 
    this.rootRef = React.createRef();
    this.AxisSeriesRef = React.createRef();
    this.LegendGroupRef = React.createRef();
    this.SplineGroupRef = React.createRef();
    this.TimePeriodRef = React.createRef();
    this.state = {
      dataType: 'Realtime',
      denoisingChecked: true,
      fileLoaded: false,
    };
  }

  render() {
    const { chartController } = this.props;
    const isLoaded = this.state.fileLoaded || (TestAPI.isFileLoaded && TestAPI.isFileLoaded());
    const placeholderText = isLoaded ? 'No channel selected' : 'Open a file to show data';

    return(
      <div id="line-chart" ref={this.rootRef}>
        <svg id="line-chart-container"  width={'100%'} height={'100%'}>
          <AxisSeries ref={this.AxisSeriesRef} chartController={ chartController }/>;
          <LegendSvgGroup ref={this.LegendGroupRef} chartController={ chartController} />
          <SplineGroup ref={this.SplineGroupRef} hideTimePeriod={ this.hideTimePeriod } chartController={ chartController }/>;
        </svg>
        <TimePeriod ref={this.TimePeriodRef} chartController={ chartController }/>
        <div className="chart-placeholder">
          <div className="no-data-tip">{ placeholderText }</div>
        </div>

        <div className="landscape-prompt">
          <div className="landscape-icon-wrapper">
            <ScreenRotationIcon className="landscape-rotate-icon" />
          </div>
          <h3 className="landscape-prompt-title">
            {intl.get('LANDSCAPE_RECOMMENDED_TITLE') || 'Landscape Mode Recommended'}
          </h3>
          <p className="landscape-prompt-desc">
            {intl.get('LANDSCAPE_RECOMMENDED_DESC') || 'Please rotate your screen to landscape orientation for the best curve viewing experience.'}
          </p>
        </div>
      </div>
    );
  }

  componentDidMount() {
    const { chartController } = this.props;

    if (TestAPI.onFileLoaded) {
      this.fileLoadedUnsubscribe = TestAPI.onFileLoaded(() => {
        this.setState({ fileLoaded: true });
      });
    }

    this._isMounted = true;
    this.resizeTimeouts = [];

    // Mobile & WebView orientation settling handler
    this.handleOrientationOrResize = () => {
      if (this.resizeTimeouts) {
        this.resizeTimeouts.forEach(clearTimeout);
      }
      this.resizeTimeouts = [];

      const executeUpdate = () => {
        if (!this._isMounted) return;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('resize'));
        }
        if (this.rootRef.current) {
          const width = $(this.rootRef.current).width();
          if (width > 0) {
            this.updateHeight();
            this.setWidth(width);
          }
        }
      };

      // Execute in staggered passes so Android/iOS animation settling frames are caught
      [50, 200, 400, 600].forEach(delay => {
        const tid = setTimeout(executeUpdate, delay);
        this.resizeTimeouts.push(tid);
      });
    };

    if (typeof window !== 'undefined') {
      if (window.matchMedia) {
        this.orientationMediaQuery = window.matchMedia('(orientation: portrait)');
        if (this.orientationMediaQuery.addEventListener) {
          this.orientationMediaQuery.addEventListener('change', this.handleOrientationOrResize);
        } else if (this.orientationMediaQuery.addListener) {
          this.orientationMediaQuery.addListener(this.handleOrientationOrResize);
        }
      }
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.addEventListener('change', this.handleOrientationOrResize);
      }
      window.addEventListener('orientationchange', this.handleOrientationOrResize);
    }

    if (typeof ResizeObserver !== 'undefined' && this.rootRef.current) {
      let lastW = 0;
      let lastH = 0;
      this.resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0 && (Math.abs(width - lastW) > 2 || Math.abs(height - lastH) > 2)) {
            lastW = width;
            lastH = height;
            this.updateHeight();
            this.setWidth(width);
          }
        }
      });
      this.resizeObserver.observe(this.rootRef.current);
    }

    const rawHeight = $('#line-chart').height() || 0;
    const bottomPadding = isSmallLandscapeMode() ? 65 : 134;
    const chartHeight = Math.max(50, rawHeight - bottomPadding);
    chartController.setChartHeight(chartHeight);

    // d3.select('.graphic-view').on('changeSelectedChannels', this.changeSelectedChannelsHandler);

    d3.select('#line-chart').on('updatePosition', (event) => {
      const x = event.detail.x;
      chartController.setChartX(x);
      self.forceUpdate();
      self.positionLegend();
    })
    .on('changeTimePeriod', () => {
      this.AxisSeriesRef.current.updateXAxis();
      this.SplineGroupRef.current.refreshData();
    })
    .on(SystemEvent.UPDATE_CHANNEL_COLOR, (event) => {
      const detail = event.detail;
      this.SplineGroupRef.current.updateLineColor(detail.channelId, detail.color);
      this.LegendGroupRef.current.updateColor();
    })
    .on(SystemEvent.UPDATE_YAXIS_AND_SPLINES, () => {
      this.AxisSeriesRef.current.updateDisplay();
      this.SplineGroupRef.current.updateDisplay();
    })
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (this.resizeTimeouts) {
      this.resizeTimeouts.forEach(clearTimeout);
      this.resizeTimeouts = [];
    }
    if (this.setWidthTimeout) {
      clearTimeout(this.setWidthTimeout);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.orientationMediaQuery) {
      if (this.orientationMediaQuery.removeEventListener) {
        this.orientationMediaQuery.removeEventListener('change', this.handleOrientationOrResize);
      } else if (this.orientationMediaQuery.removeListener) {
        this.orientationMediaQuery.removeListener(this.handleOrientationOrResize);
      }
    }
    if (typeof window !== 'undefined') {
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', this.handleOrientationOrResize);
      }
      window.removeEventListener('orientationchange', this.handleOrientationOrResize);
    }
    if (this.fileLoadedUnsubscribe) {
      this.fileLoadedUnsubscribe();
    }
  }


  updateYAxis = () => {
    if (this.AxisSeriesRef.current) {
      this.AxisSeriesRef.current.updateYAxis();
    }
  }

  /**
   * Live-recording redraw: re-render the axes and every spline from the
   * channel.summaryData that the LiveGraphicView maintains directly.
   * Unlike the 'changeTimePeriod' event this never refetches via TestAPI.
   */
  redrawLive = () => {
    if (this.AxisSeriesRef.current) {
      this.AxisSeriesRef.current.updateXAxis();
      this.AxisSeriesRef.current.updateYAxis();
    }
    if (this.SplineGroupRef.current) {
      this.SplineGroupRef.current.updateDisplay();
    }
  }


  setWidth = (w) => {
    $('#line-chart').width(w);
    
    if (this.setWidthTimeout) clearTimeout(this.setWidthTimeout);
    this.setWidthTimeout = setTimeout(() => {
      if (!this._isMounted) return;
      if (this.AxisSeriesRef.current) {
        this.AxisSeriesRef.current.updateDisplay();
      }
      if (this.SplineGroupRef.current) {
        this.SplineGroupRef.current.updateDisplay();
      }
      this.positionLegend();
    }, 50);
  };

  updateHeight = () => {
    if (!this._isMounted) return;
    const { chartController } = this.props;
    const rawHeight = $('#line-chart').height() || 0;
    const bottomPadding = isSmallLandscapeMode() ? 65 : 134;
    const chartHeight = Math.max(50, rawHeight - bottomPadding);

    // 1. Update all selected channels in chartController & yAxisData
    const channels = chartController.selectedChannels || yAxisData || [];
    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      if (channel && channel.scale) {
        channel.scale.rangeRound([chartHeight, 0]);
      }
    }

    // 2. Also update all Y-axis data objects in chartController.yAxisDataset
    if (chartController.yAxisDataset) {
      for (let i = 0; i < chartController.yAxisDataset.length; i++) {
        const d = chartController.yAxisDataset[i];
        if (d && d.scale) {
          d.scale.rangeRound([chartHeight, 0]);
        }
      }
    }

    // 3. Update majorYAxisData directly in AxisSeriesRef
    if (this.AxisSeriesRef.current && this.AxisSeriesRef.current.majorYAxisData?.scale) {
      this.AxisSeriesRef.current.majorYAxisData.scale.rangeRound([chartHeight, 0]);
    }

    chartController.setChartHeight(chartHeight);

    if (this.AxisSeriesRef.current) {
      this.AxisSeriesRef.current.updateYAxis();
      this.AxisSeriesRef.current.updateXAxis();
      this.AxisSeriesRef.current.updateLineGrid(false);
    }
    if (this.SplineGroupRef.current) {
      this.SplineGroupRef.current.updateDisplay();
    }
    this.positionLegend();
  };

  setX(x) {
    const { chartController } = this.props;
    $('#line-chart').css({left: x});

    if (x === 0) {
      chartController.channelVisible = false;
    }else {
      chartController.channelVisible = true;
    }

    const visible = chartController.channelVisible ? 'hidden' : 'visible';
    d3.select('.channelBtn').style('visibility', visible);
  }

  
  changeSelectedChannelsHandler = () => {
    const { chartController } = this.props;
    const selectedChannels = chartController.selectedChannels;
    
    yAxisData = selectedChannels;
    self.AxisSeriesRef.current.setYDataset(selectedChannels);
    self.SplineGroupRef.current.setData(selectedChannels);
    self.LegendGroupRef.current.setData(selectedChannels);
    self.SplineGroupRef.current.updateDisplay();

    // Defer positionLegend so it runs after LegendSvgGroup.forceUpdate() has
    // re-rendered the legend items and their getBBox() returns correct sizes.
    setTimeout(() => {
      if (self.LegendGroupRef.current) {
        self.positionLegend();
      }
    }, 50);

    d3.select('.chart-placeholder').attr('data-status', '');

    if (selectedChannels && selectedChannels.length > 0) {
      d3.select('.chart-placeholder').attr('data-status', '');
    } else {
      d3.select('.chart-placeholder').attr('data-status', 'active');
    }

    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA_COMPLETED);
  }


  positionLegend = () => {
    if (!this._isMounted || !this.LegendGroupRef.current) return;
    if (isSmallLandscapeMode()) {
      d3.select('#legend-group').style('display', 'none');
      return;
    }
    d3.select('#legend-group').style('display', null);

    const panelHeight = $('#line-chart').height() || 0;
    const panelWidth = $('#line-chart').width() || 0;

    // Layout legend items in rows, wrapping when they would exceed panel width.
    // Each item is placed with a fixed 15px left-gap from the previous item's
    // right edge. When a row overflows, start a new row at y=35.
    let rowX = 0;         // running x within the current row
    let row = 0;          // 0 = first row, 1 = second row
    let maxRowX = 0;      // widest row (used to centre the legend box)
    const GAP = 15;

    d3.selectAll('.legend-item').each(function() {
      const bbox = this.getBBox ? this.getBBox() : { width: 0 };
      const itemW = bbox.width;
      if (row === 0 && rowX > 0 && rowX + GAP + itemW > panelWidth - 30) {
        // Wrap to second row
        maxRowX = rowX;
        row = 1;
        rowX = 0;
      }
      const y = row === 0 ? 15 : 35;
      d3.select(this).attr('transform', `translate(${GAP + rowX}, ${y})`);
      rowX += itemW + GAP;
    });

    if (row === 0) maxRowX = rowX;
    const legendW = Math.max(maxRowX, rowX) + GAP;
    const legendH = row > 0 ? 50 : 30;
    const x = Math.max(0, Math.floor((panelWidth - legendW) / 2));

    if (this.LegendGroupRef.current) {
      this.LegendGroupRef.current.setWidth(legendW);
      this.LegendGroupRef.current.setHeight(legendH);
      this.LegendGroupRef.current.setPosition({ x, y: panelHeight - 60 });
    }
  }

  updateDenoisingSetting = () => {
    if (this.SplineGroupRef.current) {
      this.SplineGroupRef.current.updateDisplay();
    }
  };


  showChannelList() {
    d3.select('.graphic-view').dispatch(SystemEvent.SHOW_CHANNEL_LIST);
  }

  resetTimePeriod = () => {
    const { chartController } = this.props;

    // Live-recording history browsing: "reset" means the whole session —
    // handled by the live view (no file-mode TestAPI reload).
    if (chartController.datasourceMode === 'RecordingHistory') {
      d3.select('#line-chart').dispatch('liveHistoryReset');
      return;
    }

    // In CSD mode the historyTimeRange was set to the file's actual time range.
    // openHistoryMode() restores timePeriod from historyTimeRange and resets
    // the zoom history, then dispatches changeTimePeriod to redraw the X axis.
    chartController.openHistoryMode();

    d3.select('.graphic-view').dispatch(SystemEvent.LOADING_DATA);
  }


  showOrHideTimePeriod = () => {
    const { chartController } = this.props;
    chartController.timePeriodVisible = !chartController.timePeriodVisible; 
    
    if(chartController.timePeriodVisible) {
      this.TimePeriodRef.current.show();
    }else {
      this.TimePeriodRef.current.hide();
    }
  };

  hideTimePeriod = () => {
    const { chartController } = this.props;
    chartController.timePeriodVisible = false; 
    this.TimePeriodRef.current.hide();
  };


  printChart() {
    var svg = document.getElementById("line-chart-container")

    // Desktop app: the webview has no download handling — render the PNG and
    // push it through the native save dialog instead.
    if (TauriSutoAPI.isAvailable && TauriSutoAPI.isAvailable()) {
      try {
        svgAsPngUri(svg, {
          backgroundColor: '#ffffff',
          scale: 2
        }, async (dataUri) => {
          try {
            if (!dataUri || !dataUri.startsWith('data:image/png')) {
              throw new Error('PNG rendering returned no image data');
            }
            const b64 = dataUri.split(',')[1];
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const d = new Date();
            const p = (n) => String(n).padStart(2, '0');
            const name = `S4A_Chart_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
            const savedPath = await TauriSutoAPI.saveBinaryFile(name, bytes);
            if (savedPath) {
              TauriSutoAPI.logClientEvent('INFO', 'EXPORT', `Chart exported to PNG: ${savedPath}`);
            }
          } catch (err) {
            console.error('[LineChart] Chart export failed:', err);
            TauriSutoAPI.logClientEvent('ERROR', 'EXPORT', `Chart export failed: ${err && err.message ? err.message : err}`);
            alert(`Chart export failed: ${err && err.message ? err.message : err}`);
          }
        });
      } catch (err) {
        console.error('[LineChart] Chart export failed:', err);
        alert(`Chart export failed: ${err && err.message ? err.message : err}`);
      }
      return;
    }

    // Browser: stock download
    saveSvgAsPng(svg,"tmp.png", {
      backgroundColor: '#ffffff',
      scale: 2
    });
  }

  
  printdiv() {
    html2canvas(document.getElementById('line-chart')).then(function(canvas) {
      document.getElementById('export-image-container')
      $('#export-image-container').append(canvas)
        .attr('data-status', 'active');
    });
  }

  updateViewForRealtimeMode = () => {
    this.hideTimePeriod();
  };

  setNoLoggingChannels = (bool) => {
    if(bool) {
      d3.select('.chart-placeholder').attr('data-status', 'active');
    }else {
      d3.select('.chart-placeholder').attr('data-status', '');
    }
  }
}

// Memoized: the only prop is the stable chartController instance. Without
// this, every parent re-render (e.g. the live view's 1 s elapsed tick)
// cascades into a full d3 redraw pass of the axes and every spline.
export default React.memo(LineChart);