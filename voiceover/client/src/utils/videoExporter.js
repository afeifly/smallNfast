export async function exportCompositeVideo({
  videoElement,
  tracks,
  audioBuffers,
  duration,
  onProgress,
  onComplete,
  onError
}) {
  try {
    const videoWidth = videoElement.videoWidth || 1280;
    const videoHeight = videoElement.videoHeight || 720;

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext('2d');

    // Create Web Audio Context for export mixing
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();

    // Pipe original video audio if available
    try {
      const videoAudioSource = audioCtx.createMediaElementSource(videoElement);
      videoAudioSource.connect(dest);
    } catch (e) {
      console.warn('Original video audio element source could not be created or already connected:', e);
    }

    // Schedule voice tracks on Web Audio timeline
    Object.keys(audioBuffers).forEach(trackId => {
      const track = tracks.find(t => t.id === trackId);
      const audioBuf = audioBuffers[trackId];
      if (track && audioBuf) {
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuf;
        source.connect(dest);
        // schedule at track.time seconds after start
        source.start(audioCtx.currentTime + track.time);
      }
    });

    // Create Canvas Video Stream
    const canvasStream = canvas.captureStream(30);

    // Combine Video + Audio tracks into combined MediaStream
    const combinedTracks = [
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ];
    const combinedStream = new MediaStream(combinedTracks);

    // Choose mimeType supported by browser
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    }

    const recorder = new MediaRecorder(combinedStream, { mimeType });
    const recordedChunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      audioCtx.close();
      onComplete(url, mimeType.includes('mp4') ? 'mp4' : 'webm');
    };

    // Reset video playhead and start recording
    videoElement.currentTime = 0;
    await videoElement.play();
    recorder.start();

    // Frame rendering loop
    let animationFrameId;
    const renderFrame = () => {
      if (videoElement.paused || videoElement.ended) {
        return;
      }
      ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
      
      const current = videoElement.currentTime;
      onProgress(Math.min(100, Math.floor((current / duration) * 100)));

      if (current < duration) {
        animationFrameId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    // Handle end of playback
    const handleEnded = () => {
      videoElement.removeEventListener('ended', handleEnded);
      cancelAnimationFrame(animationFrameId);
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    };

    videoElement.addEventListener('ended', handleEnded);

  } catch (err) {
    console.error('Video export error:', err);
    onError(err.message || 'Export failed');
  }
}
