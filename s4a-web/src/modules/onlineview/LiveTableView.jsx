import React, { useState, useEffect, useRef, useMemo } from 'react';
import intl from 'react-intl-universal';
import * as liveRecorder from '../../util/liveRecorder';
import { getLiveSelection, subscribeLiveSelection } from '../../util/liveSelection';
import { getOnlineCache } from './OnlineView';
import { formatChannelValue } from '../../util/resolution';
import { isChannelInAlarm, isChannelValueInAlarm } from '../processscape/engine/alarmEngine';
import { getLocations } from '../processscape/engine/sensorManagerStorage';
import './LiveView.css';

// useMemo retained for visibleRows below.

/** Hard cap on rendered DOM rows (session data itself is never truncated). */
const MAX_RENDER = 10000;
/** Rows rendered initially and added per reverse-scroll chunk. */
const INITIAL_RENDER = 200;
const CHUNK_RENDER = 400;
/** scrollTop within this many pixels counts as "back at the top". */
const TOP_THRESHOLD = 4;

const formatTs = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

// SUTO invalid sentinels — exactly these two values, nothing broader
const isInvalidValue = (v) => typeof v === 'number' && (v === -8888 || v === -9999);

/**
 * Live recording table.
 *
 * Follow mode (scrolled to top): every new sample is prepended immediately.
 * Paused mode (scrolled away): the displayed rows freeze in place so the
 * reading position never jumps; new samples only bump the "new rows" pill,
 * and following resumes on click / scrolling back to the top.
 *
 * Data is unlimited: the full session buffer stays in memory, the DOM only
 * renders the newest `renderLimit` rows and grows in chunks while the user
 * scrolls towards older data (reverse infinite scroll).
 */
export default function LiveTableView() {
  const scrollRef = useRef(null);

  // Frozen copy of the session rows currently displayed. Only refreshed in
  // follow mode — session.rows mutates in place, so a copy is required to
  // freeze. Copying a few thousand small objects once per sample is cheap.
  const [displayRows, setDisplayRows] = useState(() => [...liveRecorder.getSessionSnapshot().rows]);
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER);
  const [following, setFollowing] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  // Columns follow the Graphic View's channel selection (shared store).
  const [selectedIds, setSelectedIds] = useState(() => getLiveSelection());

  const followingRef = useRef(true);
  const displayCountRef = useRef(displayRows.length);

  useEffect(() => subscribeLiveSelection((ids) => setSelectedIds([...ids])), []);

  useEffect(() => {
    return liveRecorder.subscribe((snap, event) => {
      const rows = liveRecorder.getSessionSnapshot().rows;
      if (event === 'cleared') {
        followingRef.current = true;
        displayCountRef.current = 0;
        setDisplayRows([]);
        setPendingCount(0);
        setRenderLimit(INITIAL_RENDER);
        setFollowing(true);
        return;
      }
      if (event === 'sample') {
        if (followingRef.current) {
          displayCountRef.current = rows.length;
          setDisplayRows([...rows]);
        } else {
          setPendingCount(Math.max(0, rows.length - displayCountRef.current));
        }
      }
    });
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atTop = el.scrollTop <= TOP_THRESHOLD;

    if (atTop) {
      if (!followingRef.current) {
        // Back at the top → flush pending rows and resume following.
        followingRef.current = true;
        displayCountRef.current = liveRecorder.getSessionSnapshot().rows.length;
        setDisplayRows([...liveRecorder.getSessionSnapshot().rows]);
        setPendingCount(0);
        setFollowing(true);
      }
    } else if (followingRef.current) {
      followingRef.current = false;
      setFollowing(false);
    }

    // Reverse infinite scroll: approaching the oldest rendered row loads
    // another chunk from the (unlimited) session buffer.
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 240 && renderLimit < displayRows.length && renderLimit < MAX_RENDER) {
      setRenderLimit((n) => Math.min(MAX_RENDER, n + CHUNK_RENDER));
    }
  };

  const jumpToTop = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  };

  const session = liveRecorder.getSessionSnapshot();
  // Columns follow the Graphic View selection (selection order = main first);
  // ids not present in the session (stale) are skipped.
  const cacheChannels = getOnlineCache()?.channels || [];
  const columns = selectedIds
    .filter((id) => session.channelIds.includes(id))
    .map((id) => {
      const c = cacheChannels.find((x) => x && x.channel_id === id);
      const m = session.channelMeta[id] || {};
      const lmPrefix = (m.location && m.measurementPoint)
        ? `${m.location} / ${m.measurementPoint}`
        : (m.location || m.measurementPoint ? `${m.location || m.measurementPoint}` : '');
      const defaultChLabel = intl.get('ONLINE_CHANNEL_NUM', { id }) || `Channel ${id}`;
      const fullTitle = lmPrefix ? `${lmPrefix} · ${m.name || defaultChLabel}` : (c?.channel_name || m.name || defaultChLabel);
      return {
        id,
        name: (c && (c.channel_name || c.sensor_description)) || m.name || defaultChLabel,
        fullTitle,
        unit: (c && c.unit) || m.unit || '',
        resolution: (c && typeof c.resolution === 'number' && c.resolution >= 0 ? c.resolution : m.resolution) ?? 2,
      };
    });

  const visibleRows = useMemo(
    () => displayRows.slice(-renderLimit).reverse(),
    [displayRows, renderLimit]
  );

  const olderNotRendered = Math.max(0, displayRows.length - visibleRows.length);

  // Map of channel configs for threshold checking
  const channelConfigMap = useMemo(() => {
    const map = new Map();
    try {
      const locs = getLocations();
      locs.forEach(loc => {
        (loc.measurementPoints || []).forEach(mp => {
          (mp.channels || []).forEach(ch => {
            if (ch && ch.alarmConfig?.enabled) {
              const keys = [
                String(ch.id),
                String(ch.channel_id),
                String(ch.displayName || '').trim().toLowerCase(),
                String(ch.name || '').trim().toLowerCase()
              ].filter(Boolean);
              keys.forEach(k => map.set(k, ch.alarmConfig));
            }
          });
        });
      });
    } catch (_) {}
    return map;
  }, []);

  return (
    <div className="live-view-root">
      <div className="live-view-toolbar">
        <span className="live-view-title">
          {session.recording ? <span className="rec-pulse-dot" /> : <span className="live-paused-dot" />}
          {session.recording ? (intl.get('LIVE_TV_RECORDING') || 'Recording') : (intl.get('LIVE_TV_RECORDING_STOPPED') || 'Recording stopped')}
        </span>
        <span className="live-view-meta">
          {session.rows.length} {intl.get('LIVE_TV_SAMPLES') || 'samples'} · {columns.length} {intl.get('LIVE_TV_CHANNELS') || 'channels'}
          {!following && pendingCount > 0 ? ` · ${pendingCount} ${intl.get('LIVE_TV_NEW') || 'new'}` : ''}
        </span>
        <span className="live-toolbar-spacer" />
        <span className="live-view-meta">
          {following ? (intl.get('LIVE_TV_COLS_FOLLOW_GV') || 'Cols follow Graphic View') : (intl.get('LIVE_TV_PAUSED_SCROLL_TOP') || 'Paused — scroll to top to resume')}
        </span>
      </div>

      <div className="live-table-scroll" ref={scrollRef} onScroll={handleScroll}>
        {!following && pendingCount > 0 && (
          <button className="live-new-rows-pill" onClick={jumpToTop}>
            ↓ {pendingCount === 1
              ? (intl.get('LIVE_TV_NEW_ROW_CLICK', { count: pendingCount }) || `${pendingCount} new row — click to resume`)
              : (intl.get('LIVE_TV_NEW_ROWS_CLICK', { count: pendingCount }) || `${pendingCount} new rows — click to resume`)}
          </button>
        )}

        {columns.length === 0 ? (
          <div className="live-table-empty">
            {intl.get('LIVE_TV_NO_CHANNELS_SELECTED') || 'No channels selected — check the channels you want in the Graphic View toolbar.'}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="live-table-empty">{intl.get('LIVE_TV_WAITING_FIRST_SAMPLES') || 'Waiting for the first samples…'}</div>
        ) : (
          <table className="live-table">
            <thead>
              <tr>
                <th className="live-table-time">{intl.get('LIVE_TV_DATE_TIME') || 'Date Time'}</th>
                {columns.map((c) => {
                  const cfg = channelConfigMap.get(String(c.id)) || channelConfigMap.get(String(c.name || '').trim().toLowerCase());
                  const inAlarm = isChannelInAlarm(c.id);
                  return (
                    <th key={c.id} title={c.fullTitle || c.name} className={inAlarm ? 'live-table-th-alarm' : ''}>
                      {c.unit ? `${c.name} (${c.unit})` : c.name}
                      {inAlarm && (
                        <span className="live-table-th-alarm-badge" title={intl.get('LIVE_TV_CHANNEL_IN_ALARM') || 'Channel currently in alarm'}>🔔</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.t}>
                  <td className="live-table-time">{formatTs(row.t)}</td>
                  {columns.map((c) => {
                    const v = row.values[c.id];
                    const cfg = channelConfigMap.get(String(c.id)) || channelConfigMap.get(String(c.name || '').trim().toLowerCase());
                    const isCellViolating = (v !== null && v !== undefined && !isInvalidValue(v) && cfg)
                      ? isChannelValueInAlarm({ alarmConfig: cfg }, v)
                      : false;
                    return (
                      <td
                        key={c.id}
                        className={isCellViolating ? 'live-table-cell-alarm' : ''}
                        title={isCellViolating ? `Alarm: ${cfg.type} (${cfg.type === 'out_of_range' ? `${cfg.min}~${cfg.max}` : cfg.threshold} ${c.unit || ''})` : undefined}
                      >
                        {v === null || v === undefined || isInvalidValue(v)
                          ? '--.-'
                          : formatChannelValue(v, c.resolution)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {olderNotRendered > 0 && (
          <div className="live-table-empty">
            {intl.get('LIVE_TV_SCROLL_OLDER_ROWS', { count: olderNotRendered }) || `Scroll down to load older rows · ${olderNotRendered} more in this session`}
          </div>
        )}
      </div>
    </div>
  );
}
