const items = window.GARBAGE_ITEMS || [];

const itemCount = document.getElementById("item-count");
const scoreText = document.getElementById("score-text");
const timerText = document.getElementById("timer-text");
const statusText = document.getElementById("status-text");
const trashCardInner = document.getElementById("trash-card-inner");
const trashEmoji = document.getElementById("trash-emoji");
const trashName = document.getElementById("trash-name");
const trashHint = document.getElementById("trash-hint");
const messagePanel = document.getElementById("message-panel");
const messageTitle = document.getElementById("message-title");
const messageBody = document.getElementById("message-body");
const restartButton = document.getElementById("restart-button");
const binButtons = [...document.querySelectorAll(".bin")];

let currentIndex = 0;
let isGameOver = false;
let deck = [];
let score = 0;
let timeLeft = 45;
let timerId = null;

function playTone(frequency, duration, type = "sine", volume = 0.03) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  if (!playTone.context) {
    playTone.context = new AudioContextClass();
  }

  const context = playTone.context;

  if (context.state === "suspended") {
    context.resume();
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.stop(context.currentTime + duration);
}

function playCorrectSound() {
  playTone(720, 0.12, "triangle");
  setTimeout(() => playTone(920, 0.12, "triangle"), 90);
}

function playWrongSound() {
  playTone(240, 0.22, "sawtooth");
}

function playWinSound() {
  [520, 660, 880].forEach((tone, index) => {
    setTimeout(() => playTone(tone, 0.16, "triangle"), index * 110);
  });
}

function clearTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function updateScore() {
  scoreText.textContent = String(score);
}

function updateTimer() {
  timerText.textContent = `${timeLeft}s`;
}

function startTimer() {
  clearTimer();
  updateTimer();

  timerId = window.setInterval(() => {
    timeLeft -= 1;
    updateTimer();

    if (timeLeft <= 0) {
      handleLoss("time ran out");
    }
  }, 1000);
}

function pulseCard(className) {
  trashCardInner.classList.remove("celebrate", "shake");
  void trashCardInner.offsetWidth;
  trashCardInner.classList.add(className);
}

function shuffle(source) {
  const clone = [...source];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[randomIndex]] = [clone[randomIndex], clone[index]];
  }

  return clone;
}

function setBinsDisabled(disabled) {
  binButtons.forEach((button) => {
    button.disabled = disabled;
  });

  trashCardInner.draggable = !disabled;
}

function showMessage(title, body, mode = "") {
  messageTitle.textContent = title;
  messageBody.textContent = body;
  messagePanel.classList.remove("win", "lose");

  if (mode) {
    messagePanel.classList.add(mode);
  }
}

function renderCurrentItem() {
  const currentItem = deck[currentIndex];

  if (!currentItem) {
    return;
  }

  itemCount.textContent = `${currentIndex + 1} / ${deck.length}`;
  trashEmoji.textContent = currentItem.emoji;
  trashName.textContent = currentItem.name;
  trashHint.textContent = currentItem.hint;
  statusText.textContent = "Choose the right bin";
}

function handleWin() {
  isGameOver = true;
  clearTimer();
  setBinsDisabled(true);
  statusText.textContent = "You win";
  playWinSound();
  pulseCard("celebrate");
  showMessage(
    "You cleaned up the whole park!",
    `Every item was sorted correctly. Final score: ${score}. Press Restart to play again.`,
    "win"
  );
}

function handleLoss(correctBin) {
  isGameOver = true;
  clearTimer();
  setBinsDisabled(true);
  statusText.textContent = "You lose";

  if (correctBin === "time ran out") {
    playWrongSound();
    pulseCard("shake");
    showMessage("Time's up!", `You scored ${score} before the timer ended. Press Restart to try again.`, "lose");
    return;
  }

  playWrongSound();
  pulseCard("shake");
  showMessage("Wrong bin!", `That item belonged in ${correctBin}. Press Restart to try again.`, "lose");
}

function handleSelection(selectedBin) {
  if (isGameOver) {
    return;
  }

  const currentItem = deck[currentIndex];

  if (selectedBin !== currentItem.bin) {
    handleLoss(currentItem.bin);
    return;
  }

  score += 100;
  timeLeft += 3;
  updateScore();
  updateTimer();
  playCorrectSound();
  pulseCard("celebrate");
  currentIndex += 1;

  if (currentIndex >= deck.length) {
    handleWin();
    return;
  }

  statusText.textContent = "Correct";
  showMessage("Nice sorting!", "Keep going. One wrong move will end the round.");
  renderCurrentItem();
}

function restartGame() {
  if (!items.length) {
    showMessage("No garbage items found", "Add items to garbage-data.js and reload the page.", "lose");
    setBinsDisabled(true);
    return;
  }

  deck = shuffle(items);
  currentIndex = 0;
  isGameOver = false;
  score = 0;
  timeLeft = 45;
  setBinsDisabled(false);
  updateScore();
  startTimer();
  showMessage("Ready?", `Sort all ${deck.length} items correctly before time runs out.`);
  renderCurrentItem();
}

binButtons.forEach((button) => {
  button.addEventListener("click", () => {
    handleSelection(button.dataset.bin);
  });

  button.addEventListener("dragover", (event) => {
    if (isGameOver) {
      return;
    }

    event.preventDefault();
    button.classList.add("drag-over");
  });

  button.addEventListener("dragleave", () => {
    button.classList.remove("drag-over");
  });

  button.addEventListener("drop", (event) => {
    event.preventDefault();
    button.classList.remove("drag-over");
    handleSelection(button.dataset.bin);
  });
});

trashCardInner.addEventListener("dragstart", (event) => {
  if (isGameOver) {
    event.preventDefault();
    return;
  }

  trashCardInner.classList.add("dragging");
  event.dataTransfer.setData("text/plain", deck[currentIndex].name);
});

trashCardInner.addEventListener("dragend", () => {
  trashCardInner.classList.remove("dragging");
  binButtons.forEach((button) => button.classList.remove("drag-over"));
});

restartButton.addEventListener("click", restartGame);

restartGame();
