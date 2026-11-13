import React from 'react';
import intl from 'react-intl-universal';
import TestAPI from '../../api/TestAPI';
import './FileInfoView.css';

const formatResolution = (val, resolution) => {
  if (val === undefined || val === null || isNaN(val) || val <= -8888) {
    return '-';
  }
  const digits = typeof resolution === 'number' && resolution >= 0 && resolution <= 6 
    ? resolution 
    : 2;
  return Number(val).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

function FileInfoView() {
  const [fileInfo, setFileInfo] = React.useState(null);

  React.useEffect(() => {
    if (!TestAPI.isFileLoaded || !TestAPI.isFileLoaded()) {
      return;
    }

    const fileName = TestAPI.getLoadedFileName ? TestAPI.getLoadedFileName() : '';
    const timeRange = TestAPI.getFileTimeRange ? TestAPI.getFileTimeRange() : null;
    const isCsv = TestAPI.isCsvMode ? TestAPI.isCsvMode() : false;

    TestAPI.getChannels((res) => {
      const channels = res ? res.logging_chs || [] : [];
      setFileInfo({
        name: fileName,
        start: timeRange ? timeRange.start : null,
        stop: timeRange ? timeRange.stop : null,
        isCsv: isCsv,
        channels: channels
      });
    });
  }, []);

  if (!fileInfo) {
    return (
      <div className="file-info-empty">
        <div className="empty-message">{intl.get('FILEINFO_NO_FILE') || 'No file is currently loaded.'}</div>
      </div>
    );
  }

  const durationStr = (() => {
    if (!fileInfo.start || !fileInfo.stop) return '-';
    const diff = fileInfo.stop - fileInfo.start;
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${hrs}h ${mins}m ${secs}s`;
  })();

  return (
    <div className="file-info-view-container">
      <div className="file-info-dashboard-header">
        <h1 className="dashboard-title">{intl.get('FILEINFO_TITLE') || 'File Details & Metadata'}</h1>
        <p className="dashboard-subtitle">{intl.get('FILEINFO_SUBTITLE') || 'Overview of the loaded measurement database file'}</p>
      </div>

      <div className="dashboard-grid">
        {/* Left Column: Properties */}
        <div className="dashboard-card file-properties-card">
          <div className="card-header">
            <svg className="card-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2>{intl.get('FILEINFO_PROPERTIES') || 'File Properties'}</h2>
          </div>
          <div className="card-content">
            <div className="property-item">
              <span className="property-label">{intl.get('FILE_NAME') || 'File Name'}</span>
              <span className="property-value filename-highlight">{fileInfo.name}</span>
            </div>
            <div className="property-item">
              <span className="property-label">{intl.get('FILEINFO_FORMAT_TYPE') || 'Format Type'}</span>
              <span className="property-value">
                <span className={`format-tag ${fileInfo.isCsv ? 'tag-csv' : 'tag-csd'}`}>
                  {fileInfo.isCsv ? (intl.get('FILEINFO_FORMAT_CSV') || 'CSV Text') : (intl.get('FILEINFO_FORMAT_CSD') || 'CSD Binary')}
                </span>
              </span>
            </div>
            {fileInfo.start && (
              <div className="property-item">
                <span className="property-label">{intl.get('FILEINFO_START_DATETIME') || 'Start Date/Time'}</span>
                <span className="property-value">{new Date(fileInfo.start).toLocaleString()}</span>
              </div>
            )}
            {fileInfo.stop && (
              <div className="property-item">
                <span className="property-label">{intl.get('FILEINFO_END_DATETIME') || 'End Date/Time'}</span>
                <span className="property-value">{new Date(fileInfo.stop).toLocaleString()}</span>
              </div>
            )}
            {fileInfo.start && fileInfo.stop && (
              <div className="property-item">
                <span className="property-label">{intl.get('FILEINFO_TOTAL_DURATION') || 'Total Duration'}</span>
                <span className="property-value duration-highlight">{durationStr}</span>
              </div>
            )}
            <div className="property-item">
              <span className="property-label">{intl.get('FILEINFO_TOTAL_CHANNELS') || 'Total Channels'}</span>
              <span className="property-value">{intl.get('FILEINFO_CHANNELS_VALUE', { count: fileInfo.channels ? fileInfo.channels.length : 0 }) || `${fileInfo.channels ? fileInfo.channels.length : 0} Channels`}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Channels */}
        <div className="dashboard-card channels-info-card">
          <div className="card-header">
            <svg className="card-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <h2>{intl.get('FILEINFO_CHANNELS_SENSORS') || 'Channels & Sensors'}</h2>
          </div>
          <div className="card-content">
            <div className="channels-table-scroll-wrapper">
              <table className="channels-dashboard-table">
                <thead>
                  <tr>
                    <th>{intl.get('FILEINFO_TH_INDEX') || 'Index'}</th>
                    <th>{intl.get('FILEINFO_TH_NAME_DESC') || 'Name / Description'}</th>
                    <th>{intl.get('FILEINFO_TH_SENSOR_MODEL') || 'Sensor Model'}</th>
                    <th>{intl.get('FILEINFO_TH_UNIT') || 'Unit'}</th>
                    <th>{intl.get('FILEINFO_TH_RESOLUTION') || 'Resolution'}</th>
                    {!fileInfo.isCsv && <th>{intl.get('FILEINFO_TH_MIN_MAX') || 'Min ~ Max'}</th>}
                  </tr>
                </thead>
                <tbody>
                  {fileInfo.channels && fileInfo.channels.map((ch, idx) => {
                    const minVal = formatResolution(ch.min !== undefined ? ch.min : ch._min, ch.resolution);
                    const maxVal = formatResolution(ch.max !== undefined ? ch.max : ch._max, ch.resolution);
                    const rangeDisplay = (minVal === '-' && maxVal === '-') ? '-' : `${minVal}~${maxVal}`;
                    return (
                      <tr key={idx}>
                        <td className="col-index">#{idx + 1}</td>
                        <td className="col-desc">{ch.full_channel_name || ch.logic_channel_description || `Channel ${ch.channel_id}`}</td>
                        <td className="col-sensor">{ch.sensor_description || '-'}</td>
                        <td className="col-unit">
                          <span className="unit-badge-tag">{ch.unit_in_ascii || '-'}</span>
                        </td>
                        <td className="col-res">{ch.resolution !== undefined ? ch.resolution : '-'}</td>
                        {!fileInfo.isCsv && (
                          <td className="col-stat">
                            <span className="stat-range-tag">
                              {rangeDisplay}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileInfoView;
