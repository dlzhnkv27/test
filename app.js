/**
 * VMS — Интерактивный прототип раскладки камер
 * Глобальный режим раскладки: Live / Archive. Таймлайн — мастер для всех ячеек.
 */

const CELL_COUNT = 4;
const RECORDINGS_PER_CELL = 12;
const TOTAL_HOURS = 24;

const state = {
  activeCellId: null,
  cells: {},
};

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

// Глобальный режим раскладки: Live, если все ячейки в Live; иначе Archive
function getLayoutMode() {
  const allLive = Object.values(state.cells).every(
    (c) => c.mode === 'live'
  );
  return allLive ? 'live' : 'archive';
}

function updateLayoutMode() {
  const mode = getLayoutMode();
  const el = document.getElementById('layout-mode');
  if (el) {
    el.textContent = ' · ' + (mode === 'live' ? 'Live' : 'Archive');
    el.dataset.mode = mode;
  }
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
}

function setActiveCell(cellId) {
  document.querySelectorAll('.cell').forEach((el) => el.classList.remove('active'));
  if (cellId) {
    const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
    if (cell) cell.classList.add('active');
  }
  state.activeCellId = cellId;
}

// Go Live в ячейке: переводит только эту ячейку в Live; если все ячейки стали Live — глобальный режим Live
function handleCellGoLive(e) {
  e.stopPropagation();
  const btn = e.target.closest('.cell-go-live');
  if (!btn) return;
  const cellId = parseInt(btn.dataset.cellId, 10);
  state.cells[cellId].mode = 'live';
  state.cells[cellId].position = null;
  updateCellStatus(cellId);
  updateLayoutMode();
}

// Клик по ячейке — только выделение
function handleCellClick(e) {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  if (e.target.closest('.cell-go-live')) return;
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

// Таймлайн — мастер: клик переключает все ячейки на это время, глобальный режим Archive
function handleTimelineClick(e) {
  const block = e.target.closest('.recording-block');
  if (!block) return;

  const time = parseInt(block.dataset.time, 10);

  document.querySelectorAll('.recording-block').forEach((b) => b.classList.remove('active'));
  block.classList.add('active');

  for (let i = 1; i <= CELL_COUNT; i++) {
    state.cells[i].mode = 'archive';
    state.cells[i].position = time;
    updateCellStatus(i);
  }
  setActiveCell(null);
  updateLayoutMode();
}

// Go Live над таймлайном: все ячейки в Live, глобальный режим Live
function handleGoLive() {
  for (let i = 1; i <= CELL_COUNT; i++) {
    state.cells[i].mode = 'live';
    state.cells[i].position = null;
    updateCellStatus(i);
  }
  setActiveCell(null);
  document.querySelectorAll('.recording-block').forEach((b) => b.classList.remove('active'));
  updateLayoutMode();
}

function init() {
  initCells();

  document.querySelectorAll('.cell').forEach((cell) => {
    cell.addEventListener('click', handleCellClick);
  });

  const goLiveBtn = document.getElementById('go-live-btn');
  if (goLiveBtn) goLiveBtn.addEventListener('click', handleGoLive);

  document.querySelectorAll('.cell-go-live').forEach((btn) => {
    btn.addEventListener('click', handleCellGoLive);
  });

  createTimelineRuler();
  createTimelineRecordings();

  const timeline = document.getElementById('timeline-recordings');
  if (timeline) timeline.addEventListener('click', handleTimelineClick);

  for (let i = 1; i <= CELL_COUNT; i++) {
    updateCellStatus(i);
  }
  updateLayoutMode();
}

document.addEventListener('DOMContentLoaded', init);
