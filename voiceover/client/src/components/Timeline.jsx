import React from 'react';
import { Volume2 } from 'lucide-react';

export default function Timeline({ duration, currentTime, tracks, onSeek, selectedTrackId, onSelectTrack }) {
  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const handleTimelineClick = (e) => {
    if (!duration || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{ width: '100%', marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
        <span className="mono-text">{formatTime(currentTime)}</span>
        <span className="mono-text">{formatTime(duration)}</span>
      </div>

      {/* Main Track Bar */}
      <div 
        onClick={handleTimelineClick}
        style={{
          position: 'relative',
          height: '48px',
          background: 'rgba(10, 14, 24, 0.9)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          overflow: 'hidden',
          userSelect: 'none'
        }}
      >
        {/* Progress fill */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: `${currentPercent}%`,
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.3))',
          borderRight: '2px solid var(--accent-cyan)',
          transition: 'width 0.1s linear'
        }} />

        {/* Playhead Marker */}
        <div style={{
          position: 'absolute',
          left: `${currentPercent}%`,
          top: 0, bottom: 0,
          width: '2px',
          background: 'var(--accent-cyan)',
          boxShadow: '0 0 8px var(--accent-cyan)',
          zIndex: 10
        }} />

        {/* Voice Track Markers */}
        {duration > 0 && tracks.map((track, idx) => {
          const markerPercent = (track.time / duration) * 100;
          const isSelected = track.id === selectedTrackId;
          const hasAudio = Boolean(track.hasAudio);

          return (
            <div
              key={track.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTrack(track.id);
                onSeek(track.time);
              }}
              title={`[${formatTime(track.time)}] ${track.text}`}
              style={{
                position: 'absolute',
                left: `${markerPercent}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                background: isSelected 
                  ? 'var(--accent-pink)' 
                  : hasAudio ? 'var(--primary)' : 'rgba(255, 255, 255, 0.2)',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: isSelected ? '0 0 12px var(--accent-pink)' : '0 2px 6px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.3)',
                zIndex: isSelected ? 20 : 15,
                transition: 'all 0.2s ease',
                maxWidth: '120px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              <Volume2 size={12} />
              <span>T{idx + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
