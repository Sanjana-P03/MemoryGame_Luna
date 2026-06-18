import { gameState, unlockAchievement } from "./state.js";
import { showStoryPopup, formatTime } from "./ui.js";

const sounds = {
  flip: createAudio("assets/sounds/flip.mp3", 0.5),
  match: createAudio("assets/sounds/match.mp3", 0.6),
  wrong: createAudio("assets/sounds/wrong.mp3", 0.5)
};

let deck = [];
let flipped = [];
let matchedPairIds = new Set();
let moves = 0;
let chapterSeconds = 0;
let timerId = null;
let flipTimerId = null;
let flipIntervalId = null;
let freezeUntil = 0;
let boardLocked = false;
let previewActive = false;
let memoryConfig = null;
let onComplete = null;
let onGameOver = null;
let gridClickHandler = null;

function createAudio(src, vol) {
  const a = new Audio(src);
  a.volume = vol;
  return a;
}

function playSound(s) {
  s.currentTime = 0;
  s.play().catch(() => {});
}

function shuffle(arr) {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

function buildDeck(config) {
  const cards = [];
  config.pairs.forEach((pair) => {
    pair.cards.forEach((card, ci) => {
      cards.push({
        ...card,
        pairId: pair.pairId,
        dialogue: pair.dialogue,
        uid: `${pair.pairId}-${ci}`
      });
    });
  });
  return shuffle(cards);
}

function formatLives() {
  const max = gameState.maxLives || 5;
  return "♥".repeat(gameState.lives) + "♡".repeat(Math.max(0, max - gameState.lives));
}

function updateMemoryUI() {
  document.getElementById("stat-score").textContent = gameState.score;
  document.getElementById("stat-moves").textContent = moves;
  document.getElementById("stat-pairs").textContent = `${matchedPairIds.size} / ${memoryConfig.pairs.length}`;
  document.getElementById("stat-lives").textContent = formatLives();
  document.getElementById("memory-level-label").textContent = `Level ${memoryConfig.level}`;
  document.dispatchEvent(new Event("hud-update"));
}

function stopTimers() {
  clearInterval(timerId);
  clearTimeout(flipTimerId);
  clearInterval(flipIntervalId);
  timerId = flipTimerId = flipIntervalId = null;
}

function syncBoardInteraction() {
  const canPlay = !boardLocked && !previewActive;
  document.querySelectorAll(".card").forEach((card) => {
    card.classList.toggle("disabled", !canPlay);
  });
}

function startChapterTimer() {
  timerId = setInterval(() => {
    if (Date.now() < freezeUntil) return;
    chapterSeconds += 1;
    gameState.totalSeconds += 1;
    document.getElementById("stat-time").textContent = formatTime(chapterSeconds);
  }, 1000);
}

function renderBoard() {
  const grid = document.getElementById("card-grid");
  grid.innerHTML = "";
  deck.forEach((card, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card";
    btn.dataset.index = String(index);
    btn.setAttribute("aria-label", `Memory card ${index + 1}`);
    btn.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back">
          <img src="assets/images/card-back.svg" alt="">
        </div>
        <div class="card-face card-front">
          <img src="${card.image}" alt="${card.name}">
          <span class="card-label">${card.name}</span>
        </div>
      </div>`;
    grid.appendChild(btn);
  });
  syncBoardInteraction();
}

function startFlipTimer() {
  clearTimeout(flipTimerId);
  clearInterval(flipIntervalId);
  const limit = memoryConfig.flipTimeLimitSeconds;
  if (!limit) return;
  let remaining = limit;
  const wrap = document.getElementById("flip-timer-wrap");
  const bar = document.getElementById("flip-timer-bar");
  const txt = document.getElementById("flip-timer-text");
  wrap.classList.remove("hidden");
  bar.style.width = "100%";
  flipIntervalId = setInterval(() => {
    if (Date.now() < freezeUntil) return;
    remaining = Math.max(0, remaining - 0.1);
    bar.style.width = `${(remaining / limit) * 100}%`;
    txt.textContent = `${remaining.toFixed(1)}s`;
  }, 100);
  flipTimerId = setTimeout(() => {
    if (flipped.length !== 1) return;
    flipped[0].el.classList.remove("flipped");
    flipped = [];
    stopFlipTimer();
    loseLife("Memory faded before you found the pair!");
    if (gameState.lives > 0) {
      boardLocked = false;
      syncBoardInteraction();
    }
  }, limit * 1000);
}

function stopFlipTimer() {
  clearTimeout(flipTimerId);
  clearInterval(flipIntervalId);
  document.getElementById("flip-timer-wrap").classList.add("hidden");
}

function loseLife(msg) {
  gameState.lives -= 1;
  gameState.memoryMistakes += 1;
  gameState.score = Math.max(0, gameState.score - 2);
  playSound(sounds.wrong);
  showStoryPopup(msg || "Wrong match — you lose a life!");
  updateMemoryUI();
  if (gameState.lives <= 0) {
    boardLocked = true;
    syncBoardInteraction();
    stopTimers();
    onGameOver?.();
  }
}

function onCardClick(index) {
  if (boardLocked || previewActive) return;

  const card = deck[index];
  const el = document.querySelector(`.card[data-index="${index}"]`);
  if (!el || el.classList.contains("disabled")) return;
  if (!card || el.classList.contains("flipped") || el.classList.contains("matched")) return;
  if (flipped.length === 1 && flipped[0].index === index) return;

  playSound(sounds.flip);
  el.classList.add("flipped");
  flipped.push({ index, card, el });

  if (flipped.length === 1) {
    startFlipTimer();
    return;
  }

  stopFlipTimer();
  boardLocked = true;
  syncBoardInteraction();
  moves += 1;
  updateMemoryUI();

  const [a, b] = flipped;
  if (a.card.pairId === b.card.pairId) {
    setTimeout(() => {
      playSound(sounds.match);
      a.el.classList.add("matched");
      b.el.classList.add("matched");
      matchedPairIds.add(a.card.pairId);
      gameState.score += 10 + matchedPairIds.size * 2;
      showStoryPopup(a.card.dialogue, true);
      flipped = [];
      boardLocked = false;
      updateMemoryUI();
      syncBoardInteraction();
      if (matchedPairIds.size === memoryConfig.pairs.length) finishMemory(true);
    }, 400);
  } else {
    setTimeout(() => {
      a.el.classList.add("shake");
      b.el.classList.add("shake");
      setTimeout(() => {
        a.el.classList.remove("flipped", "shake");
        b.el.classList.remove("flipped", "shake");
        flipped = [];
        loseLife("Wrong match — you lose a life!");
        if (gameState.lives > 0) {
          boardLocked = false;
          syncBoardInteraction();
        }
      }, 400);
    }, 600);
  }
}

function runPreview() {
  previewActive = true;
  boardLocked = true;
  syncBoardInteraction();
  const banner = document.getElementById("preview-banner");
  const seconds = memoryConfig.previewSeconds || 5;
  banner.classList.remove("hidden");
  banner.textContent = `Memorize the cards... ${seconds}s`;
  document.querySelectorAll(".card").forEach((c) => c.classList.add("flipped"));

  let remaining = seconds;
  const countdown = setInterval(() => {
    remaining -= 1;
    banner.textContent = remaining > 0 ? `Memorize the cards... ${remaining}s` : "Go!";
  }, 1000);

  setTimeout(() => {
    clearInterval(countdown);
    document.querySelectorAll(".card:not(.matched)").forEach((c) => c.classList.remove("flipped"));
    banner.classList.add("hidden");
    previewActive = false;
    boardLocked = false;
    syncBoardInteraction();
    startChapterTimer();
  }, seconds * 1000);
}

function finishMemory(success) {
  stopTimers();
  if (success) {
    gameState.score += 50;
    if (gameState.memoryMistakes === 0) unlockAchievement("perfectMemory");
    if (chapterSeconds < 180) unlockAchievement("speedRunner");
    onComplete?.({ moves, seconds: chapterSeconds });
  }
}

export function usePowerUp(type) {
  if (gameState.currentPhase !== "memory" || !gameState.powerUps[type]) return;

  if (type === "hint") {
    const unmatched = memoryConfig.pairs.find((p) => !matchedPairIds.has(p.pairId));
    if (!unmatched) return;
    gameState.powerUps.hint -= 1;
    deck.forEach((card, i) => {
      if (card.pairId === unmatched.pairId) {
        document.querySelector(`.card[data-index="${i}"]`)?.classList.add("flipped");
      }
    });
    setTimeout(() => {
      deck.forEach((card, i) => {
        if (card.pairId === unmatched.pairId && !matchedPairIds.has(card.pairId)) {
          document.querySelector(`.card[data-index="${i}"]`)?.classList.remove("flipped");
        }
      });
    }, 2000);
  } else if (type === "freeze") {
    gameState.powerUps.freeze -= 1;
    freezeUntil = Date.now() + 10000;
    showStoryPopup("Time Freeze! The timer pauses for 10 seconds.");
  } else if (type === "reveal") {
    gameState.powerUps.reveal -= 1;
    document.querySelectorAll(".card:not(.matched)").forEach((c) => c.classList.add("flipped"));
    setTimeout(() => {
      document.querySelectorAll(".card:not(.matched)").forEach((c) => c.classList.remove("flipped"));
    }, 3000);
  }
  document.dispatchEvent(new Event("hud-update"));
}

function attachGridHandler() {
  const grid = document.getElementById("card-grid");
  if (gridClickHandler) {
    grid.removeEventListener("click", gridClickHandler);
  }
  gridClickHandler = (e) => {
    const card = e.target.closest(".card");
    if (!card || card.classList.contains("disabled")) return;
    const index = Number(card.dataset.index);
    if (Number.isNaN(index)) return;
    onCardClick(index);
  };
  grid.addEventListener("click", gridClickHandler);
}

function detachGridHandler() {
  const grid = document.getElementById("card-grid");
  if (gridClickHandler && grid) {
    grid.removeEventListener("click", gridClickHandler);
    gridClickHandler = null;
  }
}

export function startMemory(config, callbacks) {
  memoryConfig = config;
  onComplete = callbacks.onComplete;
  onGameOver = callbacks.onGameOver;
  gameState.lives = config.lives || 5;
  gameState.maxLives = gameState.lives;
  gameState.memoryMistakes = 0;
  gameState.memoryStartTime = Date.now();
  chapterSeconds = 0;
  moves = 0;
  matchedPairIds = new Set();
  flipped = [];
  boardLocked = false;
  previewActive = false;
  deck = buildDeck(config);

  document.getElementById("difficulty-hint").textContent =
    "Match RELATED pairs, not identical images · 5 lives · Wrong match costs 1 life";

  renderBoard();
  attachGridHandler();
  updateMemoryUI();
  runPreview();
}

export function stopMemory() {
  stopTimers();
  detachGridHandler();
}

export function retryMemory(config, callbacks) {
  stopMemory();
  startMemory(config, callbacks);
}
