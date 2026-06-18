const STORAGE_KEY = "lunaAdventureSave";

export const ACHIEVEMENTS = {
  perfectMemory: { id: "perfectMemory", name: "Perfect Memory", desc: "Complete a memory challenge without losing a life" },
  speedRunner: { id: "speedRunner", name: "Speed Runner", desc: "Finish a memory challenge under 3 minutes" },
  storyExplorer: { id: "storyExplorer", name: "Story Explorer", desc: "Read all NPC dialogues and choices" }
};

export const gameState = {
  chapters: [],
  bossData: null,
  currentChapterIndex: 0,
  currentPhase: "start",
  score: 0,
  totalSeconds: 0,
  chapterSeconds: 0,
  inventory: [],
  fragments: [],
  powerUps: { hint: 3, freeze: 3, reveal: 3 },
  lives: 5,
  maxLives: 5,
  dialoguesRead: new Set(),
  choicesMade: new Set(),
  achievements: new Set(),
  exploredHotspots: new Set(),
  memoryMistakes: 0,
  memoryStartTime: 0,
  npcDone: false,
  phaseFlags: {},
  bossQuestionIndex: 0,
  bossCorrect: 0
};

export function resetGameState() {
  gameState.currentChapterIndex = 0;
  gameState.currentPhase = "intro";
  gameState.score = 0;
  gameState.totalSeconds = 0;
  gameState.inventory = [];
  gameState.fragments = [];
  gameState.powerUps = { hint: 3, freeze: 3, reveal: 3 };
  gameState.lives = 5;
  gameState.maxLives = 5;
  gameState.dialoguesRead = new Set();
  gameState.choicesMade = new Set();
  gameState.achievements = new Set();
  gameState.exploredHotspots = new Set();
  gameState.memoryMistakes = 0;
  gameState.npcDone = false;
  gameState.phaseFlags = {};
  gameState.bossQuestionIndex = 0;
  gameState.bossCorrect = 0;
}

export function getChapter() {
  return gameState.chapters[gameState.currentChapterIndex];
}

export function addInventoryItem(id, name, icon) {
  if (gameState.inventory.some((i) => i.id === id)) return;
  gameState.inventory.push({ id, name, icon: icon || "📦" });
}

export function hasInventoryItem(id) {
  return gameState.inventory.some((i) => i.id === id);
}

export function addFragment(name) {
  if (!gameState.fragments.includes(name)) {
    gameState.fragments.push(name);
  }
}

export function unlockAchievement(id) {
  gameState.achievements.add(id);
  saveProgress();
}

export function getBestScore() {
  return Number(localStorage.getItem(STORAGE_KEY + "_best") || 0);
}

export function saveBestScore(v) {
  localStorage.setItem(STORAGE_KEY + "_best", String(v));
}

export function saveProgress() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      achievements: [...gameState.achievements],
      bestScore: getBestScore()
    })
  );
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.achievements) data.achievements.forEach((a) => gameState.achievements.add(a));
  } catch (_) {}
}

export const CHAPTER1_PHASES = [
  "intro",
  "explore",
  "dialogue",
  "memory",
  "story",
  "chapterComplete"
];

export const CHAPTER2_PHASES = [
  "intro",
  "boat",
  "maze",
  "dialogue",
  "memory",
  "story",
  "chapterComplete"
];

export function getPhaseList() {
  return gameState.currentChapterIndex === 0 ? CHAPTER1_PHASES : CHAPTER2_PHASES;
}

export function advancePhase() {
  const phases = getPhaseList();
  const idx = phases.indexOf(gameState.currentPhase);
  if (idx < phases.length - 1) {
    gameState.currentPhase = phases[idx + 1];
    return gameState.currentPhase;
  }
  if (gameState.currentChapterIndex < gameState.chapters.length - 1) {
    gameState.currentChapterIndex += 1;
    gameState.currentPhase = "intro";
    return "intro";
  }
  gameState.currentPhase = "boss";
  return "boss";
}

export function getPhaseLabel(phase) {
  const labels = {
    intro: "Chapter Introduction",
    explore: "Forest Maze",
    maze: "Lake Maze",
    dialogue: "NPC Conversation",
    memory: "Memory Match Challenge",
    story: "Story Scene",
    boat: "Boat Navigation",
    chapterComplete: "Chapter Complete",
    boss: "Final Boss — Memory Guardian"
  };
  return labels[phase] || phase;
}
