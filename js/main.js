import {
  gameState,
  resetGameState,
  getChapter,
  advancePhase,
  getPhaseLabel,
  loadProgress,
  saveBestScore,
  getBestScore,
  saveProgress,
  addFragment
} from "./state.js";
import {
  initScreens,
  showScreen,
  updateHUD,
  renderAchievements,
  renderStars,
  formatTime
} from "./ui.js";
import {
  initDialogue,
  initBoat,
  stopBoat,
  initBoss,
  showStoryScene
} from "./adventure.js";
import { initMaze, stopMaze } from "./maze.js";
import { startMemory, stopMemory, retryMemory, usePowerUp } from "./memory.js";

const sounds = {
  bgMusic: createAudio("assets/sounds/bg-music.mp3", 0.22, true),
  chapterComplete: createAudio("assets/sounds/chapter-complete.mp3", 0.7),
  gameComplete: createAudio("assets/sounds/game-complete.mp3", 0.7)
};

function createAudio(src, vol, loop = false) {
  const a = new Audio(src);
  a.volume = vol;
  a.loop = loop;
  return a;
}

function playSound(s) {
  s.currentTime = 0;
  s.play().catch(() => {});
}

function setChapterBackground(chapter) {
  const bg = `linear-gradient(rgba(15,23,42,0.4), rgba(15,23,42,0.6)), url("${chapter.background}")`;
  ["maze", "game", "boat"].forEach((id) => {
    const el = document.getElementById(`screen-${id}`);
    if (el) el.style.backgroundImage = bg;
  });
}

function runCurrentPhase() {
  const chapter = getChapter();
  if (!chapter) return;
  setChapterBackground(chapter);
  updateHUD();

  const phase = gameState.currentPhase;
  document.getElementById("phase-indicator").textContent = getPhaseLabel(phase);

  switch (phase) {
    case "intro":
      showChapterIntro();
      break;
    case "explore":
      showScreen("maze");
      initMaze(chapter.forestMaze, () => {
        advancePhase();
        runCurrentPhase();
      });
      break;
    case "maze":
      showScreen("maze");
      initMaze(chapter.lakeMaze, () => {
        advancePhase();
        runCurrentPhase();
      });
      break;
    case "dialogue":
      showScreen("dialogue");
      initDialogue(chapter, () => { advancePhase(); runCurrentPhase(); });
      break;
    case "memory":
      showScreen("game");
      startMemory(chapter.memory, {
        onComplete: () => {
          stopMemory();
          gameState.score += 50;
          advancePhase();
          runCurrentPhase();
        },
        onGameOver: () => {
          stopMemory();
          showScreen("gameover");
        }
      });
      break;
    case "story":
      showScreen("story");
      showStoryScene(chapter, () => {
        addFragment(chapter.fragmentName);
        updateHUD();
        advancePhase();
        runCurrentPhase();
      });
      break;
    case "boat":
      showScreen("boat");
      initBoat(chapter, () => { advancePhase(); runCurrentPhase(); });
      break;
    case "chapterComplete":
      showChapterComplete();
      break;
    case "boss":
      showScreen("boss");
      initBoss(gameState.bossData, () => showFinalScreen(true));
      break;
    default:
      break;
  }
}

function showChapterIntro() {
  const chapter = getChapter();
  document.getElementById("intro-chapter-num").textContent = chapter.id;
  document.getElementById("intro-chapter-title").textContent = chapter.title;
  document.getElementById("intro-chapter-text").textContent = chapter.intro;
  document.getElementById("phase-indicator").textContent = getPhaseLabel(gameState.currentPhase);

  const overlay = document.querySelector("#screen-chapter-intro .screen-overlay");
  overlay.style.backgroundImage =
    `linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.75)), url("${chapter.background}")`;
  showScreen("chapter-intro");
}

function showChapterComplete() {
  stopMaze();
  stopBoat();
  playSound(sounds.chapterComplete);
  const chapter = getChapter();
  document.getElementById("chapter-complete-title").textContent = chapter.title;
  document.getElementById("fragment-collected-name").textContent = chapter.fragmentName;
  document.getElementById("chapter-ending-text").textContent = chapter.ending;
  document.getElementById("chapter-score").textContent = gameState.score;
  document.getElementById("total-score-chapter").textContent = gameState.score;
  renderStars(document.getElementById("chapter-stars"), 2);

  const isLast = gameState.currentChapterIndex >= gameState.chapters.length - 1;
  document.getElementById("btn-next-chapter").textContent =
    isLast ? "Face the Memory Guardian" : "Continue to Chapter 2";

  showScreen("chapter-complete");
}

function showFinalScreen(bossSuccess) {
  playSound(sounds.gameComplete);
  const last = gameState.chapters[gameState.chapters.length - 1];

  document.getElementById("final-ending-text").textContent = bossSuccess
    ? gameState.bossData.success
    : last.ending;
  document.getElementById("final-message").textContent = last.finalMessage || "";
  document.getElementById("final-score").textContent = gameState.score;
  document.getElementById("final-time").textContent = formatTime(gameState.totalSeconds);

  const best = Math.max(getBestScore(), gameState.score);
  saveBestScore(best);
  document.getElementById("final-best-score").textContent = best;

  document.getElementById("final-fragments-display").innerHTML =
    gameState.fragments.map((f) => `<span class="fragment-badge">✦ ${f}</span>`).join("");

  renderStars(document.getElementById("final-stars"), bossSuccess ? 3 : 2);
  renderAchievements("achievements-final");
  saveProgress();
  showScreen("final");
}

function bindEvents() {
  document.getElementById("btn-start").addEventListener("click", () => {
    resetGameState();
    sounds.bgMusic.play().catch(() => {});
    gameState.currentPhase = "intro";
    runCurrentPhase();
  });

  document.getElementById("btn-continue-chapter").addEventListener("click", () => {
    advancePhase();
    runCurrentPhase();
  });

  document.getElementById("btn-next-chapter").addEventListener("click", () => {
    if (gameState.currentChapterIndex >= gameState.chapters.length - 1) {
      gameState.currentPhase = "boss";
      runCurrentPhase();
      return;
    }
    advancePhase();
    runCurrentPhase();
  });

  document.getElementById("btn-retry-memory").addEventListener("click", () => {
    const chapter = getChapter();
    gameState.lives = chapter.memory.lives || 5;
    gameState.maxLives = gameState.lives;
    gameState.memoryMistakes = 0;
    showScreen("game");
    retryMemory(chapter.memory, {
      onComplete: () => {
        stopMemory();
        advancePhase();
        runCurrentPhase();
      },
      onGameOver: () => showScreen("gameover")
    });
  });

  document.getElementById("btn-restart-game").addEventListener("click", () => {
    sounds.bgMusic.pause();
    sounds.bgMusic.currentTime = 0;
    stopMaze();
    resetGameState();
    gameState.currentPhase = "intro";
    runCurrentPhase();
  });

  document.getElementById("btn-play-again").addEventListener("click", () => {
    sounds.bgMusic.pause();
    sounds.bgMusic.currentTime = 0;
    stopMaze();
    resetGameState();
    gameState.currentPhase = "intro";
    document.getElementById("best-score-display").textContent = getBestScore();
    renderAchievements("achievements-preview", true);
    showScreen("start");
  });

  document.addEventListener("hud-update", updateHUD);

  document.getElementById("hud-powerups").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-powerup]");
    if (!btn) return;
    usePowerUp(btn.dataset.powerup);
    updateHUD();
  });
}

async function init() {
  initScreens();
  loadProgress();
  document.getElementById("best-score-display").textContent = getBestScore();
  renderAchievements("achievements-preview", true);
  bindEvents();

  try {
    const [chRes, bossRes] = await Promise.all([
      fetch("data/chapters.json"),
      fetch("data/boss.json")
    ]);
    gameState.chapters = await chRes.json();
    gameState.bossData = await bossRes.json();
  } catch (err) {
    console.error(err);
    alert("Load game data via a local server (python -m http.server 8080)");
  }
}

init();
