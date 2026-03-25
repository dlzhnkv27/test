/**
 * VMS — Интерактивный прототип раскладки камер
 * Режим Live: Go Archive в ячейках, таймлайн привязан к активной ячейке, глобальный флаг Live.
 * Режим Archive: таймлайн — мастер для всех ячеек.
 */

const CELL_COUNT = 4;
const RECORDINGS_PER_CELL = 12;
const TOTAL_HOURS = 24;
const DEFAULT_ARCHIVE_TIME = 3600;
const PLAYBACK_SPEEDS = [1, 2, 4, 8];
const CANVAS_W = 320;
const CANVAS_H = 200;

const state = {
  activeCellId: 1,
  layoutMode: 'live',
  cells: {},
  playback: { playing: true, speed: 1 },
};

const cellCanvases = {}; // { [cellId]: { canvas, ctx } }

function initCells() {
  for (let i = 1; i <= CELL_COUNT; i++) {
    state.cells[i] = {
      mode: 'live',
      position: null,
    };
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map(n => n.toString().padStart(2, '0')).join(':');
}

function updateLayoutModeDisplay() {
  const mode = state.layoutMode;
  const isMixed = mode === 'live' && Object.values(state.cells).some((c) => c.mode === 'archive');
  const el = document.getElementById('layout-mode');
  if (el) {
    if (isMixed) {
      el.textContent = ' · Mixed Mode';
      el.dataset.mode = 'mixed';
    } else {
      el.textContent = ' · ' + (mode === 'live' ? 'Live' : 'Archive');
      el.dataset.mode = mode;
    }
  }
  document.body.classList.toggle('layout-mode-live', mode === 'live' && !isMixed);
  document.body.classList.toggle('layout-mode-mixed', isMixed);
  document.body.classList.toggle('layout-mode-archive', mode === 'archive');
}

function updateCellStatus(cellId) {
  const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
  const statusEl = cell?.querySelector('[data-status]');
  if (!cell) return;

  const cellState = state.cells[cellId];

  if (cellState.mode === 'live') {
    if (statusEl) {
      statusEl.textContent = 'Live';
      statusEl.className = 'cell-status live';
    }
    cell.classList.add('cell-mode-live');
  } else {
    if (statusEl) {
      statusEl.textContent = `Archive (${formatTime(cellState.position)})`;
      statusEl.className = 'cell-status archive';
    }
    cell.classList.remove('cell-mode-live');
  }
  renderFrame(cellId);
}

function setActiveCell(cellId) {
  document.querySelectorAll('.cell').forEach((el) => el.classList.remove('active'));
  if (cellId) {
    const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
    if (cell) cell.classList.add('active');
  }
  state.activeCellId = cellId;
}

// Go Live в ячейке
function handleCellGoLive(e) {
  e.stopPropagation();
  const btn = e.target.closest('.cell-go-live');
  if (!btn) return;
  const cellId = parseInt(btn.dataset.cellId, 10);
  state.cells[cellId].mode = 'live';
  state.cells[cellId].position = null;
  updateCellStatus(cellId);
  const anyArchive = Object.values(state.cells).some((c) => c.mode === 'archive');
  if (!anyArchive) state.playback.playing = true;
  updateLayoutModeDisplay();
  updateLayoutModeToggle();
  updatePlaybackControls();
}

// Go Archive в ячейке (только в режиме Live): выбранная ячейка переходит в архив, таймлайн привязывается к ней; глобальный флаг остаётся Live
function handleCellGoArchive(e) {
  e.stopPropagation();
  const btn = e.target.closest('.cell-go-archive');
  if (!btn) return;
  if (state.layoutMode !== 'live') return;
  const cellId = parseInt(btn.dataset.cellId, 10);
  setActiveCell(cellId);
  state.cells[cellId].mode = 'archive';
  state.cells[cellId].position = DEFAULT_ARCHIVE_TIME;
  updateCellStatus(cellId);
  updateTimelineActiveBlock(DEFAULT_ARCHIVE_TIME);
  updateLayoutModeDisplay();
  updateLayoutModeToggle();
  updatePlaybackControls();
}

// Клик по ячейке — выделение (и при Live не переключаем другие в Live)
function handleCellClick(e) {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  if (e.target.closest('.cell-go-live') || e.target.closest('.cell-go-archive')) return;
  const cellId = parseInt(cell.dataset.cellId, 10);
  setActiveCell(cellId);
}

function updateTimelineActiveBlock(time) {
  const blocks = document.querySelectorAll('.recording-block');
  blocks.forEach((block) => {
    const start = parseInt(block.dataset.start, 10);
    const end = parseInt(block.dataset.end, 10);
    block.classList.toggle('active', time >= start && time < end);
  });
}

const totalSeconds = TOTAL_HOURS * 3600;

function createTimelineRuler() {
  const ruler = document.getElementById('timeline-ruler');
  if (!ruler) return;
  ruler.innerHTML = '';
  for (let h = 0; h <= TOTAL_HOURS; h += 6) {
    const span = document.createElement('span');
    span.textContent = `${h.toString().padStart(2, '0')}:00`;
    span.style.left = `${(h / TOTAL_HOURS) * 100}%`;
    span.style.position = 'absolute';
    span.style.transform = 'translateX(-50%)';
    ruler.appendChild(span);
  }
}

function createTimelineRecordings() {
  const container = document.getElementById('timeline-recordings');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < RECORDINGS_PER_CELL; i++) {
    const start = (i / RECORDINGS_PER_CELL) * totalSeconds;
    const end = ((i + 1) / RECORDINGS_PER_CELL) * totalSeconds;
    const block = document.createElement('div');
    block.className = 'recording-block';
    block.dataset.start = start;
    block.dataset.end = end;
    block.dataset.time = Math.floor((start + end) / 2);
    block.title = `${formatTime(start)} - ${formatTime(end)}`;
    container.appendChild(block);
  }
}

// Клик по таймлайну: в Live — если ячейка уже в архиве, только она; иначе раскладка в Archive и время во всех. В Archive — все ячейки.
function handleTimelineClick(e) {
  const block = e.target.closest('.recording-block');
  if (!block) return;

  const time = parseInt(block.dataset.time, 10);

  document.querySelectorAll('.recording-block').forEach((b) => b.classList.remove('active'));
  block.classList.add('active');

  if (state.layoutMode === 'live') {
    const anyCellInArchive = Object.values(state.cells).some((c) => c.mode === 'archive');
    if (anyCellInArchive) {
      for (let i = 1; i <= CELL_COUNT; i++) {
        if (state.cells[i].mode === 'archive') {
          state.cells[i].position = time;
          updateCellStatus(i);
          scrambleBlobs(i);
        }
      }
    } else {
      state.layoutMode = 'archive';
      for (let i = 1; i <= CELL_COUNT; i++) {
        state.cells[i].mode = 'archive';
        state.cells[i].position = time;
        updateCellStatus(i);
        scrambleBlobs(i);
      }
      updateLayoutModeToggle();
    }
  } else {
    for (let i = 1; i <= CELL_COUNT; i++) {
      state.cells[i].mode = 'archive';
      state.cells[i].position = time;
      updateCellStatus(i);
      scrambleBlobs(i);
    }
  }
  updateLayoutModeDisplay();
  updatePlaybackControls();
}

// Переключение раскладки Live ↔ Archive (тогл над таймлайном)
function setLayoutModeLive() {
  state.layoutMode = 'live';
  state.playback.playing = true;
  for (let i = 1; i <= CELL_COUNT; i++) {
    state.cells[i].mode = 'live';
    state.cells[i].position = null;
    updateCellStatus(i);
  }
  setActiveCell(state.activeCellId || 1);
  document.querySelectorAll('.recording-block').forEach((b) => b.classList.remove('active'));
  updateLayoutModeDisplay();
  updateLayoutModeToggle();
  updatePlaybackControls();
}

function setLayoutModeArchive() {
  const preservedActiveId = state.activeCellId;
  state.layoutMode = 'archive';
  let time = DEFAULT_ARCHIVE_TIME;
  // В Live при ячейке в индивидуальном архиве — наследуем её время на таймлайне во все ячейки
  for (let i = 1; i <= CELL_COUNT; i++) {
    if (state.cells[i].mode === 'archive' && state.cells[i].position != null) {
      time = state.cells[i].position;
      break;
    }
  }
  for (let i = 1; i <= CELL_COUNT; i++) {
    state.cells[i].mode = 'archive';
    state.cells[i].position = time;
    updateCellStatus(i);
    scrambleBlobs(i);
  }
  updateTimelineActiveBlock(time);
  updateLayoutModeDisplay();
  updateLayoutModeToggle();
  updatePlaybackControls();
  // всегда активна какая-то ячейка: сохраняем текущую или по умолчанию 1
  const activeId = preservedActiveId != null ? preservedActiveId : 1;
  document.querySelectorAll('.cell').forEach((el) => el.classList.remove('active'));
  const cell = document.querySelector(`[data-cell-id="${activeId}"]`);
  if (cell) cell.classList.add('active');
  state.activeCellId = activeId;
}

function updateLayoutModeToggle() {
  const toggle = document.getElementById('layout-mode-toggle');
  if (!toggle) return;
  const isMixed = state.layoutMode === 'live' && Object.values(state.cells).some((c) => c.mode === 'archive');
  toggle.querySelectorAll('.toggle-option').forEach((el) => {
    el.classList.toggle('active', !isMixed && el.dataset.mode === state.layoutMode);
  });
  toggle.setAttribute('aria-checked', state.layoutMode === 'live');
}

// ── Canvas blobs ───────────────────────────────────────────────────────────

function makeBlobs() {
  return Array.from({ length: 7 }, () => ({
    x:  Math.random() * CANVAS_W,
    y:  Math.random() * CANVAS_H,
    vx: (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 1.2),
    vy: (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 1.2),
    r:  30 + Math.random() * 40,
    g:  80 + Math.floor(Math.random() * 80),  // серость 80–160
  }));
}

function makeSpeckles() {
  return Array.from({ length: 22 }, () => ({
    x: Math.random() * CANVAS_W,
    y: Math.random() * CANVAS_H,
    r: 0.8 + Math.random() * 1.6,
    a: 0.4 + Math.random() * 0.6,
  }));
}

function initCellCanvas(cellId) {
  const placeholder = document.querySelector(`[data-cell-id="${cellId}"] .cell-video-placeholder`);
  if (!placeholder) return;
  placeholder.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'cell-canvas';
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  placeholder.appendChild(canvas);
  cellCanvases[cellId] = {
    canvas,
    ctx: canvas.getContext('2d'),
    blobs: makeBlobs(),
    speckles: makeSpeckles(),
  };
  renderFrame(cellId);
}

function scrambleBlobs(cellId) {
  const entry = cellCanvases[cellId];
  if (!entry) return;
  entry.blobs.forEach((b) => {
    b.x = Math.random() * CANVAS_W;
    b.y = Math.random() * CANVAS_H;
  });
  renderFrame(cellId);
}

function updateBlobs(cellId, scale = 1) {
  const { blobs } = cellCanvases[cellId];
  blobs.forEach((b) => {
    b.x += b.vx * scale;
    b.y += b.vy * scale;
    if (b.x < -b.r)           b.x = CANVAS_W + b.r;
    if (b.x > CANVAS_W + b.r) b.x = -b.r;
    if (b.y < -b.r)           b.y = CANVAS_H + b.r;
    if (b.y > CANVAS_H + b.r) b.y = -b.r;
  });
}

function updateSpeckles(cellId) {
  const { speckles } = cellCanvases[cellId];
  speckles.forEach((s, i) => {
    if (Math.random() < 0.18) {
      speckles[i] = {
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        r: 0.8 + Math.random() * 1.6,
        a: 0.4 + Math.random() * 0.6,
      };
    }
  });
}

function renderFrame(cellId) {
  const entry = cellCanvases[cellId];
  if (!entry) return;
  const { ctx, blobs, speckles } = entry;
  const isLive = state.cells[cellId]?.mode === 'live';

  // фон
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // блобы
  if (isLive) {
    blobs.forEach((b) => {
      ctx.fillStyle = `rgba(${b.g},${b.g},${b.g},0.65)`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // archive — жёсткие края, без блюра
    blobs.forEach((b) => {
      ctx.fillStyle = `rgba(${b.g},${b.g},${b.g},0.45)`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

}

function startCanvasTicker() {
  let frame = 0;
  function tick() {
    frame++;
    for (let i = 1; i <= CELL_COUNT; i++) {
      const cell = state.cells[i];
      if (!cell) continue;
      if (cell.mode === 'live') {
        const anyArchive = Object.values(state.cells).some((c) => c.mode === 'archive');
        if (state.playback.playing || anyArchive) {
          if (frame % 3 === 0) updateBlobs(i);
          updateSpeckles(i);
          renderFrame(i);
        }
      } else if (state.playback.playing) {
        // archive: скорость блобов в 3× медленнее через дробный шаг
        if (frame % 3 === 0) updateBlobs(i);
        renderFrame(i);
      }
      // archive paused → кадр заморожен
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Playback controls ──────────────────────────────────────────────────────

const ICON_PAUSE = `<svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="1" y="0" width="4" height="13" rx="1"/><rect x="8" y="0" width="4" height="13" rx="1"/></svg>`;
const ICON_PLAY  = `<svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><polygon points="1,0 13,6.5 1,13"/></svg>`;

function getArchiveDisplayTime() {
  if (state.layoutMode === 'archive') {
    return state.cells[state.activeCellId]?.position ?? null;
  }
  for (let i = 1; i <= CELL_COUNT; i++) {
    if (state.cells[i].mode === 'archive') return state.cells[i].position;
  }
  return null;
}

function updatePlaybackControls() {
  const now = new Date();

  const liveEl = document.getElementById('pb-time-live');
  if (liveEl) {
    liveEl.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => n.toString().padStart(2, '0')).join(':');
  }

  const archiveTime = getArchiveDisplayTime();
  const archiveEl = document.getElementById('pb-time-archive');
  if (archiveEl && archiveTime != null) archiveEl.textContent = formatTime(archiveTime);

  const dateEl = document.getElementById('pb-date-archive');
  if (dateEl) {
    dateEl.textContent = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  const icon = state.playback.playing ? ICON_PAUSE : ICON_PLAY;
  const pauseTooltip = state.playback.playing ? 'Пауза' : 'Воспроизвести';
  ['pb-pause-live', 'pb-pause-archive'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = icon;
    el.dataset.tooltip = pauseTooltip;
  });

  const speedEl = document.getElementById('pb-speed-btn');
  if (speedEl) speedEl.textContent = `x${state.playback.speed}`;

  const anyArchive = Object.values(state.cells).some((c) => c.mode === 'archive');
  document.body.classList.toggle(
    'live-paused',
    state.layoutMode === 'live' && !anyArchive && !state.playback.playing
  );
}

function handlePauseToggle(e) {
  if (!e.target.closest('.pb-pause-btn')) return;

  /*
   * СПОРНОЕ РЕШЕНИЕ
   * Сейчас пауза в Live-режиме просто замораживает видео и затемняет ячейки.
   * По идее корректное поведение: клик «Пауза» в Live должен переводить
   * раскладку в Archive-режим с паузой на текущем моменте времени —
   * то есть фиксировать «живой» кадр как архивную точку.
   * Это сделало бы переход обратимым (нажал Play → вернулся в Live),
   * но потребует решения: на какое именно время фиксировать архив (now - latency?).
   */

  state.playback.playing = !state.playback.playing;
  updatePlaybackControls();
}

function handleSeek(e) {
  const btn = e.target.closest('.pb-seek-btn');
  if (!btn) return;
  const delta = btn.id === 'pb-seek-back' ? -5 : 5;
  for (let i = 1; i <= CELL_COUNT; i++) {
    if (state.cells[i].mode === 'archive') {
      state.cells[i].position = Math.max(0, Math.min(totalSeconds - 1, (state.cells[i].position || 0) + delta));
      updateCellStatus(i);
      scrambleBlobs(i);
    }
  }
  const activePos = state.cells[state.activeCellId]?.position;
  if (activePos != null) updateTimelineActiveBlock(activePos);
  updatePlaybackControls();
}

function handleSpeedToggle() {
  const idx = PLAYBACK_SPEEDS.indexOf(state.playback.speed);
  state.playback.speed = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
  updatePlaybackControls();
}

function handleFrameStep(e) {
  const btn = e.target.closest('.pb-frame-btn');
  if (!btn) return;
  const delta = btn.id === 'pb-frame-back' ? -1 : 1;
  state.playback.playing = false;
  for (let i = 1; i <= CELL_COUNT; i++) {
    if (state.cells[i].mode === 'archive') {
      state.cells[i].position = Math.max(0, Math.min(totalSeconds - 1, (state.cells[i].position || 0) + delta));
      updateBlobs(i, 3);
      updateCellStatus(i);
    }
  }
  const activePos = state.cells[state.activeCellId]?.position;
  if (activePos != null) updateTimelineActiveBlock(activePos);
  updatePlaybackControls();
}

function startTickers() {
  setInterval(() => {
    if (state.layoutMode === 'live') {
      updatePlaybackControls();
      return;
    }
    if (state.layoutMode === 'archive' && state.playback.playing) {
      for (let i = 1; i <= CELL_COUNT; i++) {
        if (state.cells[i].mode === 'archive') {
          const newPos = Math.min((state.cells[i].position || 0) + state.playback.speed, totalSeconds - 1);
          state.cells[i].position = newPos;
          updateCellStatus(i);
          if (newPos >= totalSeconds - 1) state.playback.playing = false;
        }
      }
      const activePos = state.cells[state.activeCellId]?.position;
      if (activePos != null) updateTimelineActiveBlock(activePos);
      updatePlaybackControls();
    }
  }, 1000);
}

function handleLayoutModeToggle(e) {
  const option = e.target.closest('.toggle-option');
  if (!option) return;
  const mode = option.dataset.mode;
  if (mode === 'live') {
    setLayoutModeLive(); // любой клик на Live переводит все ячейки в Live
    return;
  }
  if (mode === state.layoutMode) return;
  setLayoutModeArchive();
}

function init() {
  initCells();

  document.querySelectorAll('.cell').forEach((cell) => {
    cell.addEventListener('click', handleCellClick);
  });

  const layoutModeToggle = document.getElementById('layout-mode-toggle');
  if (layoutModeToggle) {
    layoutModeToggle.addEventListener('click', handleLayoutModeToggle);
    updateLayoutModeToggle();
  }

  document.querySelectorAll('.cell-go-live').forEach((btn) => {
    btn.addEventListener('click', handleCellGoLive);
  });

  document.querySelectorAll('.cell-go-archive').forEach((btn) => {
    btn.addEventListener('click', handleCellGoArchive);
  });

  createTimelineRuler();
  createTimelineRecordings();

  const timeline = document.getElementById('timeline-recordings');
  if (timeline) timeline.addEventListener('click', handleTimelineClick);

  const collapseBtn = document.getElementById('timeline-collapse-btn');
  if (collapseBtn) {
    const collapseLabel = collapseBtn.querySelector('.timeline-collapse-label');
    collapseBtn.addEventListener('click', () => {
      const section = collapseBtn.closest('.timeline-section');
      if (!section) return;
      const isCollapsed = section.classList.toggle('collapsed');
      if (collapseLabel) collapseLabel.textContent = isCollapsed ? 'Раскрыть таймлайн' : 'Свернуть таймлайн';
    });
  }

  document.getElementById('pb-pause-live')?.addEventListener('click', handlePauseToggle);
  document.getElementById('pb-pause-archive')?.addEventListener('click', handlePauseToggle);
  document.getElementById('pb-seek-back')?.addEventListener('click', handleSeek);
  document.getElementById('pb-seek-fwd')?.addEventListener('click', handleSeek);
  document.getElementById('pb-speed-btn')?.addEventListener('click', handleSpeedToggle);
  document.getElementById('pb-frame-back')?.addEventListener('click', handleFrameStep);
  document.getElementById('pb-frame-fwd')?.addEventListener('click', handleFrameStep);

  for (let i = 1; i <= CELL_COUNT; i++) {
    initCellCanvas(i);
    updateCellStatus(i);
  }
  updateLayoutModeDisplay();
  updateLayoutModeToggle();
  setActiveCell(state.activeCellId);
  updatePlaybackControls();
  startTickers();
  startCanvasTicker();
}

document.addEventListener('DOMContentLoaded', init);
