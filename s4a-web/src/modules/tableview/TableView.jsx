import React, { useState, useEffect } from 'react';
import TestAPI from '../../api/TestAPI';
import Checkbox from '@mui/material/Checkbox';
import './TableView.css';

const formatTimestamp = (ms) => {
  if (!ms || isNaN(ms)) return '';
  const date = new Date(ms);
  const pad = (num, size = 2) => String(num).padStart(size, '0');
  
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
};

const formatShortTime = (ms) => {
  if (!ms || isNaN(ms)) return '';
  const date = new Date(ms);
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const TableView = () => {
  const [channels, setChannels] = useState([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Time navigation state
  const [startTimeMs, setStartTimeMs] = useState(0);
  const [stopTimeMs, setStopTimeMs] = useState(0);
  const [sampleRate, setSampleRate] = useState(1);
  const [draggingVal, setDraggingVal] = useState(null);
  
  const [pageInputVal, setPageInputVal] = useState('1');

  // Load channels once on mount
  useEffect(() => {
    TestAPI.getChannels((res) => {
      if (res && res.logging_chs) {
        setChannels(res.logging_chs);
        // Default: show all channels
        setSelectedChannelIds(res.logging_chs.map(c => c.channel_id));
      }
    });

    const range = TestAPI.getFileTimeRange ? TestAPI.getFileTimeRange() : null;
    if (range) {
      setStartTimeMs(range.start);
      setStopTimeMs(range.stop);
    }
  }, []);

  // Fetch page data whenever index, size, or selected columns change
  useEffect(() => {
    if (!TestAPI.getTablePage) return;
    
    setLoading(true);
    TestAPI.getTablePage(pageIndex, pageSize, selectedChannelIds, (result) => {
      setLoading(false);
      if (result) {
        setRows(result.rows || []);
        setTotalRows(result.total || 0);
        if (result.startTimeMs) setStartTimeMs(result.startTimeMs);
        if (result.stopTimeMs) setStopTimeMs(result.stopTimeMs);
        if (result.sampleRate) setSampleRate(result.sampleRate);
        
        // Sync page input field
        setPageInputVal(String(pageIndex + 1));
      }
    });
  }, [pageIndex, pageSize, selectedChannelIds]);

  const totalPages = Math.ceil(totalRows / pageSize) || 1;

  // Handle pagination clicks
  const handleFirstPage = () => setPageIndex(0);
  const handlePrevPage = () => setPageIndex(prev => Math.max(0, prev - 1));
  const handleNextPage = () => setPageIndex(prev => Math.min(totalPages - 1, prev + 1));
  const handleLastPage = () => setPageIndex(totalPages - 1);

  const handlePageInputChange = (e) => {
    setPageInputVal(e.target.value);
  };

  const handlePageInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      const pageNum = parseInt(pageInputVal, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        setPageIndex(pageNum - 1);
      } else {
        // Reset to current page index
        setPageInputVal(String(pageIndex + 1));
      }
    }
  };

  const handlePageSizeChange = (e) => {
    const newSize = parseInt(e.target.value, 10);
    setPageSize(newSize);
    setPageIndex(0); // Reset to first page
  };

  // Slider controls
  const handleSliderChange = (e) => {
    setDraggingVal(parseInt(e.target.value, 10));
  };

  const handleSliderRelease = () => {
    if (draggingVal !== null) {
      setPageIndex(draggingVal);
      setDraggingVal(null);
    }
  };

  // Column checkbox helpers
  const handleChannelCheckboxChange = (chId) => {
    setSelectedChannelIds(prev => {
      if (prev.includes(chId)) {
        return prev.filter(id => id !== chId);
      } else {
        return [...prev, chId].sort((a, b) => a - b);
      }
    });
  };

  const handleGroupCheckboxChange = (groupChannels, isChecked) => {
    const idsToModify = groupChannels.map(c => c.channel_id);
    setSelectedChannelIds(prev => {
      if (isChecked) {
        const next = [...prev];
        idsToModify.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next.sort((a, b) => a - b);
      } else {
        return prev.filter(id => !idsToModify.includes(id));
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedChannelIds(channels.map(c => c.channel_id));
  };

  const handleClearAll = () => {
    setSelectedChannelIds([]);
  };

  // Search filtered channels
  const filteredChannels = channels.filter(c => 
    (c.logic_channel_description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.sensor_description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    `channel ${c.channel_id}`.includes(searchQuery.toLowerCase())
  );

  // Group filtered channels by sensor_description
  const groups = {};
  filteredChannels.forEach(ch => {
    const groupName = ch.sensor_description || 'Other Sensors';
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(ch);
  });

  // Compute slider active page and its starting timestamp
  const activeSliderVal = draggingVal !== null ? draggingVal : pageIndex;
  const previewTimestampMs = startTimeMs + ((activeSliderVal * pageSize) / sampleRate) * 1000;

  return (
    <div className="table-view-container">
      {/* Left Sidebar - Columns Selection */}
      <aside className="table-sidebar">
        <div className="table-sidebar-header">
          <span>Columns ({selectedChannelIds.length}/{channels.length})</span>
        </div>
        
        <input
          type="text"
          className="sidebar-search-box"
          placeholder="Search channels..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        
        <div className="sidebar-actions">
          <button className="sidebar-btn" onClick={handleSelectAll}>Select All</button>
          <button className="sidebar-btn" onClick={handleClearAll}>Clear All</button>
        </div>

        <div className="channels-list-scroll">
          {Object.keys(groups).map(groupName => {
            const groupChannels = groups[groupName];
            const groupChannelIds = groupChannels.map(c => c.channel_id);
            const selectedInGroup = groupChannelIds.filter(id => selectedChannelIds.includes(id));
            
            const isAllSelected = selectedInGroup.length === groupChannelIds.length;
            const isSomeSelected = selectedInGroup.length > 0 && selectedInGroup.length < groupChannelIds.length;

            return (
              <div key={groupName} className="sensor-group-container">
                <div className="sensor-group-header">
                  <Checkbox
                    size="small"
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onChange={(e) => handleGroupCheckboxChange(groupChannels, e.target.checked)}
                    sx={{
                      padding: '4px',
                      color: '#cbd5e1',
                      '&.Mui-checked': { color: '#00ac86' },
                      '&.MuiCheckbox-indeterminate': { color: '#00ac86' }
                    }}
                  />
                  <span className="sensor-group-title">{groupName}</span>
                </div>
                <div className="sensor-group-channels">
                  {groupChannels.map(ch => {
                    const isChecked = selectedChannelIds.includes(ch.channel_id);
                    return (
                      <label key={ch.channel_id} className="channel-checkbox-item">
                        <div className="channel-checkbox-left">
                          <Checkbox
                            size="small"
                            checked={isChecked}
                            onChange={() => handleChannelCheckboxChange(ch.channel_id)}
                            sx={{
                              padding: '4px',
                              color: '#cbd5e1',
                              '&.Mui-checked': { color: '#00ac86' }
                            }}
                          />
                          <span className="channel-item-name">
                            {ch.logic_channel_description || `Channel ${ch.channel_id}`}
                          </span>
                        </div>
                        {ch.unit_in_ascii && (
                          <span className="channel-item-unit">{ch.unit_in_ascii}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {Object.keys(groups).length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
              No channels found
            </div>
          )}
        </div>
      </aside>

      {/* Right main panel */}
      <section className="table-main-content">
        {/* Toolbar Controls */}
        <div className="table-toolbar">
          {/* Left Side: Timeline Slider with bounds on top */}
          <div className="time-slider-section">
            <div className="time-slider-bounds-row">
              <span>{formatTimestamp(startTimeMs)}</span>
              <span>{formatTimestamp(stopTimeMs)}</span>
            </div>
            <div className="time-slider-container">
              <input
                type="range"
                className="time-slider"
                min={0}
                max={Math.max(0, totalPages - 1)}
                value={activeSliderVal}
                onChange={handleSliderChange}
                onMouseUp={handleSliderRelease}
                onTouchEnd={handleSliderRelease}
              />
              <div className="time-slider-preview">
                Preview: {formatTimestamp(previewTimestampMs)}
              </div>
            </div>
          </div>

          {/* Right Side: Pagination Controls */}
          <div className="pagination-wrapper">
            <div className="pagination-controls-flat">
              <button
                className="page-btn"
                onClick={handleFirstPage}
                disabled={pageIndex === 0 || loading}
                title="First Page"
              >
                &lt;&lt;
              </button>
              <button
                className="page-btn"
                onClick={handlePrevPage}
                disabled={pageIndex === 0 || loading}
                title="Previous Page"
              >
                &lt;
              </button>
              
              <div className="page-indicator-combined">
                <input
                  type="text"
                  className="page-input-flat"
                  value={pageInputVal}
                  onChange={handlePageInputChange}
                  onKeyDown={handlePageInputKeyDown}
                  disabled={loading}
                />
                <span className="page-total-slash">/ {totalPages}</span>
              </div>

              <button
                className="page-btn"
                onClick={handleNextPage}
                disabled={pageIndex >= totalPages - 1 || loading}
                title="Next Page"
              >
                &gt;
              </button>
              <button
                className="page-btn"
                onClick={handleLastPage}
                disabled={pageIndex >= totalPages - 1 || loading}
                title="Last Page"
              >
                &gt;&gt;
              </button>

              <select
                className="pagesize-select-flat"
                value={pageSize}
                onChange={handlePageSizeChange}
                disabled={loading}
              >
                <option value={15}>15</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Grid Table wrapper */}
        <div className="table-grid-wrapper">
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
            </div>
          )}

          {rows.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  {channels
                    .filter(c => selectedChannelIds.includes(c.channel_id))
                    .map(c => (
                      <th key={c.channel_id}>
                        {c.logic_channel_description || `Channel ${c.channel_id}`}
                        {c.unit_in_ascii ? ` (${c.unit_in_ascii})` : ''}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.index}>
                    <td>{formatTimestamp(row.timestampMs)}</td>
                    {channels
                      .filter(c => selectedChannelIds.includes(c.channel_id))
                      .map(c => {
                        const val = row.values[c.channel_id];
                        return (
                          <td key={c.channel_id}>
                            {val !== null && val !== undefined ? (
                              typeof val === 'number' ? val.toFixed(c.resolution !== undefined ? c.resolution : 4) : val
                            ) : (
                              <span className="invalid-cell-value">--</span>
                            )}
                          </td>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-table-state">
              <svg className="empty-table-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3>No Columns or Data Selected</h3>
              <p>Please select at least one channel from the columns panel on the left to display its measurements.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default TableView;
