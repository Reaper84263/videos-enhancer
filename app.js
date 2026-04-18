const videoUpload = document.getElementById('videoUpload');
const resolutionSelect = document.getElementById('resolutionSelect');
const fpsSelect = document.getElementById('fpsSelect');
const strengthRange = document.getElementById('strengthRange');
const denoiseSelect = document.getElementById('denoiseSelect');
const startButton = document.getElementById('startButton');
const downloadButton = document.getElementById('downloadButton');
const originalVideo = document.getElementById('originalVideo');
const enhancedVideo = document.getElementById('enhancedVideo');
const statusBox = document.getElementById('statusBox');

const strengthValue = document.getElementById('strengthValue');
const previewTarget = document.getElementById('previewTarget');
const statRes = document.getElementById('statRes');
const statSharpness = document.getElementById('statSharpness');
const statDenoise = document.getElementById('statDenoise');
const statFps = document.getElementById('statFps');

const denoiseMap = {
  low: { clarity: 1.06, vibrance: 1.05, label: 'Low' },
  medium: { clarity: 1.1, vibrance: 1.1, label: 'Medium' },
  high: { clarity: 1.15, vibrance: 1.14, label: 'High' }
};

let uploadedUrl = '';
let enhancementApplied = false;
let renderedDownloadUrl = '';
let isRendering = false;
let isMirroringPlayback = false;

function setStatus(message) {
  statusBox.textContent = message;
}

function getEnhancementProfile() {
  const strength = Number(strengthRange.value);
  const denoise = denoiseMap[denoiseSelect.value];

  return {
    contrast: 1 + strength / 120,
    saturate: denoise.vibrance,
    brightness: 1 + strength / 900
  };
}

function getTargetDimensions() {
  const [width, height] = resolutionSelect.value.split('x').map(Number);
  return { width, height };
}

function waitForEvent(target, eventName) {
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Failed while waiting for ${eventName}.`));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener('error', onError);
    };

    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

function pickRecorderMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/webm';
}

async function renderEnhancedDownload() {
  const sourceVideo = document.createElement('video');
  sourceVideo.src = uploadedUrl;
  sourceVideo.crossOrigin = 'anonymous';
  sourceVideo.preload = 'auto';
  sourceVideo.playsInline = true;

  await waitForEvent(sourceVideo, 'loadedmetadata');

  const { width, height } = getTargetDimensions();
  const fps = Number(fpsSelect.value) || 24;
  const { contrast, saturate, brightness } = getEnhancementProfile();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });

  if (!context) {
    throw new Error('Could not create rendering context.');
  }

  const captureStream = canvas.captureStream(fps);
  const audioContext = new AudioContext();
  const audioSource = audioContext.createMediaElementSource(sourceVideo);
  const audioDestination = audioContext.createMediaStreamDestination();
  audioSource.connect(audioDestination);
  const captureTracks = [...captureStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()];
  const outputStream = new MediaStream(captureTracks);

  const mimeType = pickRecorderMimeType();
  const chunks = [];
  const recorder = new MediaRecorder(outputStream, {
    mimeType,
    videoBitsPerSecond: 8_000_000
  });

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  context.filter = enhancementApplied ? `contrast(${contrast}) saturate(${saturate}) brightness(${brightness})` : 'none';

  const drawFrame = () => {
    context.drawImage(sourceVideo, 0, 0, width, height);
  };

  let drawing = true;
  const tick = () => {
    if (!drawing || sourceVideo.paused || sourceVideo.ended) {
      return;
    }
    drawFrame();
    requestAnimationFrame(tick);
  };

  recorder.start(250);
  await audioContext.resume();
  await sourceVideo.play();
  tick();

  sourceVideo.addEventListener('timeupdate', () => {
    if (!sourceVideo.duration || !Number.isFinite(sourceVideo.duration)) {
      return;
    }
    const percent = Math.min(100, Math.round((sourceVideo.currentTime / sourceVideo.duration) * 100));
    setStatus(`Rendering enhanced download... ${percent}%`);
  });

  await waitForEvent(sourceVideo, 'ended');
  drawing = false;
  drawFrame();

  await new Promise((resolve) => {
    recorder.addEventListener('stop', resolve, { once: true });
    recorder.stop();
  });

  audioContext.close();
  captureTracks.forEach((track) => track.stop());
  sourceVideo.removeAttribute('src');
  sourceVideo.load();

  const blobType = mimeType.split(';')[0] || 'video/webm';
  return new Blob(chunks, { type: blobType });
}

function syncPreviewStats() {
  const [width, height] = resolutionSelect.value.split('x');
  const fps = fpsSelect.value;
  const strength = Number(strengthRange.value);
  const denoise = denoiseMap[denoiseSelect.value];

  strengthValue.textContent = `${strength}%`;
  previewTarget.textContent = `Preview target: ${height}p @ ${fps} FPS`;
  statRes.textContent = `${height}p`;
  statFps.textContent = `${fps} FPS`;
  statDenoise.textContent = denoise.label;
  statSharpness.textContent = `+${Math.round(120 + strength * 1.5)}%`;

  if (enhancementApplied) {
    const sharpenBoost = 1 + strength / 80;
    const contrast = 1 + strength / 120;
    const brightness = 1 + strength / 900;
    enhancedVideo.style.filter = `contrast(${contrast}) saturate(${denoise.vibrance}) brightness(${brightness})`;
    enhancedVideo.style.transform = `scale(${Math.min(1.04, sharpenBoost)})`;
    enhancedVideo.style.boxShadow = `0 0 ${4 + strength / 8}px rgba(63, 165, 255, 0.45)`;
    enhancedVideo.style.transformOrigin = 'center';
  } else {
    enhancedVideo.style.filter = 'none';
    enhancedVideo.style.transform = 'none';
    enhancedVideo.style.boxShadow = 'none';
  }

  const aspectRatio = `${width} / ${height}`;
  originalVideo.style.aspectRatio = aspectRatio;
  enhancedVideo.style.aspectRatio = aspectRatio;
}

function syncPlayback(source, target) {
  if (!target.src || isMirroringPlayback) {
    return;
  }

  isMirroringPlayback = true;
  if (Math.abs(target.currentTime - source.currentTime) > 0.12) {
    target.currentTime = source.currentTime;
  }

  const syncPromise = source.paused
    ? (!target.paused ? Promise.resolve(target.pause()) : Promise.resolve())
    : (target.paused ? target.play().catch(() => {}) : Promise.resolve());

  Promise.resolve(syncPromise).finally(() => {
    setTimeout(() => {
      isMirroringPlayback = false;
    }, 0);
  });
}

videoUpload.addEventListener('change', () => {
  const file = videoUpload.files?.[0];
  if (!file) {
    return;
  }

  if (!file.type.startsWith('video/')) {
    setStatus('Unsupported file type. Please upload a valid video file.');
    return;
  }

  if (uploadedUrl) {
    URL.revokeObjectURL(uploadedUrl);
  }
  if (renderedDownloadUrl) {
    URL.revokeObjectURL(renderedDownloadUrl);
    renderedDownloadUrl = '';
  }

  uploadedUrl = URL.createObjectURL(file);
  originalVideo.src = uploadedUrl;
  enhancedVideo.src = uploadedUrl;
  enhancementApplied = false;
  enhancedVideo.style.filter = 'none';
  enhancedVideo.style.transform = 'none';
  enhancedVideo.style.boxShadow = 'none';

  startButton.disabled = false;
  downloadButton.disabled = true;
  setStatus(`Loaded: ${file.name}. Tune settings and click Start Enhance.`);
  syncPreviewStats();
});

startButton.addEventListener('click', () => {
  if (!uploadedUrl) {
    setStatus('Please upload a video first.');
    return;
  }

  enhancementApplied = true;
  syncPreviewStats();
  enhancedVideo.currentTime = originalVideo.currentTime || 0;
  if (!originalVideo.paused) {
    enhancedVideo.play().catch(() => {});
  }

  downloadButton.disabled = false;
  setStatus('Enhancement profile applied. Preview ready and download unlocked.');
});

downloadButton.addEventListener('click', async () => {
  if (!uploadedUrl || isRendering) {
    return;
  }

  isRendering = true;
  downloadButton.disabled = true;
  startButton.disabled = true;
  setStatus('Preparing enhanced download...');

  try {
    const renderedBlob = await renderEnhancedDownload();

    if (renderedDownloadUrl) {
      URL.revokeObjectURL(renderedDownloadUrl);
    }
    renderedDownloadUrl = URL.createObjectURL(renderedBlob);

    const link = document.createElement('a');
    const name = (videoUpload.files?.[0]?.name || 'enhanced-video').replace(/\.[^.]+$/, '');
    link.href = renderedDownloadUrl;
    link.download = `${name}-enhanced.webm`;
    link.click();

    setStatus('Enhanced video downloaded.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown rendering error.';
    setStatus(`Could not render enhanced download: ${message}`);
  } finally {
    isRendering = false;
    downloadButton.disabled = false;
    startButton.disabled = false;
  }
});

[resolutionSelect, fpsSelect, strengthRange, denoiseSelect].forEach((el) => {
  el.addEventListener('input', syncPreviewStats);
  el.addEventListener('change', syncPreviewStats);
});

originalVideo.addEventListener('play', () => syncPlayback(originalVideo, enhancedVideo));
enhancedVideo.addEventListener('play', () => syncPlayback(enhancedVideo, originalVideo));
originalVideo.addEventListener('pause', () => syncPlayback(originalVideo, enhancedVideo));
enhancedVideo.addEventListener('pause', () => syncPlayback(enhancedVideo, originalVideo));

originalVideo.addEventListener('seeked', () => {
  syncPlayback(originalVideo, enhancedVideo);
});

enhancedVideo.addEventListener('seeked', () => {
  syncPlayback(enhancedVideo, originalVideo);
});

startButton.disabled = true;
syncPreviewStats();
