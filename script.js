const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const healthText = document.getElementById("healthText");
const crystalText = document.getElementById("crystalText");
const enemyText = document.getElementById("enemyText");
const messageText = document.getElementById("messageText");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const restartButton = document.getElementById("restartButton");

const TILE = 32;
const MAP = [
  "####################",
  "#..C....#......E...#",
  "#.####..#.#####.##.#",
  "#......##.....#....#",
  "#.####....###.#.##.#",
  "#.#..#.##...#.#....#",
  "#.#..#..P...#.#.##.#",
  "#.##.####.#.#.#.##.#",
  "#....E....#.#.#....#",
  "###.######.#.#.###.#",
  "#...#...C..#.#...#.#",
  "#.#.#.######.###.#.#",
  "#.#...#....E...#...#",
  "#.#####.##########.#",
  "#.....C............#",
  "####################",
];

const WORLD = {
  width: MAP[0].length,
  height: MAP.length,
  pixelWidth: MAP[0].length * TILE,
  pixelHeight: MAP.length * TILE,
};

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  shift: false,
};

let game;
let lastTime = 0;

function createGame() {
  const enemies = [];
  const crystals = [];
  let playerStart = { x: 0, y: 0 };

  for (let row = 0; row < MAP.length; row += 1) {
    for (let col = 0; col < MAP[row].length; col += 1) {
      const cell = MAP[row][col];
      const x = col * TILE + TILE / 2;
      const y = row * TILE + TILE / 2;

      if (cell === "P") {
        playerStart = { x, y };
      }

      if (cell === "E") {
        enemies.push({
          x,
          y,
          homeX: x,
          homeY: y,
          hp: 3,
          patrolAngle: Math.random() * Math.PI * 2,
          speed: 54,
          attackCooldown: 0,
          alive: true,
        });
      }

      if (cell === "C") {
        crystals.push({
          x,
          y,
          collected: false,
          bob: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  return {
    over: false,
    won: false,
    attackTime: 0,
    message: "Find three crystals and defeat every shadow.",
    visibleEnemies: 0,
    player: {
      x: playerStart.x,
      y: playerStart.y,
      radius: 11,
      hp: 100,
      maxHp: 100,
      dirX: 1,
      dirY: 0,
      speed: 115,
      sprint: 168,
      attackCooldown: 0,
      crystals: 0,
    },
    enemies,
    crystals,
  };
}

function resetGame() {
  game = createGame();
  syncHud();
  overlay.classList.add("hidden");
}

function setMessage(text) {
  game.message = text;
  messageText.textContent = text;
}

function syncHud() {
  healthText.textContent = `${Math.max(0, Math.ceil(game.player.hp))} / ${game.player.maxHp}`;
  crystalText.textContent = `${game.player.crystals} / 3`;
  enemyText.textContent = `${game.enemies.filter((enemy) => enemy.alive).length} (${game.visibleEnemies} seen)`;
  messageText.textContent = game.message;
}

function isWallPixel(x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);

  if (col < 0 || row < 0 || col >= WORLD.width || row >= WORLD.height) {
    return true;
  }

  return MAP[row][col] === "#";
}

function circleHitsWall(x, y, radius) {
  for (let oy = -radius; oy <= radius; oy += radius) {
    for (let ox = -radius; ox <= radius; ox += radius) {
      if (isWallPixel(x + ox, y + oy)) {
        return true;
      }
    }
  }

  return false;
}

function hasLineOfSight(x1, y1, x2, y2) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(dist / 6));

  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    if (isWallPixel(x, y)) {
      return false;
    }
  }

  return true;
}

function isVisibleToPlayer(x, y) {
  const dx = x - game.player.x;
  const dy = y - game.player.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 180) {
    return false;
  }

  const normX = dx / (dist || 1);
  const normY = dy / (dist || 1);
  const dot = normX * game.player.dirX + normY * game.player.dirY;
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

  if (angle > Math.PI / 4.2) {
    return false;
  }

  return hasLineOfSight(game.player.x, game.player.y, x, y);
}

function update(dt) {
  if (game.over) {
    return;
  }

  const moveX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const moveY = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  const moveLen = Math.hypot(moveX, moveY);

  if (moveLen > 0) {
    const nx = moveX / moveLen;
    const ny = moveY / moveLen;
    game.player.dirX = nx;
    game.player.dirY = ny;

    const speed = keys.shift ? game.player.sprint : game.player.speed;
    const tryX = game.player.x + nx * speed * dt;
    const tryY = game.player.y + ny * speed * dt;

    if (!circleHitsWall(tryX, game.player.y, game.player.radius)) {
      game.player.x = tryX;
    }

    if (!circleHitsWall(game.player.x, tryY, game.player.radius)) {
      game.player.y = tryY;
    }
  }

  game.player.attackCooldown = Math.max(0, game.player.attackCooldown - dt);
  game.attackTime = Math.max(0, game.attackTime - dt);
  game.visibleEnemies = 0;

  for (const crystal of game.crystals) {
    crystal.bob += dt * 3;

    if (!crystal.collected && Math.hypot(crystal.x - game.player.x, crystal.y - game.player.y) < 18) {
      crystal.collected = true;
      game.player.crystals += 1;
      setMessage(`Crystal ${game.player.crystals} recovered. Your lantern grows stronger.`);
    }
  }

  for (const enemy of game.enemies) {
    if (!enemy.alive) {
      continue;
    }

    const dx = game.player.x - enemy.x;
    const dy = game.player.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    const seesPlayer = dist < 220 && hasLineOfSight(enemy.x, enemy.y, game.player.x, game.player.y);
    const visible = isVisibleToPlayer(enemy.x, enemy.y);

    if (visible) {
      game.visibleEnemies += 1;
    }

    let targetX = enemy.homeX + Math.cos(enemy.patrolAngle) * 20;
    let targetY = enemy.homeY + Math.sin(enemy.patrolAngle) * 20;

    if (seesPlayer) {
      targetX = game.player.x;
      targetY = game.player.y;
    } else {
      enemy.patrolAngle += dt;
    }

    const mdx = targetX - enemy.x;
    const mdy = targetY - enemy.y;
    const mlen = Math.hypot(mdx, mdy);
    if (mlen > 1) {
      const stepX = (mdx / mlen) * enemy.speed * dt;
      const stepY = (mdy / mlen) * enemy.speed * dt;
      if (!circleHitsWall(enemy.x + stepX, enemy.y, 10)) {
        enemy.x += stepX;
      }
      if (!circleHitsWall(enemy.x, enemy.y + stepY, 10)) {
        enemy.y += stepY;
      }
    }

    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    if (dist < 20 && enemy.attackCooldown === 0) {
      enemy.attackCooldown = 0.9;
      game.player.hp -= 12;
      setMessage("A shadow hits from the edge of your light.");
      if (game.player.hp <= 0) {
        game.player.hp = 0;
        endGame(false);
      }
    }
  }

  if (game.player.crystals >= 3 && game.enemies.every((enemy) => !enemy.alive)) {
    endGame(true);
  }

  syncHud();
}

function attack() {
  if (game.over || game.player.attackCooldown > 0) {
    return;
  }

  game.player.attackCooldown = 0.35;
  game.attackTime = 0.16;

  for (const enemy of game.enemies) {
    if (!enemy.alive) {
      continue;
    }

    const dx = enemy.x - game.player.x;
    const dy = enemy.y - game.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 42) {
      continue;
    }

    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    const dot = nx * game.player.dirX + ny * game.player.dirY;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (angle > Math.PI / 3) {
      continue;
    }

    enemy.hp -= 1;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      setMessage("A shadow breaks apart.");
    }
  }
}

function endGame(won) {
  game.over = true;
  game.won = won;
  overlay.classList.remove("hidden");
  overlayTitle.textContent = won ? "Lantern restored." : "You fell in the dark.";
  overlayText.textContent = won
    ? "You found every crystal and cleared the dungeon."
    : "Press R or the button below to try again.";
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cameraX = Math.max(0, Math.min(game.player.x - canvas.width / 2, WORLD.pixelWidth - canvas.width));
  const cameraY = Math.max(0, Math.min(game.player.y - canvas.height / 2, WORLD.pixelHeight - canvas.height));

  drawMap(cameraX, cameraY);
  drawCrystals(cameraX, cameraY);
  drawEnemies(cameraX, cameraY);
  drawPlayer(cameraX, cameraY);
  drawLanternMask(cameraX, cameraY);
  drawMiniHud();
}

function drawMap(cameraX, cameraY) {
  for (let row = 0; row < MAP.length; row += 1) {
    for (let col = 0; col < MAP[row].length; col += 1) {
      const x = col * TILE - cameraX;
      const y = row * TILE - cameraY;
      const cell = MAP[row][col];
      const centerX = col * TILE + TILE / 2;
      const centerY = row * TILE + TILE / 2;
      const visible = isVisibleToPlayer(centerX, centerY);

      if (cell === "#") {
        ctx.fillStyle = visible ? "#516a9d" : "#22314e";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = visible ? "#6f8cc5" : "#2a3d62";
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
      } else {
        ctx.fillStyle = visible ? "#203457" : "#101b31";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = visible ? "#1a2944" : "#0d1528";
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      }
    }
  }
}

function drawCrystals(cameraX, cameraY) {
  for (const crystal of game.crystals) {
    if (crystal.collected) {
      continue;
    }

    const visible = isVisibleToPlayer(crystal.x, crystal.y);
    const x = crystal.x - cameraX;
    const y = crystal.y - cameraY + Math.sin(crystal.bob) * 4;

    ctx.globalAlpha = visible ? 1 : 0.14;
    ctx.fillStyle = "#78ebff";
    pixelDiamond(x, y, 10);
    ctx.fillStyle = "#d9fbff";
    pixelDiamond(x, y - 3, 4);
    ctx.globalAlpha = 1;
  }
}

function drawEnemies(cameraX, cameraY) {
  for (const enemy of game.enemies) {
    if (!enemy.alive) {
      continue;
    }

    const visible = isVisibleToPlayer(enemy.x, enemy.y);
    const x = enemy.x - cameraX;
    const y = enemy.y - cameraY;

    ctx.globalAlpha = visible ? 1 : 0.18;
    ctx.fillStyle = "#6d2331";
    ctx.fillRect(Math.round(x - 11), Math.round(y - 10), 22, 22);
    ctx.fillStyle = "#e45b72";
    ctx.fillRect(Math.round(x - 8), Math.round(y - 7), 16, 16);
    ctx.fillStyle = "#ffd7dc";
    ctx.fillRect(Math.round(x - 4), Math.round(y - 3), 3, 3);
    ctx.fillRect(Math.round(x + 1), Math.round(y - 3), 3, 3);
    ctx.globalAlpha = 1;
  }
}

function drawPlayer(cameraX, cameraY) {
  const x = game.player.x - cameraX;
  const y = game.player.y - cameraY;
  ctx.fillStyle = "#2d6c89";
  ctx.fillRect(Math.round(x - 11), Math.round(y - 11), 22, 22);
  ctx.fillStyle = "#99efff";
  ctx.fillRect(Math.round(x - 8), Math.round(y - 8), 16, 16);
  ctx.fillStyle = "#fff1d1";
  ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);

  const tipX = x + game.player.dirX * 18;
  const tipY = y + game.player.dirY * 18;
  ctx.fillStyle = "#ffe77f";
  ctx.fillRect(Math.round(tipX - 3), Math.round(tipY - 3), 6, 6);

  if (game.attackTime > 0) {
    ctx.strokeStyle = "#ffeb9a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, 28, Math.atan2(game.player.dirY, game.player.dirX) - 0.7, Math.atan2(game.player.dirY, game.player.dirX) + 0.7);
    ctx.stroke();
  }
}

function drawLanternMask(cameraX, cameraY) {
  const x = game.player.x - cameraX;
  const y = game.player.y - cameraY;
  const angle = Math.atan2(game.player.dirY, game.player.dirX);

  ctx.save();
  ctx.fillStyle = "rgba(2, 5, 12, 0.84)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "destination-out";

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, 190, angle - 0.78, angle + 0.78);
  ctx.closePath();
  ctx.fill();

  const glow = ctx.createRadialGradient(x, y, 12, x, y, 120);
  glow.addColorStop(0, "rgba(255,255,255,0.95)");
  glow.addColorStop(0.2, "rgba(255,255,255,0.45)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMiniHud() {
  ctx.fillStyle = "rgba(5, 10, 20, 0.72)";
  ctx.fillRect(14, 14, 240, 72);

  ctx.fillStyle = "#eff3ff";
  ctx.font = "16px monospace";
  ctx.fillText(`HP ${Math.ceil(game.player.hp)}/${game.player.maxHp}`, 28, 38);
  ctx.fillText(`CRYSTALS ${game.player.crystals}/3`, 28, 60);
  ctx.fillText(`ENEMIES ${game.enemies.filter((enemy) => enemy.alive).length}`, 28, 82);
}

function pixelDiamond(x, y, size) {
  ctx.beginPath();
  ctx.moveTo(Math.round(x), Math.round(y - size));
  ctx.lineTo(Math.round(x + size), Math.round(y));
  ctx.lineTo(Math.round(x), Math.round(y + size));
  ctx.lineTo(Math.round(x - size), Math.round(y));
  ctx.closePath();
  ctx.fill();
}

function frame(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyW") keys.w = true;
  if (event.code === "KeyA") keys.a = true;
  if (event.code === "KeyS") keys.s = true;
  if (event.code === "KeyD") keys.d = true;
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") keys.shift = true;
  if (event.code === "Space") {
    event.preventDefault();
    attack();
  }
  if (event.code === "KeyR") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "KeyW") keys.w = false;
  if (event.code === "KeyA") keys.a = false;
  if (event.code === "KeyS") keys.s = false;
  if (event.code === "KeyD") keys.d = false;
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") keys.shift = false;
});

restartButton.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(frame);
