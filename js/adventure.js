import {
  gameState,
  addInventoryItem,
  addFragment,
  unlockAchievement
} from "./state.js";
import { updateHUD } from "./ui.js";

export function initDialogue(chapter, onDone) {
  const npc = chapter.npc;
  document.getElementById("npc-portrait").src = npc.portrait;
  document.getElementById("npc-name").textContent = npc.character;
  document.getElementById("npc-text").textContent = npc.greeting;
  gameState.dialoguesRead.add(npc.greeting);

  const firefly = document.getElementById("firefly-hint");
  if (npc.fireflyHint) {
    firefly.textContent = npc.fireflyHint;
    firefly.classList.remove("hidden");
    gameState.dialoguesRead.add(npc.fireflyHint);
  } else {
    firefly.classList.add("hidden");
  }

  const choicesEl = document.getElementById("dialogue-choices");
  const responseEl = document.getElementById("npc-response");
  const continueBtn = document.getElementById("btn-dialogue-continue");
  choicesEl.innerHTML = "";
  responseEl.classList.add("hidden");
  continueBtn.classList.add("hidden");

  npc.choices.forEach((choice) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-secondary choice-btn";
    btn.textContent = choice.label;
    btn.addEventListener("click", () => {
      gameState.choicesMade.add(choice.id);
      gameState.dialoguesRead.add(choice.response);
      responseEl.textContent = choice.response;
      responseEl.classList.remove("hidden");
      choicesEl.innerHTML = "";
      continueBtn.classList.remove("hidden");
      if (gameState.choicesMade.size >= 2) unlockAchievement("storyExplorer");
    });
    choicesEl.appendChild(btn);
  });

  continueBtn.onclick = () => onDone();
}

let boatCleanup = null;

export function stopBoat() {
  if (boatCleanup) {
    boatCleanup();
    boatCleanup = null;
  }
}

export function initBoat(chapter, onDone) {
  stopBoat();
  const cfg = chapter.boat;
  const gameArea = document.getElementById("boat-game");
  document.getElementById("boat-title").textContent = cfg.title;
  document.getElementById("boat-hint").textContent = cfg.hint;
  const player = document.getElementById("boat-player");
  const starsLayer = document.getElementById("boat-stars-layer");
  const rocksLayer = document.getElementById("boat-rocks-layer");
  const stats = document.getElementById("boat-stats");

  const starsData = cfg.stars;
  const rocksData = cfg.rocks;
  const goal = cfg.goal;
  const starsNeeded = cfg.goalStars || 3;

  let px = 50;
  let py = 84;
  let stars = 0;
  let timeLeft = cfg.timeLimit;
  let running = true;
  const collected = new Set();

  const BOAT_RADIUS = 20;
  const ROCK_RADIUS = 24;
  const STAR_PICKUP = 38;
  const GOAL_RADIUS = 45;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  player.style.left = `${px}%`;
  player.style.top = `${py}%`;

  starsLayer.innerHTML = "";
  starsData.forEach((star, i) => {
    const el = document.createElement("div");
    el.className = "boat-star";
    el.style.left = `${star.x}%`;
    el.style.top = `${star.y}%`;
    el.textContent = "⭐";
    el.dataset.id = String(i);
    starsLayer.appendChild(el);
  });

  rocksLayer.innerHTML = "";
  rocksData.forEach((rock) => {
    const el = document.createElement("div");
    el.className = "boat-rock";
    el.style.left = `${rock.x}%`;
    el.style.top = `${rock.y}%`;
    rocksLayer.appendChild(el);
  });

  const goalEl = document.getElementById("boat-goal");
  goalEl.style.left = `${goal.x}%`;
  goalEl.style.top = `${goal.y}%`;

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function boatPixelAt(nx, ny) {
    const area = gameArea.getBoundingClientRect();
    return {
      x: area.left + (nx / 100) * area.width,
      y: area.top + (ny / 100) * area.height
    };
  }

  function hitsRockAt(nx, ny) {
    const boatPt = boatPixelAt(nx, ny);
    return [...rocksLayer.querySelectorAll(".boat-rock")].some((rock) => {
      return distance(boatPt, centerOf(rock)) < BOAT_RADIUS + ROCK_RADIUS;
    });
  }

  function updateStats() {
    stats.textContent =
      `Crystal Stars: ${stars}/${starsNeeded} collected (${starsData.length} on lake) | Time: ${timeLeft}s`;
  }
  updateStats();

  function collectStars() {
    const boatCenter = centerOf(player);
    starsLayer.querySelectorAll(".boat-star").forEach((s) => {
      const id = s.dataset.id;
      if (collected.has(id)) return;
      if (distance(boatCenter, centerOf(s)) <= STAR_PICKUP) {
        collected.add(id);
        s.remove();
        stars += 1;
        gameState.score += 15;
        updateStats();
      }
    });
  }

  function checkGoal() {
    if (stars < starsNeeded) return;
    if (distance(centerOf(player), centerOf(goalEl)) <= GOAL_RADIUS) {
      running = false;
      stopBoat();
      gameState.score += 30;
      addInventoryItem("pearl", "Pearl", "🫧");
      updateHUD();
      setTimeout(onDone, 800);
    }
  }

  function applyPosition(nx, ny) {
    px = nx;
    py = ny;
    player.style.left = `${px}%`;
    player.style.top = `${py}%`;
    collectStars();
    checkGoal();
  }

  function move(dx, dy) {
    if (!running) return;

    const targetX = clamp(px + dx, 8, 92);
    const targetY = clamp(py + dy, 12, 88);

    if (!hitsRockAt(targetX, targetY)) {
      applyPosition(targetX, targetY);
      return;
    }

    const slideX = clamp(px + dx, 8, 92);
    if (dx !== 0 && !hitsRockAt(slideX, py)) {
      applyPosition(slideX, py);
      return;
    }

    const slideY = clamp(py + dy, 12, 88);
    if (dy !== 0 && !hitsRockAt(px, slideY)) {
      applyPosition(px, slideY);
      return;
    }

    timeLeft = Math.max(0, timeLeft - 2);
    updateStats();
  }

  document.querySelectorAll(".boat-btn").forEach((btn) => {
    btn.onclick = () => {
      const d = btn.dataset.dir;
      if (d === "up") move(0, -3.5);
      if (d === "down") move(0, 3.5);
      if (d === "left") move(-3.5, 0);
      if (d === "right") move(3.5, 0);
    };
  });

  const keyHandler = (e) => {
    if (!running) return;
    const delta = getBoatMove(e);
    if (!delta) return;
    e.preventDefault();
    if (e.repeat) return;
    move(delta[0], delta[1]);
  };

  function getBoatMove(e) {
    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
        return [0, -3.5];
      case "ArrowDown":
      case "KeyS":
        return [0, 3.5];
      case "ArrowLeft":
      case "KeyA":
        return [-3.5, 0];
      case "ArrowRight":
      case "KeyD":
        return [3.5, 0];
      default:
        return null;
    }
  }

  document.addEventListener("keydown", keyHandler, true);

  const timer = setInterval(() => {
    if (!running) return;
    timeLeft -= 1;
    updateStats();
    if (timeLeft <= 0) {
      running = false;
      clearInterval(timer);
      stopBoat();
      stats.textContent = `Time up! Collect any ${starsNeeded} stars, then reach the center goal.`;
      setTimeout(() => initBoat(chapter, onDone), 1500);
    }
  }, 1000);

  boatCleanup = () => {
    running = false;
    clearInterval(timer);
    document.removeEventListener("keydown", keyHandler, true);
  };
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function initBoss(bossData, onWin) {
  document.getElementById("boss-intro").textContent = bossData.intro;

  const perRound = bossData.questionsPerRound || 5;
  const passRequired = bossData.passRequired || 4;

  let roundQuestions = [];
  let qIndex = 0;
  let correct = 0;

  function startRound() {
    roundQuestions = shuffleArray(bossData.questions).slice(0, perRound);
    qIndex = 0;
    correct = 0;
    showQuestion();
  }

  function showQuestion() {
    if (qIndex >= roundQuestions.length) {
      if (correct >= passRequired) {
        onWin();
      } else {
        document.getElementById("boss-feedback").textContent =
          `${bossData.failure} You got ${correct}/${perRound}. Need ${passRequired} correct. New questions coming...`;
        document.getElementById("boss-feedback").className = "boss-feedback error";
        setTimeout(startRound, 2800);
      }
      return;
    }

    const q = roundQuestions[qIndex];
    const shuffledOptions = shuffleArray(q.options);

    document.getElementById("boss-question").textContent = q.text;
    document.getElementById("boss-progress").textContent =
      `Question ${qIndex + 1} of ${perRound} · Score ${correct} correct so far`;
    document.getElementById("boss-feedback").textContent = "";
    document.getElementById("boss-feedback").className = "boss-feedback";

    const opts = document.getElementById("boss-options");
    opts.innerHTML = shuffledOptions
      .map((o) => `<button type="button" class="btn btn-secondary boss-opt">${o}</button>`)
      .join("");

    opts.querySelectorAll(".boss-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        opts.querySelectorAll(".boss-opt").forEach((b) => { b.disabled = true; });

        gameState.dialoguesRead.add(q.storyKey);
        if (btn.textContent === q.answer) {
          correct += 1;
          gameState.score += 25;
          document.getElementById("boss-feedback").textContent = "Correct!";
          document.getElementById("boss-feedback").className = "boss-feedback success";
        } else {
          document.getElementById("boss-feedback").textContent = `Wrong. Answer: ${q.answer}`;
          document.getElementById("boss-feedback").className = "boss-feedback error";
        }
        qIndex += 1;
        setTimeout(showQuestion, 1400);
      });
    });
  }

  startRound();
}

export function showStoryScene(chapter, onDone) {
  document.getElementById("story-scene-title").textContent = chapter.storyScene.title;
  document.getElementById("story-scene-text").textContent = chapter.storyScene.text;
  gameState.dialoguesRead.add(chapter.storyScene.text);
  document.getElementById("btn-story-continue").onclick = () => onDone();
}
