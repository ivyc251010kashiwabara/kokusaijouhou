// Service Workerの登録処理
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker 登録成功:', reg.scope))
      .catch((err) => console.error('Service Worker 登録失敗:', err));
  });
}

// --- テトリス ゲームロジック ---
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20); // 12x20のグリッド（240x400px）

const scoreElement = document.getElementById('score');
const linesElement = document.getElementById('lines');
const startBtn = document.getElementById('start-btn');
const gameOverOverlay = document.getElementById('game-over-overlay');
const restartBtn = document.getElementById('restart-btn');

let score = 0;
let lines = 0;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isRunning = false;
let requestId = null;

// テトロミノ（ブロック）の種類と色
const COLORS = [
  null,
  '#FF014E', // I: 赤
  '#33FF57', // Z: 緑
  '#3357FF', // S: 青
  '#F3FF33', // O: 黄
  '#FF33F3', // T: ピンク
  '#00FFFF', // L: シアン
  '#FFA500'  // J: オレンジ
];

const PIECES = [
  [],
  [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]], // I
  [[2, 2, 0], [0, 2, 2], [0, 0, 0]],                      // Z
  [[0, 3, 3], [3, 3, 0], [0, 0, 0]],                      // S
  [[4, 4], [4, 4]],                                        // O
  [[0, 5, 0], [5, 5, 5], [0, 0, 0]],                      // T
  [[0, 0, 6], [6, 6, 6], [0, 0, 0]],                      // L
  [[7, 0, 0], [7, 7, 7], [0, 0, 0]]                       // J
];

// 12行 x 20列のフィールドの作成
function createMatrix(w, h) {
  const matrix = [];
  while (h--) {
    matrix.push(new Array(w).fill(0));
  }
  return matrix;
}

const arena = createMatrix(12, 20);

const player = {
  pos: { x: 0, y: 0 },
  matrix: null
};

// 衝突判定
function collide(arena, player) {
  const [m, o] = [player.matrix, player.pos];
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 &&
        (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

// 描画処理
function draw() {
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawMatrix(arena, { x: 0, y: 0 });
  drawMatrix(player.matrix, player.pos);
}

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        context.fillStyle = COLORS[value];
        context.fillRect(x + offset.x, y + offset.y, 1, 1);
        context.strokeStyle = '#000';
        context.lineWidth = 0.05;
        context.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

// 固定されたブロックをフィールドに記録
function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

// ライン消去判定
function arenaSweep() {
  let rowCount = 1;
  outer: for (let y = arena.length - 1; y >= 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) {
        continue outer;
      }
    }
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    ++y;

    score += rowCount * 10;
    lines += 1;
    rowCount *= 2;
  }
  updateScore();
}

function updateScore() {
  scoreElement.innerText = score;
  linesElement.innerText = lines;
}

// 新しいブロックの生成
function playerReset() {
  const pieces = '1234567';
  const id = pieces[pieces.length * Math.random() | 0];
  player.matrix = PIECES[id];
  player.pos.y = 0;
  player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

  if (collide(arena, player)) {
    // ゲームオーバー
    isRunning = false;
    gameOverOverlay.classList.remove('hidden');
    cancelAnimationFrame(requestId);
  }
}

// ブロックの回転
function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) {
    matrix.forEach(row => row.reverse());
  } else {
    matrix.reverse();
  }
}

function playerRotate(dir) {
  if (!isRunning) return;
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function playerMove(offset) {
  if (!isRunning) return;
  player.pos.x += offset;
  if (collide(arena, player)) {
    player.pos.x -= offset;
  }
}

function playerDrop() {
  if (!isRunning) return;
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
  }
  dropCounter = 0;
}

function playerHardDrop() {
  if (!isRunning) return;
  while (!collide(arena, player)) {
    player.pos.y++;
  }
  player.pos.y--;
  merge(arena, player);
  playerReset();
  arenaSweep();
  dropCounter = 0;
}

// ループ処理
function update(time = 0) {
  if (!isRunning) return;

  const deltaTime = time - lastTime;
  lastTime = time;

  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    playerDrop();
  }

  draw();
  requestId = requestAnimationFrame(update);
}

// ゲームリセット・開始
function gameStart() {
  arena.forEach(row => row.fill(0));
  score = 0;
  lines = 0;
  updateScore();
  gameOverOverlay.classList.add('hidden');
  playerReset();
  isRunning = true;
  lastTime = performance.now();
  startBtn.innerText = "一時停止";
  update();
}

function toggleGame() {
  if (isRunning) {
    isRunning = false;
    cancelAnimationFrame(requestId);
    startBtn.innerText = "再開する";
  } else {
    if (gameOverOverlay.classList.contains('hidden')) {
      if (player.matrix === null) {
        gameStart();
      } else {
        isRunning = true;
        lastTime = performance.now();
        startBtn.innerText = "一時停止";
        update();
      }
    } else {
      gameStart();
    }
  }
}

// イベントリスナー設定
startBtn.addEventListener('click', toggleGame);
restartBtn.addEventListener('click', gameStart);

// キーボード操作 (PC向け)
document.addEventListener('keydown', event => {
  if (!isRunning) return;

  if (event.keyCode === 37) { // 左矢印
    playerMove(-1);
  } else if (event.keyCode === 39) { // 右矢印
    playerMove(1);
  } else if (event.keyCode === 40) { // 下矢印
    playerDrop();
  } else if (event.keyCode === 38) { // 上矢印（回転）
    playerRotate(1);
  } else if (event.keyCode === 32) { // スペースキー（一気に落とす）
    playerHardDrop();
  }
});

// ボタンタッチ操作 (スマホ向け)
document.getElementById('btn-left').addEventListener('click', () => playerMove(-1));
document.getElementById('btn-right').addEventListener('click', () => playerMove(1));
document.getElementById('btn-down').addEventListener('click', () => playerDrop());
document.getElementById('btn-rotate').addEventListener('click', () => playerRotate(1));
document.getElementById('btn-drop').addEventListener('click', () => playerHardDrop());

// 初期描画
draw();