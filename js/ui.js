import { gameState, ACHIEVEMENTS } from "./state.js";

const screens = {};

export function initScreens() {
  document.querySelectorAll(".screen").forEach((el) => {
    screens[el.id.replace("screen-", "")] = el;
  });
}

export function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  const screen = screens[name];
  if (screen) screen.classList.add("active");

  const hud = document.getElementById("game-hud");
  const adventureScreens = [
    "maze", "dialogue", "game", "story", "boat", "boss"
  ];
  hud.classList.toggle("hidden", !adventureScreens.includes(name));
}

export function updateHUD() {
  const inv = document.getElementById("hud-inventory");
  inv.innerHTML = gameState.inventory.length
    ? gameState.inventory.map((i) => `<li>${i.icon} ${i.name}</li>`).join("")
    : "<li class='empty'>Empty</li>";

  const frags = document.getElementById("hud-fragments");
  frags.innerHTML = gameState.fragments.length
    ? gameState.fragments.map((f) => `<li>✦ ${f}</li>`).join("")
    : "<li class='empty'>None yet</li>";

  const pups = document.getElementById("hud-powerups");
  pups.innerHTML = `
    <button type="button" class="powerup-btn" data-powerup="hint" title="Owl Hint">🦉 Hint (${gameState.powerUps.hint})</button>
    <button type="button" class="powerup-btn" data-powerup="freeze" title="Time Freeze">❄️ Freeze (${gameState.powerUps.freeze})</button>
    <button type="button" class="powerup-btn" data-powerup="reveal" title="Reveal Spell">✨ Reveal (${gameState.powerUps.reveal})</button>
  `;

  const livesWrap = document.getElementById("hud-lives-wrap");
  const livesEl = document.getElementById("hud-lives");
  if (gameState.currentPhase === "memory") {
    livesWrap.classList.remove("hidden");
    const max = gameState.maxLives || 5;
    livesEl.textContent = "♥".repeat(gameState.lives) + "♡".repeat(Math.max(0, max - gameState.lives));
  } else {
    livesWrap.classList.add("hidden");
  }
}

export function renderAchievements(containerId, preview = false) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const unlocked = gameState.achievements;
  el.innerHTML = Object.values(ACHIEVEMENTS)
    .map((a) => {
      const on = unlocked.has(a.id);
      return `<div class="achievement ${on ? "unlocked" : "locked"}">
        <span class="achievement-icon">${on ? "🏆" : "🔒"}</span>
        <span class="achievement-name">${a.name}</span>
        ${preview ? "" : `<span class="achievement-desc">${a.desc}</span>`}
      </div>`;
    })
    .join("");
}

export function showStoryPopup(text, isUnlock = false) {
  const popup = document.getElementById("story-popup");
  const dialogue = document.getElementById("story-dialogue");
  dialogue.textContent = text;
  popup.querySelector(".story-label").textContent = isUnlock ? "Memory Unlocked" : "Story";
  popup.classList.remove("pop");
  void popup.offsetWidth;
  popup.classList.add("pop");
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function renderStars(container, count) {
  container.innerHTML = "";
  for (let i = 1; i <= 3; i += 1) {
    const star = document.createElement("span");
    star.className = `star${i <= count ? " active" : ""}`;
    star.textContent = "★";
    container.appendChild(star);
  }
}

export { screens };
