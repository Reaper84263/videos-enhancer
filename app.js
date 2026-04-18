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

  // Keep a responsive aspect ratio target using width/height values.
  const aspectRatio = `${width} / ${height}`;
  originalVideo.style.aspectRatio = aspectRatio;
  enhancedVideo.style.aspectRatio = aspectRatio;
}

videoUpload.addEventListener('change', () => {
  const file = videoUpload.files?.[0];
  if (!file) {
    return;
  }

  if (uploadedUrl) {
    URL.revokeObjectURL(uploadedUrl);
  }

  uploadedUrl = URL.createObjectURL(file);
  originalVideo.src = uploadedUrl;
  enhancedVideo.src = uploadedUrl;
  downloadButton.disabled = true;
  statusBox.textContent = `Loaded: ${file.name}. Tune settings and click Start Enhance.`;
  syncPreviewStats();
});

startButton.addEventListener('click', () => {
  if (!uploadedUrl) {
    statusBox.textContent = 'Please upload a video first.';
    return;
  }

  syncPreviewStats();
  enhancedVideo.currentTime = originalVideo.currentTime || 0;
  if (!originalVideo.paused) {
    enhancedVideo.play().catch(() => {});
  }

  downloadButton.disabled = false;
  statusBox.textContent = 'Enhancement profile applied. Preview ready and download unlocked.';
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
  statusBox.textContent = 'Downloaded preview source. Integrate with ffmpeg/ML backend for true re-encoding.';
});

[resolutionSelect, fpsSelect, strengthRange, denoiseSelect].forEach((el) => {
  el.addEventListener('input', syncPreviewStats);
  el.addEventListener('change', syncPreviewStats);
});

originalVideo.addEventListener('play', () => {
  if (enhancedVideo.src) {
    enhancedVideo.currentTime = originalVideo.currentTime;
    enhancedVideo.play().catch(() => {});
  }
});

originalVideo.addEventListener('pause', () => {
  enhancedVideo.pause();
});

originalVideo.addEventListener('seeked', () => {
  if (enhancedVideo.src) {
    enhancedVideo.currentTime = originalVideo.currentTime;
  }
});

syncPreviewStats();
