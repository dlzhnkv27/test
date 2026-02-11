/**
 * VMS — Интерактивный прототип раскладки камер
 */

const CELL_COUNT = 4;
const RECORDINGS_PER_CELL = 12; // блоков на каждую камеру
const TOTAL_HOURS = 24;

// Состояние приложения
const state = {
  activeCellId: null,
  syncEnabled: false,
  cells: {},
};

// Инициализация состояний ячеек
function initCells() {
  for (let i = 1; i <= CELL_COUNT; i++) {
    state.cells[i] = {
      mode: 'live', // 'live' | 'archive'
      position: null, // время в секундах для archive
    };
  }
}

// Форматирование времени HH:MM:SS
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map(n => n.toString().padStart(2, '0')).join(':');
}

// Обновление отображения статуса ячейки
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

// Переключение активной ячейки
function setActiveCell(cellId) {
  document.querySelectorAll('.cell').forEach(el => {
    el.classList.remove('active');
  });

  if (cellId) {
    const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
    if (cell) cell.classList.add('active');
  }

  state.activeCellId = cellId;
}

// Переключение ячеек на Live (кроме указанных в excludeIds)
function switchOthersToLive(excludeIds = []) {
  for (let i = 1; i <= CELL_COUNT; i++) {
    if (excludeIds.includes(i)) continue;
    state.cells[i].mode = 'live';
    state.cells[i].position = null;
    updateCellStatus(i);
  }
}

// Go Live для одной ячейки (кнопка внутри ячейки)
function handleCellGoLive(e) {
  e.stopPropagation();
  const btn = e.target.closest('.cell-go-live');
  if (!btn || state.syncEnabled) return;
  const cellId = parseInt(btn.dataset.cellId, 10);
  state.cells[cellId].mode = 'live';
  state.cells[cellId].position = null;
  updateCellStatus(cellId);
}

// Время по умолчанию при переходе в архив (середина первого блока — 01:00:00)
const DEFAULT_ARCHIVE_TIME = 3600;

// Go Archive: выделяет ячейку, переводит в архив на время по умолчанию, при sync — отключает синхронизацию
function handleCellGoArchive(e) {
  e.stopPropagation();
  const btn = e.target.closest('.cell-go-archive');
  if (!btn) return;
  const cellId = parseInt(btn.dataset.cellId, 10);
  setActiveCell(cellId);
  if (state.syncEnabled) {
    state.syncEnabled = false;
    const syncToggle = document.getElementById('sync-toggle');
    if (syncToggle) syncToggle.checked = false;
    updateSyncState();
  }
  // Переводим ячейку в режим архива на конкретное время
  state.cells[cellId].mode = 'archive';
  state.cells[cellId].position = DEFAULT_ARCHIVE_TIME;
  updateCellStatus(cellId);
  // Выделяем соответствующий блок на таймлайне
  updateTimelineActiveBlock(DEFAULT_ARCHIVE_TIME);
}

function updateTimelineActiveBlock(time) {
  const blocks = document.querySelectorAll('.recording-block');
  blocks.forEach(block => {
    const start = parseInt(block.dataset.start, 10);
    const end = parseInt(block.dataset.end, 10);
    block.classList.toggle('active', time >= start && time < end);
  });
}

// Обработка клика по ячейке
function handleCellClick(e) {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  if (e.target.closest('.cell-go-live') || e.target.closest('.cell-go-archive')) return;

  const cellId = parseInt(cell.dataset.cellId, 10);

  if (state.syncEnabled) {
    // При синхронизации просто выбираем ячейку, без переключения на Live
    setActiveCell(cellId);
    return;
  }

  // Без синхронизации: при выборе другой ячейки предыдущая → Live
  if (state.activeCellId && state.activeCellId !== cellId) {
    state.cells[state.activeCellId].mode = 'live';
    state.cells[state.activeCellId].position = null;
    updateCellStatus(state.activeCellId);
  }

  setActiveCell(cellId);
}

// Создание таймлайна с записями
// Каждый блок = сегмент записи, привязанный к времени
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

// Обработка клика по таймлайну
function handleTimelineClick(e) {
  const block = e.target.closest('.recording-block');
  if (!block) return;

  const time = parseInt(block.dataset.time, 10);

  document.querySelectorAll('.recording-block').forEach(b => b.classList.remove('active'));
  block.classList.add('active');

  if (state.syncEnabled) {
    // Синхронизация: все ячейки переключаются на это время
    for (let i = 1; i <= CELL_COUNT; i++) {
      state.cells[i].mode = 'archive';
      state.cells[i].position = time;
      updateCellStatus(i);
    }
    setActiveCell(null); // снимаем выделение с ячейки при sync
  } else {
    // Без синхронизации: только активная ячейка
    if (state.activeCellId) {
      state.cells[state.activeCellId].mode = 'archive';
      state.cells[state.activeCellId].position = time;
      updateCellStatus(state.activeCellId);
    }
  }
}

// Go Live (над таймлайном): всегда переводит все ячейки в Live и включает синхронизацию
function handleGoLive() {
  for (let i = 1; i <= CELL_COUNT; i++) {
    state.cells[i].mode = 'live';
    state.cells[i].position = null;
    updateCellStatus(i);
  }
  setActiveCell(null);
  state.syncEnabled = true;
  const syncToggle = document.getElementById('sync-toggle');
  if (syncToggle) syncToggle.checked = true;
  updateSyncState();
  document.querySelectorAll('.recording-block').forEach(b => b.classList.remove('active'));
}

// Обновление видимости кнопок Go Live в ячейках и подсказки
function updateSyncState() {
  document.body.classList.toggle('sync-enabled', state.syncEnabled);
  updateSyncHint();
}

// Обновление подсказки при переключении тогла
function updateSyncHint() {
  const text = document.querySelector('.toggle-text');
  if (text) {
    text.title = state.syncEnabled
      ? 'Клик по записи переключает все ячейки на это время'
      : 'Выберите ячейку, затем кликните по записи. При выборе другой ячейки — предыдущая перейдёт в Live';
  }
}

function init() {
  initCells();

  document.querySelectorAll('.cell').forEach(cell => {
    cell.addEventListener('click', handleCellClick);
  });

  const goLiveBtn = document.getElementById('go-live-btn');
  if (goLiveBtn) {
    goLiveBtn.addEventListener('click', handleGoLive);
  }

  const syncToggle = document.getElementById('sync-toggle');
  document.querySelectorAll('.cell-go-live').forEach(btn => {
    btn.addEventListener('click', handleCellGoLive);
  });

  document.querySelectorAll('.cell-go-archive').forEach(btn => {
    btn.addEventListener('click', handleCellGoArchive);
  });

  if (syncToggle) {
    syncToggle.addEventListener('change', () => {
      state.syncEnabled = syncToggle.checked;
      updateSyncState();

      if (!state.syncEnabled && state.activeCellId) {
        // При выключении синхронизации остальные ячейки → Live
        switchOthersToLive([state.activeCellId]);
      }
    });
  }

  createTimelineRuler();
  createTimelineRecordings();

  const timeline = document.getElementById('timeline-recordings');
  if (timeline) {
    timeline.addEventListener('click', handleTimelineClick);
  }

  updateSyncState();

  // Начальное отображение статусов
  for (let i = 1; i <= CELL_COUNT; i++) {
    updateCellStatus(i);
  }
}

document.addEventListener('DOMContentLoaded', init);
