import { gameState, addInventoryItem } from "./state.js";
import { updateHUD } from "./ui.js";

let cleanup = null;
let mazeActive = false;
let lastMoveTime = 0;
const MOVE_COOLDOWN_MS = 120;

/** Arrow keys + WASD (W=up, A=left, S=down, D=right on keyboard) */
function getMoveFromKey(e) {
  switch (e.code) {
    case "ArrowUp":
    case "KeyW":
      return [0, -1];
    case "ArrowDown":
    case "KeyS":
      return [0, 1];
    case "ArrowLeft":
    case "KeyA":
      return [-1, 0];
    case "ArrowRight":
    case "KeyD":
      return [1, 0];
    default:
      return null;
  }
}

function normalizeGrid(rows) {
  const width = Math.max(...rows.map((row) => row.length));
  return rows.map((row) => {
    if (row.length < width) {
      return row + "#".repeat(width - row.length);
    }
    return row;
  });
}

function parseGrid(rows, collectibles) {
  const normalized = normalizeGrid(rows);
  const grid = normalized.map((row) => row.split(""));
  let player = { x: 0, y: 0 };
  const items = [];
  const collectibleMap = {};
  collectibles.forEach((c, i) => {
    collectibleMap[String.fromCharCode(65 + i)] = c;
  });

  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const cell = grid[y][x];
      if (cell === "P") {
        player = { x, y };
        grid[y][x] = ".";
      } else if (collectibleMap[cell]) {
        items.push({ ...collectibleMap[cell], x, y, collected: false, marker: cell });
        grid[y][x] = ".";
      }
    }
  }
  return { grid, player, items };
}

function renderMaze(container, grid, player, items) {
  container.innerHTML = "";
  container.style.gridTemplateColumns = `repeat(${grid[0].length}, 1fr)`;

  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const cell = document.createElement("div");
      cell.className = "maze-cell";

      if (grid[y][x] === "#") {
        cell.classList.add("wall");
      } else {
        cell.classList.add("path");
        const item = items.find((i) => !i.collected && i.x === x && i.y === y);
        if (player.x === x && player.y === y) {
          cell.classList.add("player");
          cell.textContent = "🧚";
        } else if (item) {
          cell.classList.add("collectible");
          cell.textContent = item.icon;
          cell.title = item.name;
        }
      }
      container.appendChild(cell);
    }
  }
}

export function stopMaze() {
  mazeActive = false;
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
}

export function initMaze(config, onDone) {
  stopMaze();
  mazeActive = true;
  lastMoveTime = 0;

  document.getElementById("maze-title").textContent = config.title;
  document.getElementById("maze-hint").textContent =
    config.hint ||
    "Use Arrow Keys (↑ ↓ ← →) or W A S D keys to move one step at a time.";

  const container = document.getElementById("maze-grid");
  const statsEl = document.getElementById("maze-stats");
  const { grid, player, items } = parseGrid(config.grid, config.collectibles);
  const collected = new Set();
  let px = player.x;
  let py = player.y;
  let finished = false;

  const updateStats = () => {
    statsEl.textContent = `Collected: ${collected.size} / ${items.length}`;
  };
  updateStats();
  renderMaze(container, grid, { x: px, y: py }, items);

  function tryMove(dx, dy) {
    if (!mazeActive || finished) return;

    const nx = px + dx;
    const ny = py + dy;
    if (ny < 0 || ny >= grid.length || nx < 0 || nx >= grid[0].length) return;
    if (grid[ny][nx] === "#") return;

    px = nx;
    py = ny;

    const item = items.find((i) => !i.collected && i.x === px && i.y === py);
    if (item) {
      item.collected = true;
      collected.add(item.id);
      addInventoryItem(item.id, item.name, item.icon);
      gameState.score += 15;
      updateHUD();
      updateStats();

      if (collected.size >= items.length) {
        finished = true;
        gameState.score += 30;
        stopMaze();
        setTimeout(onDone, 600);
      }
    }

    renderMaze(container, grid, { x: px, y: py }, items);
  }

  function handleMoveInput(dx, dy) {
    const now = Date.now();
    if (now - lastMoveTime < MOVE_COOLDOWN_MS) return;
    lastMoveTime = now;
    tryMove(dx, dy);
  }

  const onKey = (e) => {
    if (!mazeActive || finished) return;

    const move = getMoveFromKey(e);
    if (!move) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.repeat) return;

    handleMoveInput(move[0], move[1]);
  };

  document.addEventListener("keydown", onKey, true);

  document.querySelectorAll(".maze-btn").forEach((btn) => {
    btn.onclick = () => {
      const d = btn.dataset.dir;
      if (d === "up") handleMoveInput(0, -1);
      if (d === "down") handleMoveInput(0, 1);
      if (d === "left") handleMoveInput(-1, 0);
      if (d === "right") handleMoveInput(1, 0);
    };
  });

  cleanup = () => {
    document.removeEventListener("keydown", onKey, true);
    mazeActive = false;
  };
}
