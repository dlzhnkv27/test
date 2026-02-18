/**
 * VMS — Интерактивный прототип раскладки камер
 * Режим Live: Go Archive в ячейках, таймлайн привязан к активной ячейке, глобальный флаг Live.
 * Режим Archive: таймлайн — мастер для всех ячеек.
 */

const CELL_COUNT = 4;
const RECORDINGS_PER_CELL = 12;
const TOTAL_HOURS = 24;
const DEFAULT_ARCHIVE_TIME = 3600;

const state = {
  activeCellId: null,
  layoutMode: 'live', // 'live' | 'archive'
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

function updateLayoutModeDisplay() {
  const mode = state.layoutMode;
  const el = document.getElementById('layout-mode');
  if (el) {
    el.textContent = ' · ' + (mode === 'live' ? 'Live' : 'Archive');
    el.dataset.mode = mode;
  }
  document.body.classList.toggle('layout-mode-live', mode === 'live');
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
}

function setActiveCell(cellId) {
  const prevId = state.activeCellId;
  // В режиме Live: ячейка, теряющая фокус и бывшая в Archive, возвращается в Live
  if (state.layoutMode === 'live' && prevId && prevId !== cellId && state.cells[prevId].mode === 'archive') {
    state.cells[prevId].mode = 'live';
    state.cells[prevId].position = null;
    updateCellStatus(prevId);
  }

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
  updateLayoutModeDisplay();
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
    const activeCellInArchive = state.activeCellId && state.cells[state.activeCellId].mode === 'archive';
    if (activeCellInArchive) {
      state.cells[state.activeCellId].position = time;
      updateCellStatus(state.activeCellId);
    } else {
      // ни одна ячейка не переведена в архив — клик по таймлайну переводит раскладку в Archive и время во всех
      state.layoutMode = 'archive';
      for (let i = 1; i <= CELL_COUNT; i++) {
        state.cells[i].mode = 'archive';
        state.cells[i].position = time;
        updateCellStatus(i);
      }
      updateLayoutModeToggle();
    }
  } else {
    for (let i = 1; i <= CELL_COUNT; i++) {
      state.cells[i].mode = 'archive';
      state.cells[i].position = time;
      updateCellStatus(i);
    }
    setActiveCell(null);
  }
  updateLayoutModeDisplay();
}

// Переключение раскладки Live ↔ Archive (тогл над таймлайном)
function setLayoutModeLive() {
  state.layoutMode = 'live';
  for (let i = 1; i <= CELL_COUNT; i++) {
    state.cells[i].mode = 'live';
    state.cells[i].position = null;
    updateCellStatus(i);
  }
  setActiveCell(null);
  document.querySelectorAll('.recording-block').forEach((b) => b.classList.remove('active'));
  updateLayoutModeDisplay();
  updateLayoutModeToggle();
}

function setLayoutModeArchive() {
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
  }
  setActiveCell(null);
  updateTimelineActiveBlock(time);
  updateLayoutModeDisplay();
  updateLayoutModeToggle();
}

function updateLayoutModeToggle() {
  const toggle = document.getElementById('layout-mode-toggle');
  if (!toggle) return;
  toggle.querySelectorAll('.toggle-option').forEach((el) => {
    el.classList.toggle('active', el.dataset.mode === state.layoutMode);
  });
  toggle.setAttribute('aria-checked', state.layoutMode === 'live');
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

  for (let i = 1; i <= CELL_COUNT; i++) {
    updateCellStatus(i);
  }
  updateLayoutModeDisplay();
  updateLayoutModeToggle();
}

document.addEventListener('DOMContentLoaded', init);
