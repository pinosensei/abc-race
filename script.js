const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");

const menuScreen = document.getElementById("menuScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");

const startBtn = document.getElementById("startBtn");
const backBtn = document.getElementById("backBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const homeBtn = document.getElementById("homeBtn");

const timerEl = document.getElementById("timer");
const letterBoard = document.getElementById("letterBoard");
const progressText = document.getElementById("progressText");
const targetLetter = document.getElementById("targetLetter");
const menuBest = document.getElementById("menuBest");
const finalTime = document.getElementById("finalTime");
const resultMode = document.getElementById("resultMode");
const resultBest = document.getElementById("resultBest");
const newBest = document.getElementById("newBest");

const soundToggle = document.getElementById("soundToggle");
const wrongPenaltyToggle = document.getElementById("wrongPenaltyToggle");

let selectedMode = "lowercase";
let currentIndex = 0;
let startTime = 0;
let elapsed = 0;
let penaltyMs = 0;
let animationFrame = null;
let playing = false;

document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedMode = btn.dataset.mode;
    updateMenuBest();
  });
});

startBtn.addEventListener("click", startGame);
playAgainBtn.addEventListener("click", startGame);
homeBtn.addEventListener("click", goHome);
backBtn.addEventListener("click", goHome);

window.addEventListener("resize", () => {
  if (playing) {
    // Re-layout only the remaining letters.
    layoutRemainingLetters();
  }
});

function startGame() {
  menuScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  currentIndex = 0;
  penaltyMs = 0;
  elapsed = 0;
  playing = true;

  buildBoard();
  updateProgress();

  startTime = performance.now();
  cancelAnimationFrame(animationFrame);
  tick();

  beep(520, 0.07);
}

function goHome() {
  playing = false;
  cancelAnimationFrame(animationFrame);
  gameScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
  updateMenuBest();
}

function buildBoard() {
  letterBoard.innerHTML = "";

  const displayLetters = alphabet.map(letter => {
    if (selectedMode === "uppercase") return letter.toUpperCase();
    if (selectedMode === "random") {
      return Math.random() < 0.5 ? letter : letter.toUpperCase();
    }
    return letter;
  });

  displayLetters.forEach((displayLetter, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "letter";
    button.textContent = displayLetter;
    button.dataset.index = index;
    button.dataset.answer = alphabet[index];
    button.setAttribute("aria-label", `Letter ${displayLetter}`);

    button.addEventListener("click", () => handleLetterClick(button));
    letterBoard.appendChild(button);
  });

  requestAnimationFrame(() => layoutAllLetters());
}

function handleLetterClick(button) {
  if (!playing) return;

  const index = Number(button.dataset.index);

  if (index === currentIndex) {
    button.classList.add("correct");
    beep(700 + currentIndex * 12, 0.045);

    currentIndex += 1;
    updateProgress();

    if (currentIndex >= alphabet.length) {
      setTimeout(finishGame, 130);
    }
  } else {
    button.classList.remove("wrong");
    void button.offsetWidth;
    button.classList.add("wrong");

    if (wrongPenaltyToggle.checked) {
      penaltyMs += 500;
    }

    beep(180, 0.08);
  }
}

function updateProgress() {
  if (currentIndex < alphabet.length) {
    const target = alphabet[currentIndex];
    const shown =
      selectedMode === "uppercase"
        ? target.toUpperCase()
        : selectedMode === "random"
          ? "next letter"
          : target;

    targetLetter.textContent = shown;
    progressText.textContent = `${currentIndex + 1} / 26`;
  } else {
    targetLetter.textContent = "✓";
    progressText.textContent = "26 / 26";
  }
}

function tick() {
  if (!playing) return;

  elapsed = performance.now() - startTime + penaltyMs;
  timerEl.textContent = formatTime(elapsed);
  animationFrame = requestAnimationFrame(tick);
}

function finishGame() {
  if (!playing) return;

  elapsed = performance.now() - startTime + penaltyMs;
  playing = false;
  cancelAnimationFrame(animationFrame);

  const previousBest = getBestTime(selectedMode);
  const isNewBest = previousBest === null || elapsed < previousBest;

  if (isNewBest) {
    localStorage.setItem(bestKey(selectedMode), String(elapsed));
  }

  timerEl.textContent = formatTime(elapsed);
  finalTime.textContent = formatTime(elapsed);
  resultMode.textContent = selectedMode;
  resultBest.textContent = formatTime(getBestTime(selectedMode));
  newBest.classList.toggle("hidden", !isNewBest);

  gameScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");

  victorySound();
}

function formatTime(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "--:--.--";

  const totalHundredths = Math.floor(ms / 10);
  const minutes = Math.floor(totalHundredths / 6000);
  const seconds = Math.floor((totalHundredths % 6000) / 100);
  const hundredths = totalHundredths % 100;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

function bestKey(mode) {
  return `abcRaceBest:${mode}`;
}

function getBestTime(mode) {
  const value = localStorage.getItem(bestKey(mode));
  return value === null ? null : Number(value);
}

function updateMenuBest() {
  menuBest.textContent = formatTime(getBestTime(selectedMode));
}

function layoutAllLetters() {
  const buttons = [...letterBoard.querySelectorAll(".letter")];
  placeButtons(buttons);
}

function layoutRemainingLetters() {
  const buttons = [...letterBoard.querySelectorAll(".letter:not(.correct)")];
  placeButtons(buttons);
}

function placeButtons(buttons) {
  if (!buttons.length) return;

  const rect = letterBoard.getBoundingClientRect();
  const boardW = rect.width;
  const boardH = rect.height;

  const sample = buttons[0].getBoundingClientRect();
  const itemW = Math.max(sample.width, 64);
  const itemH = Math.max(sample.height, 64);

  const padding = 10;
  const minGap = 6;
  const placed = [];

  buttons.forEach(button => {
    let x = padding;
    let y = padding;
    let found = false;

    for (let attempt = 0; attempt < 240; attempt++) {
      x = padding + Math.random() * Math.max(1, boardW - itemW - padding * 2);
      y = padding + Math.random() * Math.max(1, boardH - itemH - padding * 2);

      const overlaps = placed.some(p =>
        x < p.x + itemW + minGap &&
        x + itemW + minGap > p.x &&
        y < p.y + itemH + minGap &&
        y + itemH + minGap > p.y
      );

      if (!overlaps) {
        found = true;
        break;
      }
    }

    if (!found) {
      // Safe fallback: a loose grid position if random placement is crowded.
      const i = placed.length;
      const cols = Math.max(4, Math.floor(boardW / (itemW + 8)));
      x = padding + (i % cols) * ((boardW - padding * 2 - itemW) / Math.max(1, cols - 1));
      y = padding + Math.floor(i / cols) * (itemH + 8);
    }

    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
    placed.push({ x, y });
  });
}

function beep(frequency = 440, duration = 0.06) {
  if (!soundToggle.checked) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
  osc.onended = () => ctx.close();
}

function victorySound() {
  if (!soundToggle.checked) return;

  [660, 820, 980].forEach((f, i) => {
    setTimeout(() => beep(f, 0.09), i * 100);
  });
}

updateMenuBest();
