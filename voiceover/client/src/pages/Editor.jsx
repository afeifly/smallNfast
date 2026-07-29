import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Upload, Play, Pause, Plus, Trash2, Volume2, 
  Download, Loader2, Sparkles, CheckCircle2, AlertCircle, Clock, Save
} from 'lucide-react';
import Timeline from '../components/Timeline';
import { fetchTTSAudio, VOICE_OPTIONS } from '../utils/ttsClient';
import { exportCompositeVideo } from '../utils/videoExporter';
import { updateProject } from '../utils/storage';

export default function Editor({ project, onBack }) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [tracks, setTracks] = useState(project.tracks || []);
  const [selectedTrackId, setSelectedTrackId] = useState(tracks[0]?.id || null);

  // AudioBuffers in memory for playback & export
  const [audioBuffers, setAudioBuffers] = useState({});
  const [generatingTrackId, setGeneratingTrackId] = useState(null);
  const [trackErrors, setTrackErrors] = useState({});

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideoUrl, setExportedVideoUrl] = useState('');
  const [exportFormat, setExportFormat] = useState('webm');

  const videoRef = useRef(null);
  const audioCtxRef = useRef(null);
  const scheduledSourcesRef = useRef([]);

  // Initialize Web Audio Context
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Save project when tracks change
  useEffect(() => {
    updateProject({
      ...project,
      tracks,
      duration
    });
  }, [tracks, duration]);

  // Video metadata loaded handler
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  };

  // Handle Video File Select
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  // Synchronized preview audio scheduler
  const stopScheduledAudio = () => {
    scheduledSourcesRef.current.forEach(src => {
      try { src.stop(); } catch (e) {}
    });
    scheduledSourcesRef.current = [];
  };

  const schedulePreviewAudio = () => {
    stopScheduledAudio();
    if (!videoRef.current || videoRef.current.paused) return;

    const audioCtx = getAudioContext();
    const currVideoTime = videoRef.current.currentTime;

    tracks.forEach(track => {
      const audioBuf = audioBuffers[track.id];
      if (audioBuf && track.time >= currVideoTime) {
        const timeOffset = track.time - currVideoTime;
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuf;
        source.connect(audioCtx.destination);
        source.start(audioCtx.currentTime + timeOffset);
        scheduledSourcesRef.current.push(source);
      }
    });
  };

  const togglePlay = () => {
    if (!videoRef.current || !videoUrl) return;
    if (isPlaying) {
      videoRef.current.pause();
      stopScheduledAudio();
      setIsPlaying(false);
    } else {
      getAudioContext();
      videoRef.current.play();
      schedulePreviewAudio();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (timeSecs) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeSecs;
      setCurrentTime(timeSecs);
      if (isPlaying) {
        schedulePreviewAudio();
      }
    }
  };

  // Voice Track Editing Handlers
  const addTrack = () => {
    const newTrack = {
      id: 'track_' + Date.now(),
      time: Math.min(Math.floor(currentTime), Math.floor(duration)),
      text: 'New voice narration text...',
      voiceId: 'male-qn-qingse'
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrackId(newTrack.id);
  };

  const updateTrackField = (id, field, value) => {
    setTracks(tracks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTrack = (id) => {
    setTracks(tracks.filter(t => t.id !== id));
    const newBuffers = { ...audioBuffers };
    delete newBuffers[id];
    setAudioBuffers(newBuffers);
  };

  // TTS Voice Generation Handler
  const generateVoice = async (track) => {
    if (!track.text.trim()) return;
    setGeneratingTrackId(track.id);
    setTrackErrors({ ...trackErrors, [track.id]: null });

    try {
      const arrayBuffer = await fetchTTSAudio({
        text: track.text,
        voiceId: track.voiceId
      });

      const audioCtx = getAudioContext();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      setAudioBuffers(prev => ({
        ...prev,
        [track.id]: decodedBuffer
      }));

    } catch (err) {
      console.error('TTS Generation error:', err);
      setTrackErrors({
        ...trackErrors,
        [track.id]: err.message || 'Generation failed'
      });
    } finally {
      setGeneratingTrackId(null);
    }
  };

  // Preview single track audio
  const playTrackAudio = (trackId) => {
    const buf = audioBuffers[trackId];
    if (!buf) return;
    const audioCtx = getAudioContext();
    const source = audioCtx.createBufferSource();
    source.buffer = buf;
    source.connect(audioCtx.destination);
    source.start(0);
  };

  // Export composite video handler
  const handleExport = () => {
    if (!videoRef.current || !videoUrl) return;
    setIsExporting(true);
    setExportProgress(0);

    exportCompositeVideo({
      videoElement: videoRef.current,
      tracks,
      audioBuffers,
      duration,
      onProgress: (percent) => setExportProgress(percent),
      onComplete: (url, format) => {
        setExportedVideoUrl(url);
        setExportFormat(format);
        setIsExporting(false);
      },
      onError: (err) => {
        alert('Export error: ' + err);
        setIsExporting(false);
      }
    });
  };

  return (
    <div className="app-container" style={{ padding: '20px 30px' }}>
      {/* Top Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '14px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} /> Back to Projects
          </button>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>{project.name}</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {videoFile ? videoFile.name : 'No video file loaded'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleExport}
            disabled={!videoUrl || isExporting}
          >
            <Download size={16} /> Export Video
          </button>
        </div>
      </header>

      {/* Main Workspace Split */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
        gap: '24px',
        alignItems: 'start'
      }}>
        
        {/* Left Side: Video Preview + Timeline */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          {!videoUrl ? (
            <div style={{
              border: '2px dashed var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '60px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s'
            }}
            onClick={() => document.getElementById('videoFileInput').click()}
            >
              <Upload size={48} color="var(--primary)" style={{ marginBottom: '14px' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Click to select local MP4 or MOV file</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                File will be processed entirely inside your browser client.
              </p>
              <input 
                id="videoFileInput"
                type="file" 
                accept="video/mp4,video/quicktime,.mp4,.mov"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div>
              <div style={{ position: 'relative', background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  style={{ width: '100%', maxHeight: '420px', display: 'block' }}
                />
              </div>

              {/* Control bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '14px' }}>
                <button className="btn btn-primary" onClick={togglePlay} style={{ borderRadius: '50%', width: '42px', height: '42px', padding: 0 }}>
                  {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: '2px' }} />}
                </button>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <span className="mono-text">{Math.floor(currentTime)}s</span> / <span className="mono-text">{Math.floor(duration)}s</span>
                </div>
                <button 
                  className="btn btn-secondary" 
                  style={{ marginLeft: 'auto', fontSize: '0.8rem' }}
                  onClick={() => document.getElementById('videoFileInput').click()}
                >
                  Replace Video
                </button>
                <input 
                  id="videoFileInput"
                  type="file" 
                  accept="video/mp4,video/quicktime,.mp4,.mov"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Timeline */}
              <Timeline 
                duration={duration}
                currentTime={currentTime}
                tracks={tracks.map(t => ({ ...t, hasAudio: Boolean(audioBuffers[t.id]) }))}
                onSeek={handleSeek}
                selectedTrackId={selectedTrackId}
                onSelectTrack={setSelectedTrackId}
              />
            </div>
          )}
        </div>

        {/* Right Side: Voice Tracks Panel */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Voice Over Tracks</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Add text narration at video time points</p>
            </div>
            <button className="btn btn-secondary" onClick={addTrack}>
              <Plus size={16} /> Add Track
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '580px', overflowY: 'auto', paddingRight: '4px' }}>
            {tracks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '30px 0' }}>
                No voice tracks added yet. Click "Add Track" to create one.
              </p>
            ) : (
              tracks.map((track, index) => {
                const isGenerating = generatingTrackId === track.id;
                const hasAudio = Boolean(audioBuffers[track.id]);
                const errorMsg = trackErrors[track.id];

                return (
                  <div 
                    key={track.id}
                    className="glass-panel"
                    onClick={() => setSelectedTrackId(track.id)}
                    style={{ 
                      padding: '16px', 
                      borderRadius: 'var(--radius-md)',
                      border: track.id === selectedTrackId ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      background: track.id === selectedTrackId ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-input)'
                    }}
                  >
                    {/* Track Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: 'var(--primary)',
                          color: '#fff',
                          fontWeight: '700',
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '10px'
                        }}>
                          #{index + 1}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} color="var(--text-muted)" />
                          <input 
                            type="number"
                            step="0.1"
                            min="0"
                            max={duration || 3600}
                            value={track.time}
                            onChange={(e) => updateTrackField(track.id, 'time', parseFloat(e.target.value) || 0)}
                            style={{
                              width: '70px',
                              padding: '2px 6px',
                              fontSize: '0.85rem',
                              background: 'rgba(0,0,0,0.4)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              color: 'var(--text-main)'
                            }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>s</span>
                        </div>
                        <button 
                          onClick={() => handleSeek(track.time)}
                          className="btn btn-secondary" 
                          style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                          title="Seek video to track time"
                        >
                          Seek
                        </button>
                      </div>

                      <button 
                        onClick={() => removeTrack(track.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                        title="Remove track"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Speaker Select */}
                    <div style={{ marginBottom: '10px' }}>
                      <select 
                        className="select-field" 
                        value={track.voiceId}
                        onChange={(e) => updateTrackField(track.id, 'voiceId', e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                      >
                        {VOICE_OPTIONS.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Text Input */}
                    <div style={{ marginBottom: '12px' }}>
                      <textarea
                        rows={3}
                        className="textarea-field"
                        placeholder="Enter text to generate speech..."
                        value={track.text}
                        onChange={(e) => updateTrackField(track.id, 'text', e.target.value)}
                        style={{ fontSize: '0.85rem', resize: 'vertical' }}
                      />
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {hasAudio && (
                          <span style={{ color: 'var(--success)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} /> Ready
                          </span>
                        )}
                        {errorMsg && (
                          <span style={{ color: 'var(--danger)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={14} /> {errorMsg}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {hasAudio && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            onClick={() => playTrackAudio(track.id)}
                          >
                            <Volume2 size={14} /> Listen
                          </button>
                        )}
                        <button
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          disabled={isGenerating || !track.text.trim()}
                          onClick={() => generateVoice(track)}
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 size={14} className="pulse-glow" style={{ animation: 'spin 1s linear infinite' }} />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} />
                              {hasAudio ? 'Re-generate' : 'Generate MP3'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Exporting Progress Modal */}
      {(isExporting || exportedVideoUrl) && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '480px', padding: '32px', textAlign: 'center' }}>
            {isExporting ? (
              <div>
                <Loader2 size={42} color="var(--primary)" style={{ animation: 'spin 1.2s linear infinite', marginBottom: '16px' }} />
                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Exporting Composite Video...</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Combining canvas video frames and MiniMax voice tracks.
                </p>
                <div style={{ background: 'rgba(255,255,255,0.1)', height: '10px', borderRadius: '5px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{ width: `${exportProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--accent-cyan))', transition: 'width 0.2s' }} />
                </div>
                <span className="mono-text" style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>{exportProgress}%</span>
              </div>
            ) : (
              <div>
                <CheckCircle2 size={48} color="var(--success)" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Export Complete!</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
                  Your video with added voice narration is ready to download.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
                  <button className="btn btn-secondary" onClick={() => setExportedVideoUrl('')}>
                    Close
                  </button>
                  <a 
                    href={exportedVideoUrl} 
                    download={`${project.name || 'suto_voiceover'}.${exportFormat}`}
                    className="btn btn-primary"
                    style={{ textDecoration: 'none' }}
                  >
                    <Download size={18} /> Download .{exportFormat}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
