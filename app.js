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
  low: { blur: 0.25, vibrance: 1.03, label: 'Low' },
  medium: { blur: 0.65, vibrance: 1.07, label: 'Medium' },
  high: { blur: 1.1, vibrance: 1.12, label: 'High' }
};

let uploadedUrl = '';

function setStatus(message) {
  statusBox.textContent = message;
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

  const sharpen = 1 + strength / 160;
  const contrast = 1 + strength / 220;
  enhancedVideo.style.filter = `contrast(${contrast}) saturate(${denoise.vibrance}) brightness(1.02) blur(${denoise.blur}px) drop-shadow(0 0 0.2rem #1b58be)`;
  enhancedVideo.style.transform = `scale(${Math.min(1.02, sharpen)})`;
  enhancedVideo.style.transformOrigin = 'center';

  const aspectRatio = `${width} / ${height}`;
  originalVideo.style.aspectRatio = aspectRatio;
  enhancedVideo.style.aspectRatio = aspectRatio;
}

function syncPlayback(source, target) {
  if (!target.src) {
    return;
  }

  target.currentTime = source.currentTime;
  if (!source.paused) {
    target.play().catch(() => {});
  }
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

  uploadedUrl = URL.createObjectURL(file);
  originalVideo.src = uploadedUrl;
  enhancedVideo.src = uploadedUrl;

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

  syncPreviewStats();
  enhancedVideo.currentTime = originalVideo.currentTime || 0;
  if (!originalVideo.paused) {
    enhancedVideo.play().catch(() => {});
  }

  downloadButton.disabled = false;
  setStatus('Enhancement profile applied. Preview ready and download unlocked.');
});

downloadButton.addEventListener('click', () => {
  if (!uploadedUrl) {
    return;
  }

  const link = document.createElement('a');
  const name = (videoUpload.files?.[0]?.name || 'enhanced-video.webm').replace(/\.[^.]+$/, '');
  link.href = uploadedUrl;
  link.download = `${name}-enhanced-preview.webm`;
  link.click();
  setStatus('Downloaded preview source. Integrate with ffmpeg/ML backend for true re-encoding.');
});

[resolutionSelect, fpsSelect, strengthRange, denoiseSelect].forEach((el) => {
  el.addEventListener('input', syncPreviewStats);
  el.addEventListener('change', syncPreviewStats);
});

originalVideo.addEventListener('play', () => syncPlayback(originalVideo, enhancedVideo));
enhancedVideo.addEventListener('play', () => syncPlayback(enhancedVideo, originalVideo));

originalVideo.addEventListener('pause', () => {
  enhancedVideo.pause();
});

enhancedVideo.addEventListener('pause', () => {
  originalVideo.pause();
});

originalVideo.addEventListener('seeked', () => {
  if (enhancedVideo.src) {
    enhancedVideo.currentTime = originalVideo.currentTime;
  }
});

enhancedVideo.addEventListener('seeked', () => {
  if (originalVideo.src) {
    originalVideo.currentTime = enhancedVideo.currentTime;
  }
});

startButton.disabled = true;
syncPreviewStats();
