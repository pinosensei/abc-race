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
const musicToggle = document.getElementById("musicToggle");
const wrongPenaltyToggle = document.getElementById("wrongPenaltyToggle");

const countdownOverlay = document.getElementById("countdownOverlay");
const countdownNumber = document.getElementById("countdownNumber");

let selectedMode = "lowercase";
let currentIndex = 0;
let startTime = 0;
let elapsed = 0;
let penaltyMs = 0;
let animationFrame = null;
let playing = false;
let countdownRunning = false;

let audioCtx = null;
let musicTimer = null;
let musicStep = 0;

document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedMode = btn.dataset.mode;
    updateMenuBest();
  });
});

startBtn.addEventListener("click", prepareGame);
playAgainBtn.addEventListener("click", prepareGame);
homeBtn.addEventListener("click", goHome);
backBtn.addEventListener("click", goHome);

musicToggle.addEventListener("change", () => {
  if (!musicToggle.checked) stopMusic();
  else if (playing) startMusic();
});

window.addEventListener("resize", () => {
  if (playing || countdownRunning) layoutRemainingLetters();
});

function ensureAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

function prepareGame() {
  ensureAudio();

  menuScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  currentIndex = 0;
  penaltyMs = 0;
  elapsed = 0;
  playing = false;
  countdownRunning = true;
  stopMusic();
  cancelAnimationFrame(animationFrame);

  timerEl.textContent = "00:00.00";
  buildBoard();
  updateProgress();
  setLettersEnabled(false);

  runCountdown();
}

async function runCountdown() {
  countdownOverlay.classList.remove("hidden");

  for (const value of ["3", "2", "1"]) {
    countdownNumber.textContent = value;
    countdownNumber.style.animation = "none";
    void countdownNumber.offsetWidth;
    countdownNumber.style.animation = "countdownPop .75s ease both";
    countdownTone(value);
    await wait(800);
  }

  countdownNumber.textContent = "GO!";
  countdownNumber.style.animation = "none";
  void countdownNumber.offsetWidth;
  countdownNumber.style.animation = "countdownPop .6s ease both";
  goTone();
  await wait(550);

  countdownOverlay.classList.add("hidden");
  countdownRunning = false;
  beginRace();
}

function beginRace() {
  playing = true;
  setLettersEnabled(true);
  startTime = performance.now();
  startMusic();
  tick();
}

function goHome() {
  playing = false;
  countdownRunning = false;
  cancelAnimationFrame(animationFrame);
  stopMusic();
  countdownOverlay.classList.add("hidden");
  gameScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
  updateMenuBest();
}

function buildBoard() {
  letterBoard.innerHTML = "";

  const displayLetters = alphabet.map(letter => {
    if (selectedMode === "uppercase") return letter.toUpperCase();
    if (selectedMode === "random") return Math.random() < 0.5 ? letter : letter.toUpperCase();
    return letter;
  });

  displayLetters.forEach((displayLetter, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "letter";
    button.textContent = displayLetter;
    button.dataset.index = index;
    button.setAttribute("aria-label", `Letter ${displayLetter}`);
    button.addEventListener("click", () => handleLetterClick(button));
    letterBoard.appendChild(button);
  });

  requestAnimationFrame(layoutAllLetters);
}

function setLettersEnabled(enabled) {
  letterBoard.querySelectorAll(".letter").forEach(btn => {
    btn.disabled = !enabled;
  });
}

function handleLetterClick(button) {
  if (!playing) return;

  const index = Number(button.dataset.index);

  if (index === currentIndex) {
    button.classList.add("correct");
    correctSound();

    currentIndex++;
    updateProgress();

    if (currentIndex >= alphabet.length) {
      setTimeout(finishGame, 130);
    }
  } else {
    button.classList.remove("wrong");
    void button.offsetWidth;
    button.classList.add("wrong");

    if (wrongPenaltyToggle.checked) penaltyMs += 500;
    bumpSound();
  }
}

function updateProgress() {
  if (currentIndex < alphabet.length) {
    const target = alphabet[currentIndex];
    const shown =
      selectedMode === "uppercase" ? target.toUpperCase() :
      selectedMode === "random" ? "next letter" :
      target;

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
  stopMusic();

  const previousBest = getBestTime(selectedMode);
  const isNewBest = previousBest === null || elapsed < previousBest;

  if (isNewBest) localStorage.setItem(bestKey(selectedMode), String(elapsed));

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
  return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}.${String(hundredths).padStart(2,"0")}`;
}

function bestKey(mode) { return `abcRaceBest:${mode}`; }

function getBestTime(mode) {
  const value = localStorage.getItem(bestKey(mode));
  return value === null ? null : Number(value);
}

function updateMenuBest() {
  menuBest.textContent = formatTime(getBestTime(selectedMode));
}

function layoutAllLetters() {
  placeButtons([...letterBoard.querySelectorAll(".letter")]);
}

function layoutRemainingLetters() {
  placeButtons([...letterBoard.querySelectorAll(".letter:not(.correct)")]);
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
    let x = padding, y = padding, found = false;

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

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function tone(freq, duration = .08, volume = .04, type = "sine", when = 0) {
  if (!soundToggle.checked) return;
  ensureAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + when);
  gain.gain.setValueAtTime(volume, audioCtx.currentTime + when);
  gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + when + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(audioCtx.currentTime + when);
  osc.stop(audioCtx.currentTime + when + duration);
}

function correctSound() {
  tone(900, .055, .045, "sine");
  tone(1200, .05, .028, "sine", .045);
}

function bumpSound() {
  if (!soundToggle.checked) return;
  ensureAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(70, audioCtx.currentTime + .13);

  gain.gain.setValueAtTime(.045, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .14);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + .14);
}

function countdownTone(value) {
  tone(430, .1, .035, "sine");
}

function goTone() {
  tone(650, .1, .04, "sine");
  tone(900, .13, .04, "sine", .09);
}

function victorySound() {
  [660, 820, 980, 1240].forEach((f, i) => tone(f, .11, .04, "sine", i * .09));
}

/* Original, royalty-free background music made with Web Audio.
   It uses synthesized notes, so there is no music file to upload. */
function startMusic() {
  if (!musicToggle.checked || musicTimer || !playing) return;
  ensureAudio();
  if (!audioCtx) return;

  const notes = [
    261.63, 329.63, 392.00, 329.63,
    293.66, 349.23, 440.00, 349.23,
    329.63, 392.00, 493.88, 392.00,
    293.66, 349.23, 392.00, 329.63
  ];

  musicStep = 0;

  const playStep = () => {
    if (!playing || !musicToggle.checked) {
      stopMusic();
      return;
    }

    const freq = notes[musicStep % notes.length];
    musicNote(freq, .19);
    musicStep++;
  };

  playStep();
  musicTimer = setInterval(playStep, 220);
}

function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

function musicNote(freq, duration) {
  if (!musicToggle.checked) return;
  ensureAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "triangle";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(.012, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

updateMenuBest();
