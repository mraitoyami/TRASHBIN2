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

const TILE = 64;
const FOV = Math.PI / 3;
const HALF_FOV = FOV / 2;
const MAX_DEPTH = 15;
const RAY_STEP = 4;
const MOVE_SPEED = 125;
const TURN_SPEED = 2.4;
const STRAFE_SPEED = 92;
const ATTACK_RANGE = 0.95;

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  shift: false,
};

let game;
let lastFrame = 0;

function createGame() {
  const enemies = [];
  const crystals = [];
  let startX = TILE * 2;
  let startY = TILE * 2;

  for (let row = 0; row < MAP.length; row += 1) {
    for (let col = 0; col < MAP[row].length; col += 1) {
      const cell = MAP[row][col];
      const x = col + 0.5;
      const y = row + 0.5;

      if (cell === "P") {
        startX = x * TILE;
        startY = y * TILE;
      }

      if (cell === "E") {
        enemies.push({
          x,
          y,
          hp: 3,
          alive: true,
          attackCooldown: 0,
          pulse: Math.random() * Math.PI * 2,
        });
      }

      if (cell === "C") {
        crystals.push({
          x,
          y,
          collected: false,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  return {
    over: false,
    won: false,
    message: "Find three crystals, defeat every shadow, and stay inside the lantern beam.",
    visibleEnemies: 0,
    attackTimer: 0,
    bob: 0,
    player: {
      x: startX,
      y: startY,
      angle: 0,
      hp: 100,
      maxHp: 100,
      crystals: 0,
      attackCooldown: 0,
      radius: 14,
    },
    enemies,
    crystals,
    depthBuffer: new Array(canvas.width).fill(Infinity),
  };
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

function resetGame() {
  game = createGame();
  overlay.classList.add("hidden");
  syncHud();
}

function mapCell(col, row) {
  if (row < 0 || row >= MAP.length || col < 0 || col >= MAP[0].length) {
    return "#";
  }

  return MAP[row][col];
}

function isWallAtPixel(x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  return mapCell(col, row) === "#";
}

function collides(x, y, radius) {
  const points = [
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x - radius, y + radius],
    [x + radius, y + radius],
  ];

  return points.some(([px, py]) => isWallAtPixel(px, py));
}

function normalizeAngle(angle) {
  let next = angle % (Math.PI * 2);
  if (next < 0) {
    next += Math.PI * 2;
  }
  return next;
}

function castRay(angle) {
  const rayAngle = normalizeAngle(angle);
  const sin = Math.sin(rayAngle);
  const cos = Math.cos(rayAngle);

  for (let depth = 1; depth < MAX_DEPTH * TILE; depth += RAY_STEP) {
    const x = game.player.x + cos * depth;
    const y = game.player.y + sin * depth;

    if (isWallAtPixel(x, y)) {
      return {
        distance: depth,
        hitX: x,
        hitY: y,
      };
    }
  }

  return {
    distance: MAX_DEPTH * TILE,
    hitX: game.player.x + cos * MAX_DEPTH * TILE,
    hitY: game.player.y + sin * MAX_DEPTH * TILE,
  };
}

function hasLineOfSight(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  const steps = Math.ceil(distance / 8);

  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    if (isWallAtPixel(x, y)) {
      return false;
    }
  }

  return true;
}

function angleDiff(a, b) {
  let diff = normalizeAngle(a - b);
  if (diff > Math.PI) {
    diff -= Math.PI * 2;
  }
  return diff;
}

function update(dt) {
  if (game.over) {
    return;
  }

  const player = game.player;
  let moveX = 0;
  let moveY = 0;

  if (keys.w) {
    moveX += Math.cos(player.angle) * MOVE_SPEED * dt;
    moveY += Math.sin(player.angle) * MOVE_SPEED * dt;
  }

  if (keys.s) {
    moveX -= Math.cos(player.angle) * MOVE_SPEED * dt;
    moveY -= Math.sin(player.angle) * MOVE_SPEED * dt;
  }

  if (keys.shift && keys.a) {
    moveX += Math.cos(player.angle - Math.PI / 2) * STRAFE_SPEED * dt;
    moveY += Math.sin(player.angle - Math.PI / 2) * STRAFE_SPEED * dt;
  } else if (keys.a) {
    player.angle -= TURN_SPEED * dt;
  }

  if (keys.shift && keys.d) {
    moveX += Math.cos(player.angle + Math.PI / 2) * STRAFE_SPEED * dt;
    moveY += Math.sin(player.angle + Math.PI / 2) * STRAFE_SPEED * dt;
  } else if (keys.d) {
    player.angle += TURN_SPEED * dt;
  }

  player.angle = normalizeAngle(player.angle);

  const nextX = player.x + moveX;
  const nextY = player.y + moveY;

  if (!collides(nextX, player.y, player.radius)) {
    player.x = nextX;
  }

  if (!collides(player.x, nextY, player.radius)) {
    player.y = nextY;
  }

  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  game.attackTimer = Math.max(0, game.attackTimer - dt);
  game.bob += Math.hypot(moveX, moveY) > 0 ? dt * 10 : dt * 2;
  game.visibleEnemies = 0;

  updateCrystals(dt);
  updateEnemies(dt);

  if (player.crystals >= 3 && game.enemies.every((enemy) => !enemy.alive)) {
    endGame(true);
  }

  syncHud();
}

function updateCrystals(dt) {
  for (const crystal of game.crystals) {
    crystal.pulse += dt * 2;

    if (crystal.collected) {
      continue;
    }

    const dx = crystal.x * TILE - game.player.x;
    const dy = crystal.y * TILE - game.player.y;
    if (Math.hypot(dx, dy) < 24) {
      crystal.collected = true;
      game.player.crystals += 1;
      setMessage(`Crystal ${game.player.crystals} recovered. Your lantern cuts farther through the dark.`);
    }
  }
}

function updateEnemies(dt) {
  for (const enemy of game.enemies) {
    if (!enemy.alive) {
      continue;
    }

    enemy.pulse += dt * 3;
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

    const enemyPixelX = enemy.x * TILE;
    const enemyPixelY = enemy.y * TILE;
    const dx = game.player.x - enemyPixelX;
    const dy = game.player.y - enemyPixelY;
    const distance = Math.hypot(dx, dy);
    const visible = isSpriteVisible(enemyPixelX, enemyPixelY);

    if (visible) {
      game.visibleEnemies += 1;
    }

    if (distance < TILE * 5 && hasLineOfSight(enemyPixelX, enemyPixelY, game.player.x, game.player.y)) {
      const nx = dx / (distance || 1);
      const ny = dy / (distance || 1);
      const step = 40 * dt;
      const tryX = enemyPixelX + nx * step;
      const tryY = enemyPixelY + ny * step;

      if (!isWallAtPixel(tryX, enemyPixelY)) {
        enemy.x = tryX / TILE;
      }

      if (!isWallAtPixel(enemy.x * TILE, tryY)) {
        enemy.y = tryY / TILE;
      }
    }

    if (distance < 28 && enemy.attackCooldown === 0) {
      enemy.attackCooldown = 0.95;
      game.player.hp = Math.max(0, game.player.hp - 11);
      setMessage("A shadow claws through the edge of your lantern.");

      if (game.player.hp <= 0) {
        endGame(false);
      }
    }
  }
}

function isSpriteVisible(x, y) {
  const dx = x - game.player.x;
  const dy = y - game.player.y;
  const distance = Math.hypot(dx, dy);
  if (distance > MAX_DEPTH * TILE) {
    return false;
  }

  const angleToSprite = Math.atan2(dy, dx);
  return Math.abs(angleDiff(angleToSprite, game.player.angle)) < HALF_FOV;
}

function attack() {
  if (game.over || game.player.attackCooldown > 0) {
    return;
  }

  game.player.attackCooldown = 0.35;
  game.attackTimer = 0.16;

  let hitEnemy = false;

  for (const enemy of game.enemies) {
    if (!enemy.alive) {
      continue;
    }

    const enemyPixelX = enemy.x * TILE;
    const enemyPixelY = enemy.y * TILE;
    const dx = enemyPixelX - game.player.x;
    const dy = enemyPixelY - game.player.y;
    const distance = Math.hypot(dx, dy) / TILE;
    const angleToEnemy = Math.atan2(dy, dx);
    const diff = Math.abs(angleDiff(angleToEnemy, game.player.angle));

    if (distance <= ATTACK_RANGE && diff < 0.46 && hasLineOfSight(game.player.x, game.player.y, enemyPixelX, enemyPixelY)) {
      enemy.hp -= 1;
      hitEnemy = true;

      if (enemy.hp <= 0) {
        enemy.alive = false;
        setMessage("A shadow collapses into smoke.");
      } else {
        setMessage("Steel lands. The shadow staggers.");
      }
    }
  }

  if (!hitEnemy) {
    setMessage("Your blade cuts empty air.");
  }

  syncHud();
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

function render3D() {
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height / 2);
  sky.addColorStop(0, "#152346");
  sky.addColorStop(1, "#0d1831");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height / 2);

  const floor = ctx.createLinearGradient(0, height / 2, 0, height);
  floor.addColorStop(0, "#18223a");
  floor.addColorStop(1, "#0a1020");
  ctx.fillStyle = floor;
  ctx.fillRect(0, height / 2, width, height / 2);

  for (let x = 0; x < width; x += 1) {
    const rayAngle = game.player.angle - HALF_FOV + (x / width) * FOV;
    const ray = castRay(rayAngle);
    const correctedDistance = ray.distance * Math.cos(rayAngle - game.player.angle);
    game.depthBuffer[x] = correctedDistance;

    const wallHeight = Math.min(height, (TILE * 380) / Math.max(correctedDistance, 1));
    const wallTop = height / 2 - wallHeight / 2 + Math.sin(game.bob) * 4;
    const shade = Math.max(0.18, 1 - correctedDistance / (MAX_DEPTH * TILE));
    const hitOnVertical = Math.abs((ray.hitX / TILE) % 1) < 0.08 || Math.abs((ray.hitX / TILE) % 1) > 0.92;

    ctx.fillStyle = hitOnVertical
      ? `rgba(${Math.floor(85 * shade)}, ${Math.floor(120 * shade)}, ${Math.floor(176 * shade)}, 1)`
      : `rgba(${Math.floor(62 * shade)}, ${Math.floor(93 * shade)}, ${Math.floor(145 * shade)}, 1)`;
    ctx.fillRect(x, wallTop, 1, wallHeight);

    ctx.fillStyle = `rgba(6, 10, 18, ${Math.min(0.72, correctedDistance / (MAX_DEPTH * TILE))})`;
    ctx.fillRect(x, wallTop + wallHeight, 1, height - wallTop - wallHeight);
  }

  renderSprites();
  renderWeapon();
  renderMiniMap();
  renderCrosshair();
}

function renderSprites() {
  const sprites = [];

  for (const crystal of game.crystals) {
    if (crystal.collected) {
      continue;
    }

    sprites.push({
      x: crystal.x * TILE,
      y: crystal.y * TILE,
      type: "crystal",
      pulse: crystal.pulse,
    });
  }

  for (const enemy of game.enemies) {
    if (!enemy.alive) {
      continue;
    }

    sprites.push({
      x: enemy.x * TILE,
      y: enemy.y * TILE,
      type: "enemy",
      pulse: enemy.pulse,
    });
  }

  sprites.sort((a, b) => {
    const da = Math.hypot(a.x - game.player.x, a.y - game.player.y);
    const db = Math.hypot(b.x - game.player.x, b.y - game.player.y);
    return db - da;
  });

  for (const sprite of sprites) {
    const dx = sprite.x - game.player.x;
    const dy = sprite.y - game.player.y;
    const distance = Math.hypot(dx, dy);
    const angleToSprite = Math.atan2(dy, dx);
    const relative = angleDiff(angleToSprite, game.player.angle);

    if (Math.abs(relative) > HALF_FOV + 0.3) {
      continue;
    }

    if (!hasLineOfSight(game.player.x, game.player.y, sprite.x, sprite.y)) {
      continue;
    }

    const screenX = (0.5 + relative / FOV) * canvas.width;
    const size = Math.min(220, (TILE * 300) / Math.max(distance, 1));
    const screenY = canvas.height / 2 + Math.sin(sprite.pulse) * 5 + Math.sin(game.bob) * 4;
    const left = Math.round(screenX - size / 2);
    const top = Math.round(screenY - size / 2);

    if (left < 0 || left >= canvas.width) {
      continue;
    }

    const depthAtSprite = game.depthBuffer[Math.max(0, Math.min(canvas.width - 1, Math.round(screenX)))];
    if (distance > depthAtSprite + 10) {
      continue;
    }

    if (sprite.type === "enemy") {
      drawEnemySprite(left, top, size, distance);
    } else {
      drawCrystalSprite(left, top, size, distance);
    }
  }
}

function drawEnemySprite(left, top, size, distance) {
  const alpha = Math.max(0.35, 1 - distance / (MAX_DEPTH * TILE));
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "#3c0e18";
  ctx.fillRect(left + size * 0.2, top + size * 0.16, size * 0.6, size * 0.66);
  ctx.fillStyle = "#d6526f";
  ctx.fillRect(left + size * 0.28, top + size * 0.24, size * 0.44, size * 0.5);
  ctx.fillStyle = "#ffe7ec";
  ctx.fillRect(left + size * 0.38, top + size * 0.36, size * 0.08, size * 0.08);
  ctx.fillRect(left + size * 0.54, top + size * 0.36, size * 0.08, size * 0.08);
  ctx.restore();
}

function drawCrystalSprite(left, top, size, distance) {
  const alpha = Math.max(0.3, 1 - distance / (MAX_DEPTH * TILE));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#57e4ff";
  ctx.beginPath();
  ctx.moveTo(left + size * 0.5, top + size * 0.1);
  ctx.lineTo(left + size * 0.78, top + size * 0.5);
  ctx.lineTo(left + size * 0.5, top + size * 0.9);
  ctx.lineTo(left + size * 0.22, top + size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#dcfcff";
  ctx.fillRect(left + size * 0.44, top + size * 0.24, size * 0.12, size * 0.18);
  ctx.restore();
}

function renderWeapon() {
  const swing = game.attackTimer > 0 ? Math.sin((game.attackTimer / 0.16) * Math.PI) : 0;
  const baseX = canvas.width * 0.68 + swing * 40;
  const baseY = canvas.height * 0.8 + Math.sin(game.bob) * 7;

  ctx.fillStyle = "#623b23";
  ctx.fillRect(baseX, baseY, 18, 90);
  ctx.fillStyle = "#d9e0e8";
  ctx.fillRect(baseX - 12 - swing * 22, baseY - 110, 18, 120);
  ctx.fillStyle = "#f5d38d";
  ctx.fillRect(baseX - 14, baseY - 6, 40, 12);
}

function renderCrosshair() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.strokeStyle = "rgba(255, 241, 177, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();
}

function renderMiniMap() {
  const scale = 10;
  const offsetX = 16;
  const offsetY = canvas.height - MAP.length * scale - 16;

  ctx.fillStyle = "rgba(5, 10, 20, 0.74)";
  ctx.fillRect(offsetX - 8, offsetY - 8, MAP[0].length * scale + 16, MAP.length * scale + 16);

  for (let row = 0; row < MAP.length; row += 1) {
    for (let col = 0; col < MAP[row].length; col += 1) {
      ctx.fillStyle = MAP[row][col] === "#" ? "#526a9b" : "#17243f";
      ctx.fillRect(offsetX + col * scale, offsetY + row * scale, scale - 1, scale - 1);
    }
  }

  for (const crystal of game.crystals) {
    if (crystal.collected) {
      continue;
    }
    ctx.fillStyle = "#7deeff";
    ctx.fillRect(offsetX + crystal.x * scale - 2, offsetY + crystal.y * scale - 2, 4, 4);
  }

  for (const enemy of game.enemies) {
    if (!enemy.alive) {
      continue;
    }
    ctx.fillStyle = "#ff6c86";
    ctx.fillRect(offsetX + enemy.x * scale - 2, offsetY + enemy.y * scale - 2, 4, 4);
  }

  const px = offsetX + (game.player.x / TILE) * scale;
  const py = offsetY + (game.player.y / TILE) * scale;
  ctx.fillStyle = "#fff1b3";
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#fff1b3";
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(game.player.angle) * 8, py + Math.sin(game.player.angle) * 8);
  ctx.stroke();
}

function drawHudOverlay() {
  const hpRatio = game.player.hp / game.player.maxHp;
  ctx.fillStyle = "rgba(5, 10, 20, 0.68)";
  ctx.fillRect(16, 16, 240, 72);

  ctx.fillStyle = "#eff3ff";
  ctx.font = "16px monospace";
  ctx.fillText(`HP ${Math.ceil(game.player.hp)}/${game.player.maxHp}`, 28, 40);
  ctx.fillText(`CRYSTALS ${game.player.crystals}/3`, 28, 62);
  ctx.fillText(`ENEMIES ${game.enemies.filter((enemy) => enemy.alive).length}`, 28, 84);

  ctx.fillStyle = "#263555";
  ctx.fillRect(280, 24, 180, 16);
  ctx.fillStyle = hpRatio > 0.35 ? "#8df0a7" : "#ff7b88";
  ctx.fillRect(280, 24, 180 * hpRatio, 16);
}

function render() {
  render3D();
  drawHudOverlay();
}

function frame(time) {
  const dt = Math.min(0.033, (time - lastFrame) / 1000 || 0);
  lastFrame = time;
  update(dt);
  render();
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
