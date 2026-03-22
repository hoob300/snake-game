// ────────────────────────────────────────────────────────────
//  뱀게임 메인 로직 (game.js)
//  비전공자도 읽을 수 있도록 한국어 주석을 달아 두었습니다.
// ────────────────────────────────────────────────────────────

// ── 캔버스 준비 ─────────────────────────────────────────────
// HTML에 있는 <canvas id="game-canvas"> 요소를 가져옵니다.
const canvas = document.getElementById('game-canvas');
// 2D 그림 도구(붓)를 가져옵니다. ctx로 선·원·사각형 등을 그립니다.
const ctx    = canvas.getContext('2d');

// 가로 20칸, 세로 20칸 격자로 게임판을 나눕니다.
const COLS = 16, ROWS = 20;
// 한 칸의 픽셀 크기 (캔버스 폭 ÷ 칸 수 = 20px)
const CELL = canvas.width / COLS;

// ── HTML 요소 참조 ──────────────────────────────────────────
// 화면에 표시될 점수, 최고점수, 레벨 텍스트 요소들
const scoreEl      = document.getElementById('score');
const bestEl       = document.getElementById('best-score');
const levelEl      = document.getElementById('level');

// 게임 시작/종료 시 화면 중앙에 뜨는 반투명 덮개(오버레이)
const overlay      = document.getElementById('overlay');
const overlayIcon  = document.getElementById('overlay-icon');   // 이모지 아이콘
const overlayTitle = document.getElementById('overlay-title');  // 제목 텍스트
const overlayMsg   = document.getElementById('overlay-msg');    // 설명 텍스트
const startBtn     = document.getElementById('start-btn');      // 시작 버튼

// 게임 종료 후 이름 입력 영역
const nameSection  = document.getElementById('name-section');
const nameInput    = document.getElementById('player-name');    // 이름 입력칸
const saveBtn      = document.getElementById('save-btn');       // 저장 버튼
const skipBtn      = document.getElementById('skip-btn');       // 건너뛰기 버튼

// 랭킹 관련 요소
const rankingBtn   = document.getElementById('ranking-btn');    // 랭킹 보기 버튼
const rankingModal = document.getElementById('ranking-modal');  // 랭킹 팝업창
const rankingList  = document.getElementById('ranking-list');   // 순위 목록
const closeRanking = document.getElementById('close-ranking');  // 닫기 버튼

// ── 게임 상태 변수 ──────────────────────────────────────────
// 뱀의 현재 위치 배열 / 직전 틱의 위치 배열 (부드러운 이동 보간용)
let snake, prevSnake;
// 현재 이동 방향 / 다음 틱에 적용할 이동 방향
let dir, nextDir;
// 먹이 위치 / 보너스 먹이 위치
let food, bonusFood;
// 점수 / 레벨 / 게임 속도(ms) / 틱 타이머 ID / 일시정지 여부 / 실행 중 여부
let score, level, speed, loopId, paused, running;
// 일반 몹 배열 / 보스 배열 / 불덩이 배열 / 예약된 이펙트 배열 / 틱 카운터 / 토스트 메시지 배열
let enemies, bossEnemies, fireballs, pendingEffects, tickCount, toasts;
// 마지막 틱이 실행된 시각 / 현재 틱 진행도 (0~1, 부드러운 보간에 사용)
let lastTickTime = 0, tickProgress = 0, rAFId = null;

// ── 아이템 시스템 변수 ────────────────────────────────────────
// fieldItems: 맵에 놓인 아이템 배열 [{x, y, type}]
// inventory: 뱀이 먹은 아이템 대기열 (FIFO, 먹은 순서대로 사용)
// frozenTimer: 적 동결 남은 틱 수 (0이면 비활성)
// invincibleTimer: 뱀 무적 남은 틱 수 (0이면 비활성)
// lastItemLevel: 마지막으로 아이템이 스폰된 레벨 (3레벨마다 1개)
let fieldItems, inventory, frozenTimer, invincibleTimer, lastItemLevel;

// 아이템 종류 3가지 정의
// freeze: ⏱️ 적 3초 동결, kill: 💀 랜덤 적 1마리 삭제, invincible: 🛡️ 5초 무적
const ITEM_TYPES = ['freeze', 'kill', 'invincible'];
const ITEM_ICONS = { freeze: '⏱️', kill: '💀', invincible: '🛡️' };
const ITEM_COLORS = { freeze: '#60A5FA', kill: '#F87171', invincible: '#FBBF24' };
const ITEM_NAMES = { freeze: '동결', kill: '처치', invincible: '무적' };

// ── 보스 얼굴 이미지 ────────────────────────────────────────
// snake 폴더 안의 tae.jpg 파일을 불러옵니다.
// 파일이 없으면 자동으로 기본 얼굴이 그려집니다.
const bossImg = new Image();
bossImg.src = './tae.jpg';

// ── 레벨별 몹 등장 수 표 ────────────────────────────────────
// wanderer(방랑자), chaser(추격자), teleporter(순간이동자) 개수를 레벨별로 정의
const ENEMY_DEFS = [
  { wanderers:0, chasers:0, teleporters:0 }, // 레벨 1: 몹 없음
  { wanderers:1, chasers:0, teleporters:0 }, // 레벨 2: 방랑자 1마리
  { wanderers:1, chasers:1, teleporters:0 }, // 레벨 3: 방랑자1 + 추격자1
  { wanderers:2, chasers:1, teleporters:0 }, // 레벨 4
  { wanderers:2, chasers:2, teleporters:0 }, // 레벨 5
  { wanderers:2, chasers:2, teleporters:1 }, // 레벨 6: 순간이동자 추가
];
// 특정 레벨에서 표시할 몹 등장 안내 문구 (현재 미사용)
const ENEMY_INTRO = {
  2:'방랑자 등장!', 3:'추격자 등장!',
  4:'방랑자 추가!', 5:'추격자 추가!', 6:'순간이동자 등장!',
};

// ── 필드 장애물(나무) 맵 ─────────────────────────────────────
// 2 = 벽 나무(테두리), 1 = 필드 내 나무, 0 = 빈 칸
// 뱀·몹·먹이 모두 0이 아닌 칸에 놓일 수 없습니다.
// 16×20 맵. 뱀 시작 위치(7,10) 주변은 반드시 비워둡니다.
const OBSTACLES = (() => {
  const map = [];
  for (let r = 0; r < ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < COLS; c++) map[r][c] = 0;
  }
  // 벽 전체를 나무로 채우기 (테두리 1줄 = 값 2)
  for (let c = 0; c < COLS; c++) { map[0][c] = 2; map[ROWS - 1][c] = 2; }
  for (let r = 0; r < ROWS; r++) { map[r][0] = 2; map[r][COLS - 1] = 2; }
  return map;
})();

// 해당 좌표가 장애물(나무)인지 확인 (1=필드나무, 2=벽나무 모두 장애물)
function onObstacle(p) {
  if (p.x < 0 || p.x >= COLS || p.y < 0 || p.y >= ROWS) return false;
  return OBSTACLES[p.y][p.x] !== 0;
}

// ── 게임 초기화 ─────────────────────────────────────────────
// 게임을 처음 시작하거나 다시 시작할 때 모든 변수를 초기 상태로 되돌립니다.
function init() {
  // 뱀을 게임판 중앙(10,10)에 오른쪽 방향으로 3칸 길이로 배치
  snake       = [{ x:7,y:10 },{ x:6,y:10 },{ x:5,y:10 }];
  prevSnake   = snake.map(s => ({...s})); // 보간용 이전 위치 복사
  dir         = { x:1,y:0 }; // 오른쪽 이동
  nextDir     = { x:1,y:0 };
  score       = 0;
  level       = 1;
  speed       = 210; // 틱 간격(ms). 숫자가 클수록 느림
  paused      = false;
  running     = true;
  bonusFood   = null;
  enemies     = [];
  bossEnemies = [];
  fireballs   = [];
  pendingEffects = [];
  tickCount   = 0;
  toasts      = [];
  // 아이템 시스템 초기화
  fieldItems       = [];    // 맵 위의 아이템 제거
  inventory        = [];    // 인벤토리 비우기
  frozenTimer      = 0;     // 동결 해제
  invincibleTimer  = 0;     // 무적 해제
  lastItemLevel    = 0;     // 아이템 스폰 레벨 초기화
  updateInventoryUI();      // 인벤토리 UI 업데이트

  // 화면 UI 초기화
  scoreEl.textContent = 0;
  levelEl.textContent = 1;
  bestEl.textContent  = getBest();

  placeFood(); // 먹이 위치 결정
  nameSection.classList.add('hidden');    // 이름 입력칸 숨기기
  startBtn.classList.remove('hidden');    // 시작 버튼 보이기
  overlay.classList.add('hidden');        // 오버레이 숨기기

  // 기존 틱 타이머가 있으면 멈추고, 새로 시작
  clearInterval(loopId);
  loopId = setInterval(tick, speed); // 매 210ms마다 tick() 실행

  // requestAnimationFrame(RAF) 루프 시작 (매 프레임마다 화면 다시 그리기)
  cancelAnimationFrame(rAFId);
  lastTickTime = performance.now();
  tickProgress = 0;
  rAFId = requestAnimationFrame(renderLoop);
}

// ── RAF 렌더 루프 ────────────────────────────────────────────
// requestAnimationFrame으로 매 프레임 호출됩니다. (약 60fps)
// tickProgress: 마지막 틱 이후 얼마나 시간이 지났는지 비율 (0→1)
// 이 값을 이용해 뱀/몹/보스를 틱 사이에도 부드럽게 이동시킵니다.
function renderLoop(ts) {
  if (running && !paused) {
    // ts: 현재 시각(ms). 마지막 틱 이후 경과 시간을 speed로 나눠 0~1로 정규화
    tickProgress = Math.min(1, (ts - lastTickTime) / speed);
  }
  draw(); // 화면을 다시 그립니다
  rAFId = requestAnimationFrame(renderLoop); // 다음 프레임도 예약
}

// ── 먹이 배치 ────────────────────────────────────────────────
// 게임판에서 랜덤 칸을 선택합니다.
function randomCell() {
  return { x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS) };
}
// 뱀 몸통 위에 있는지 확인
function onSnake(p) { return snake.some(s => s.x===p.x && s.y===p.y); }
// 일반 몹은 2×2 크기 — 좌상단 좌표(e.x, e.y) 기준으로 4칸 반환
function enemyOccupies(e) {
  const cells = [];
  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++)
      cells.push({ x: e.x + dx, y: e.y + dy });
  return cells;
}
// 다른 일반 몹 위에 있는지 확인 (ex 제외, 2×2 크기 반영)
function onEnemy(p, ex) {
  return enemies.some(e => e !== ex && enemyOccupies(e).some(c => c.x === p.x && c.y === p.y));
}

// 보스는 3×3 = 9칸을 차지합니다.
// 보스의 좌상단 좌표(b.x, b.y)를 기준으로 9개 칸의 좌표를 반환합니다.
function bossOccupies(b) {
  const cells = [];
  for (let dy=0; dy<3; dy++)
    for (let dx=0; dx<3; dx++)
      cells.push({x:b.x+dx, y:b.y+dy});
  return cells;
}
// 해당 칸이 보스 영역에 포함되는지 확인 (ex 제외)
function onBoss(p, ex) {
  return bossEnemies.some(b => b!==ex && bossOccupies(b).some(c=>c.x===p.x&&c.y===p.y));
}

// 해당 칸에 아이템이 있는지 확인
function onItem(p) { return fieldItems.some(it => it.x === p.x && it.y === p.y); }

// 일반 먹이를 뱀·몹·보스·아이템·장애물이 없는 빈 칸에 랜덤 배치
function placeFood() {
  let p;
  do { p = randomCell(); } while (onSnake(p) || onEnemy(p,null) || onBoss(p,null) || onItem(p) || onObstacle(p));
  food = p;
}
// 보너스 먹이(별) 배치. 80틱 후 사라집니다.
function placeBonusFood() {
  let p;
  do { p = randomCell(); }
  while (onSnake(p) || onEnemy(p,null) || onBoss(p,null) || onItem(p) || onObstacle(p) || (p.x===food.x && p.y===food.y));
  bonusFood = { ...p, timer:80 };
}

// ── 몹 보조 함수 ────────────────────────────────────────────
// 뱀 머리와 특정 좌표 사이의 맨해튼 거리 계산 (대각선 없이 가로+세로 합산)
function distToHead(p) {
  const h = snake[0];
  return Math.abs(p.x-h.x) + Math.abs(p.y-h.y);
}
// 레벨에 따라 몹이 몇 틱마다 이동하는지 결정 (숫자가 작을수록 빠름)
function enemyMoveEvery() {
  return level>=6 ? 2 : level>=4 ? 3 : 4;
}
// 새 몹 한 마리를 랜덤 위치에 소환합니다. (2×2 크기)
function spawnEnemy(type) {
  let p, att=0;
  do {
    // 2×2이므로 오른쪽·아래쪽 1칸 여유 필요
    p = { x: Math.floor(Math.random()*(COLS-1)), y: Math.floor(Math.random()*(ROWS-1)) };
    att++;
    // 2×2 영역의 4칸 모두 빈 칸이어야 합니다
    var cells = [{x:p.x,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y+1},{x:p.x+1,y:p.y+1}];
  } while (att<300 && cells.some(c =>
    onSnake(c)||distToHead(c)<6||onEnemy(c,null)||onBoss(c,null)||onItem(c)||onObstacle(c)||(c.x===food.x&&c.y===food.y)
  ));
  const dirs4=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  const d=dirs4[Math.floor(Math.random()*4)];
  // ox, oy: 보간을 위한 이전 위치. mt: 이동 경과 카운터, mi: 이동 주기
  return { type, x:p.x, y:p.y, dx:d.x, dy:d.y, teleTimer:0,
    ox:p.x, oy:p.y, mt:4, mi:4 };
}

// 현재 레벨에 맞게 몹과 보스의 수를 맞춥니다.
// 보스가 등장하면 일반 몹은 모두 사라집니다.
function syncEnemies() {
  const def = ENEMY_DEFS[Math.min(level-1, ENEMY_DEFS.length-1)];
  // 현재 존재하는 각 타입의 몹 수를 셉니다.
  const cnt = { wanderer:0, chaser:0, teleporter:0 };
  enemies.forEach(e => cnt[e.type]++);
  // 부족한 만큼 추가로 소환
  for (let i=cnt.wanderer;   i<def.wanderers;   i++) enemies.push(spawnEnemy('wanderer'));
  for (let i=cnt.chaser;     i<def.chasers;     i++) enemies.push(spawnEnemy('chaser'));
  for (let i=cnt.teleporter; i<def.teleporters; i++) enemies.push(spawnEnemy('teleporter'));

  // 레벨 3마다 보스 1마리 추가 (레벨3→1마리, 레벨6→2마리, ...)
  const bossCount = Math.floor(level/3);
  while (bossEnemies.length < bossCount) {
    const idx = bossEnemies.length;
    const b = spawnBoss(idx); // 인덱스에 따라 스킬 타입이 달라짐
    bossEnemies.push(b);
    // 보스 등장 시 일반 몹·불덩이·이펙트 전부 제거
    enemies = [];
    fireballs = [];
    pendingEffects = [];
  }
}

// ── 보스: 태이 ──────────────────────────────────────────────
// 보스 스킬 종류: 불(fire), 번개(lightning), 폭탄(bomb)
const BOSS_SKILLS = ['fire','lightning','bomb'];
// 보스 스킬 타입별 색상·글로우·이름 설정
const BOSS_STYLE = {
  fire:      { bg:'#7f1d1d', border:'#fbbf24', glow:'rgba(220,50,20,0.55)',  label:'🔥태이-염' },
  lightning: { bg:'#3b0764', border:'#a78bfa', glow:'rgba(139,92,246,0.55)', label:'⚡태이-뇌' },
  bomb:      { bg:'#14532d', border:'#4ade80', glow:'rgba(34,197,94,0.55)',  label:'💣태이-폭' },
};

// 보스를 랜덤 위치에 소환합니다.
// 3×3 크기이므로 오른쪽·아래쪽 2칸 여유를 두고 배치합니다.
function spawnBoss(idx) {
  let p, att=0;
  do {
    p = { x: Math.floor(Math.random()*(COLS-2)), y: Math.floor(Math.random()*(ROWS-2)) };
    att++;
  } while (att<400 && (
    distToHead(p)<10 || // 뱀 머리에서 너무 가까우면 다시 시도
    bossOccupies(p).some(c => onSnake(c)||onEnemy(c,null)||onBoss(c,null)||onObstacle(c)||(c.x===food.x&&c.y===food.y))
  ));
  const dirs4=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  const d=dirs4[Math.floor(Math.random()*4)]; // 랜덤 초기 이동 방향
  return { type:'boss', skillType:BOSS_SKILLS[idx%3], // idx에 따라 스킬 타입 순환
    x:p.x, y:p.y, dx:d.x, dy:d.y, ox:p.x, oy:p.y,
    skillTimer:0,  // 스킬 쿨다운 카운터
    moveTimer:0,   // 이동 보간 카운터
    glowPhase:0    // 글로우 맥동 위상(각도)
  };
}

// 보스 스킬 쿨다운 (속도에 따라 틱 수를 조정해 항상 약 5초)
function getSkillInterval() { return Math.round(5000/speed); }

// 보스 3×3 이동 함수
// 20% 확률로 방향을 바꾸고, 벽에 닿으면 다른 방향으로 전환합니다.
function moveBoss3x3(boss) {
  const dirs4=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  if (Math.random()<0.2) {
    const d=dirs4[Math.floor(Math.random()*4)];
    boss.dx=d.x; boss.dy=d.y;
  }
  // 보스 3×3이 이동 가능한지 확인 (경계 + 장애물)
  function bossCanMove(bx, by) {
    if (bx<0||bx+2>=COLS||by<0||by+2>=ROWS) return false;
    for (let dy=0;dy<3;dy++) for (let dx=0;dx<3;dx++) if (onObstacle({x:bx+dx,y:by+dy})) return false;
    return true;
  }
  const nx=boss.x+boss.dx, ny=boss.y+boss.dy;
  if (!bossCanMove(nx, ny)) {
    const opts=dirs4.filter(d => bossCanMove(boss.x+d.x, boss.y+d.y));
    if (opts.length) {
      const d=opts[Math.floor(Math.random()*opts.length)];
      boss.dx=d.x; boss.dy=d.y;
      boss.x+=boss.dx; boss.y+=boss.dy;
    }
  } else {
    boss.x=nx; boss.y=ny;
  }
}

// 모든 보스를 매 틱 이동·스킬 처리합니다.
function moveBosses() {
  bossEnemies.forEach(boss => {
    // 글로우 맥동 위상 증가 (숨 쉬는 듯한 빛 효과)
    boss.glowPhase = (boss.glowPhase + 0.12) % (Math.PI*2);
    boss.moveTimer++;
    // 7틱마다 한 칸 이동 (이전 위치 ox,oy 저장 후 보간에 사용)
    if (boss.moveTimer >= 7) {
      boss.ox=boss.x; boss.oy=boss.y;
      boss.moveTimer=0;
      moveBoss3x3(boss);
    }
    boss.skillTimer++;
    // 스킬 쿨다운이 다 차면 스킬 발동
    if (boss.skillTimer >= getSkillInterval()) {
      boss.skillTimer = 0;
      triggerBossSkill(boss);
    }
  });
}

// 보스 스킬 발동 함수
function triggerBossSkill(boss) {
  if (boss.skillType === 'fire') {
    // [스킬 1] 불: 3×3 몸체의 4면 중앙에서 불덩이를 각 방향으로 발사
    const mkFire=(x,y,dx,dy)=>({x,y,dx,dy,ox:x,oy:y,moveTimer:0,age:0});
    fireballs.push(mkFire(boss.x,      boss.y+1, -1,  0)); // 왼쪽
    fireballs.push(mkFire(boss.x+2,    boss.y+1,  1,  0)); // 오른쪽
    fireballs.push(mkFire(boss.x+1,    boss.y,    0, -1)); // 위쪽
    fireballs.push(mkFire(boss.x+1,    boss.y+2,  0,  1)); // 아래쪽

  } else if (boss.skillType === 'lightning') {
    // [스킬 2] 번개: 뱀 머리 주변 3×3 칸에 경고 표시 후 번개 낙뢰
    const h = snake[0];
    const cells = [];
    for (let dy=-1; dy<=1; dy++)
      for (let dx=-1; dx<=1; dx++) {
        const cx=h.x+dx, cy=h.y+dy;
        if (cx>=0&&cx<COLS&&cy>=0&&cy<ROWS) cells.push({x:cx,y:cy});
      }
    // lightning_warn: 22틱 경고 표시 후 lightning_strike로 전환
    pendingEffects.push({ type:'lightning_warn', cells, timer:22, maxTimer:22 });

  } else if (boss.skillType === 'bomb') {
    // [스킬 3] 폭탄: 뱀 머리 근처를 향해 포물선으로 날아가 3×3 불타기
    const h = snake[0];
    const off = () => Math.floor(Math.random()*5)-2; // -2~+2 랜덤 오프셋
    const tx = Math.max(1, Math.min(COLS-2, h.x+off())); // 목표 X
    const ty = Math.max(1, Math.min(ROWS-2, h.y+off())); // 목표 Y
    // bomb_fly: 20틱 동안 날아간 후 bomb_burn으로 전환
    pendingEffects.push({ type:'bomb_fly', sx:boss.x+0.5, sy:boss.y+0.5, tx, ty, timer:20, maxTimer:20 });
  }
}

// ── 이펙트 틱 처리 ──────────────────────────────────────────
// pendingEffects 배열의 각 이펙트를 매 틱마다 업데이트합니다.
// 타이머가 0이 되면 다음 단계 이펙트로 전환하거나 제거합니다.
function tickEffects() {
  if (!running) return;
  const toAdd = []; // 이번 틱에 새로 추가할 이펙트

  pendingEffects = pendingEffects.filter(eff => {
    eff.timer--; // 타이머 1 감소

    if (eff.type === 'lightning_warn') {
      // 경고 시간이 다 되면 실제 번개로 전환
      if (eff.timer <= 0) {
        toAdd.push({ type:'lightning_strike', cells:eff.cells, timer:10, maxTimer:10 });
        return false; // 경고 이펙트 제거
      }
      return true;
    }

    if (eff.type === 'lightning_strike') {
      // 번개 칸에 뱀 머리가 있으면 게임 오버 (무적이면 무시)
      if (invincibleTimer <= 0 && eff.cells.some(c => c.x===snake[0].x && c.y===snake[0].y)) {
        gameOver(); return false;
      }
      return eff.timer > 0; // 타이머가 남아 있으면 유지
    }

    if (eff.type === 'bomb_fly') {
      // 폭탄이 목표에 도착하면 3×3 범위를 불태우기로 전환
      if (eff.timer <= 0) {
        const burnCells = [];
        for (let dy=-1; dy<=1; dy++)
          for (let dx=-1; dx<=1; dx++) {
            const bx=eff.tx+dx, by=eff.ty+dy;
            if (bx>=0&&bx<COLS&&by>=0&&by<ROWS) burnCells.push({x:bx,y:by});
          }
        toAdd.push({ type:'bomb_burn', cells:burnCells, timer:40, maxTimer:40 });
        addToast('💥 폭발!', '#ff6600', 1.6);
        return false;
      }
      return true;
    }

    if (eff.type === 'bomb_burn') {
      // 불타는 칸에 뱀 머리가 있으면 게임 오버 (무적이면 무시)
      if (invincibleTimer <= 0 && eff.cells.some(c => c.x===snake[0].x && c.y===snake[0].y)) {
        gameOver(); return false;
      }
      return eff.timer > 0;
    }

    return eff.timer > 0; // 그 외 이펙트는 타이머가 남으면 유지
  });

  // 이번 틱에 새로 생긴 이펙트를 배열에 추가
  pendingEffects.push(...toAdd);
}

// ── 몹 이동 ─────────────────────────────────────────────────
// 모든 일반 몹을 이동시킵니다. (레벨에 따라 몇 틱마다 이동할지 결정)
function moveEnemies() {
  const mi = enemyMoveEvery(); // 이동 주기 (틱)
  const doMove = (tickCount % mi === 0); // 이번 틱에 실제로 이동할지 여부
  enemies.forEach(e => {
    e.mi = mi;
    // mt: 마지막 이동 후 경과 틱 수. 보간 계산에 사용됩니다.
    e.mt = Math.min((e.mt ?? mi) + 1, mi);
    if (!doMove) return;
    e.ox = e.x; e.oy = e.y; // 이동 전 위치 저장 (보간용)
    e.mt = 0;
    if (e.type==='wanderer')   moveWanderer(e);
    else if (e.type==='chaser') moveChaser(e);
    else                        moveTeleporter(e);
  });
}

// 2×2 몹이 이동 가능한지 확인 (경계 + 장애물)
function enemyInBounds(ex, ey) {
  if (ex < 0 || ex + 1 >= COLS || ey < 0 || ey + 1 >= ROWS) return false;
  // 2×2 영역의 4칸이 모두 장애물이 아닌지 확인
  return !onObstacle({x:ex,y:ey}) && !onObstacle({x:ex+1,y:ey})
      && !onObstacle({x:ex,y:ey+1}) && !onObstacle({x:ex+1,y:ey+1});
}

// 방랑자(wanderer): 25% 확률로 방향 전환, 벽에 닿으면 다른 방향으로
function moveWanderer(e) {
  const dirs4=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  if (Math.random()<0.25) {
    const d=dirs4[Math.floor(Math.random()*4)];
    e.dx=d.x; e.dy=d.y;
  }
  const nx=e.x+e.dx, ny=e.y+e.dy;
  if (!enemyInBounds(nx, ny)) {
    const opts=dirs4.filter(d => enemyInBounds(e.x+d.x, e.y+d.y));
    if (opts.length) {
      const d=opts[Math.floor(Math.random()*opts.length)];
      e.dx=d.x; e.dy=d.y; e.x+=e.dx; e.y+=e.dy;
    }
  } else {
    e.x=nx; e.y=ny;
  }
}

// 추격자(chaser): 뱀 머리를 향해 직접 추격
function moveChaser(e) {
  const head=snake[0];
  const dx=head.x-e.x, dy=head.y-e.y;
  if (!dx&&!dy) return; // 이미 같은 위치면 이동 안 함
  // 거리 차이가 큰 축(가로 또는 세로)을 우선 이동
  const pri=Math.abs(dx)>=Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)};
  const sec=Math.abs(dx)>=Math.abs(dy)?{x:0,y:Math.sign(dy)}:{x:Math.sign(dx),y:0};
  for (const m of [pri,sec,{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]) {
    if (!m.x&&!m.y) continue;
    const nx=e.x+m.x, ny=e.y+m.y;
    if (enemyInBounds(nx, ny)) { e.x=nx; e.y=ny; e.dx=m.x; e.dy=m.y; return; }
  }
}

// 순간이동자(teleporter): 22틱마다 뱀 근처 랜덤 위치로 순간이동
function moveTeleporter(e) {
  e.teleTimer++;
  if (e.teleTimer>=22) {
    let p, att=0;
    do {
      p = { x: Math.floor(Math.random()*(COLS-1)), y: Math.floor(Math.random()*(ROWS-1)) };
      att++;
    } while (att<150 && (
      !enemyInBounds(p.x, p.y) || onSnake(p) || distToHead(p)<3 || onEnemy(p,e)
    ));
    e.x=p.x; e.y=p.y; e.teleTimer=0;
  }
}

// 불덩이 이동: 4틱마다 한 칸 이동, ox/oy에 이전 위치 저장 (보간용)
function moveFireballs() {
  fireballs.forEach(f => {
    f.age++;        // 나이 증가 (흔들림 애니메이션에 사용)
    f.moveTimer++;
    if (f.moveTimer >= 4) {
      f.ox = f.x; f.oy = f.y; // 이전 위치 저장
      f.moveTimer = 0;
      f.x += f.dx; f.y += f.dy; // 한 칸 이동
    }
  });
  // 게임판 밖으로 나간 불덩이 제거
  fireballs = fireballs.filter(f => f.x>=0&&f.x<COLS&&f.y>=0&&f.y<ROWS);
}

// 충돌 판정: 뱀 머리가 몹(2×2)·보스·불덩이에 닿았는지 확인
function checkCollision(head) {
  if (enemies.some(e=>enemyOccupies(e).some(c=>c.x===head.x&&c.y===head.y))) return true;
  if (bossEnemies.some(b=>bossOccupies(b).some(c=>c.x===head.x&&c.y===head.y))) return true;
  if (fireballs.some(f=>f.x===head.x&&f.y===head.y)) return true;
  return false;
}

// ── 게임 틱 (로직 루프) ─────────────────────────────────────
// setInterval로 매 speed(ms)마다 호출됩니다.
// 뱀 이동, 먹이 처리, 충돌 판정, 레벨업 등 모든 게임 로직을 담당합니다.
function tick() {
  if (paused||!running) return;

  // 이번 틱 직전의 뱀 위치를 저장 (부드러운 보간에 사용)
  prevSnake = snake.map(s=>({...s}));
  lastTickTime = performance.now(); // 현재 틱 시각 기록
  tickProgress = 0;                 // 보간 진행도 초기화

  tickCount++;
  dir = {...nextDir}; // 예약된 방향을 실제 방향으로 적용

  // 뱀 머리의 다음 위치 계산
  const head = { x:snake[0].x+dir.x, y:snake[0].y+dir.y };

  // 벽 또는 장애물에 닿으면 수직 방향으로 랜덤하게 꺾습니다.
  // isBlocked: 게임판 밖이거나 나무 장애물이면 true
  function isBlocked(p) {
    return p.x < 0 || p.x >= COLS || p.y < 0 || p.y >= ROWS || onObstacle(p);
  }
  if (isBlocked(head)) {
    const perps = dir.x !== 0
      ? [{x:0,y:-1},{x:0,y:1}]
      : [{x:-1,y:0},{x:1,y:0}];
    const pick = Math.floor(Math.random()*2);
    let nd = perps[pick];
    let nh = { x: snake[0].x + nd.x, y: snake[0].y + nd.y };
    if (isBlocked(nh)) {
      nd = perps[1-pick];
      nh = { x: snake[0].x + nd.x, y: snake[0].y + nd.y };
    }
    if (isBlocked(nh)) return; // 양쪽 다 막힘
    dir = nd; nextDir = nd;
    head.x = nh.x; head.y = nh.y;
  }

  // 자기 몸통에 부딪히면 게임 오버 (무적이어도 자기 몸은 피해야 함)
  if (onSnake(head)) return gameOver();

  // 머리를 맨 앞에 추가 (뱀이 한 칸 앞으로 이동)
  snake.unshift(head);

  // 이동 후 충돌 확인 (몹·보스·불덩이) — 무적 상태면 무시
  if (invincibleTimer <= 0 && checkCollision(head)) return gameOver();

  // 먹이 처리
  let ate=false;
  if (head.x===food.x&&head.y===food.y) {
    // 일반 먹이 먹음: 점수+, 새 먹이 배치, 30% 확률로 보너스 먹이 등장
    score+=10*level; ate=true; placeFood();
    if (!bonusFood&&Math.random()<0.3) placeBonusFood();
  } else if (bonusFood&&head.x===bonusFood.x&&head.y===bonusFood.y) {
    // 보너스 먹이(별) 먹음: 3배 점수
    score+=30*level; ate=true; bonusFood=null;
  } else {
    // 먹이를 못 먹으면 꼬리 제거 (길이 유지)
    snake.pop();
  }

  // 보너스 먹이 타이머 감소
  if (bonusFood) { bonusFood.timer--; if (bonusFood.timer<=0) bonusFood=null; }

  // ── 아이템 줍기 (뱀 머리가 아이템 위에 도착하면) ──
  const head2 = snake[0];
  fieldItems = fieldItems.filter(item => {
    if (item.x === head2.x && item.y === head2.y) {
      // 인벤토리에 추가 (최대 5개까지)
      if (inventory.length < 5) {
        inventory.push(item.type);
        updateInventoryUI();
        addToast(`${ITEM_ICONS[item.type]} ${ITEM_NAMES[item.type]} 획득!`, ITEM_COLORS[item.type], 1.2);
      }
      return false; // 맵에서 제거
    }
    return true;
  });

  // ── 동결/무적 타이머 감소 ──
  if (frozenTimer > 0) frozenTimer--;
  if (invincibleTimer > 0) invincibleTimer--;

  // 몹·보스·불덩이 이동 및 이펙트 처리
  // 동결 중이면 적 이동과 보스 스킬을 멈춥니다
  if (frozenTimer <= 0) {
    moveEnemies();
    moveBosses();
    moveFireballs();
  }
  // 몹(2×2)이 뱀의 몸통(꼬리)에 닿으면 그 몹은 사라집니다.
  enemies = enemies.filter(e => !enemyOccupies(e).some(c => snake.slice(1).some(s=>s.x===c.x&&s.y===c.y)));
  tickEffects();

  // 이동 후 다시 한 번 충돌 확인 (불덩이가 이동해서 뱀과 겹칠 수 있음) — 무적이면 무시
  if (invincibleTimer <= 0 && checkCollision(snake[0])) return gameOver();

  // 먹이를 먹었을 때만 점수와 레벨을 업데이트합니다.
  if (ate) { scoreEl.textContent=score; updateLevel(); }
}

// 레벨 업 처리: 100점마다 레벨이 1씩 오릅니다.
function updateLevel() {
  const nl = Math.floor(score/100)+1; // 새 레벨 계산
  if (nl!==level) {
    level=nl;
    levelEl.textContent=level;
    // 속도는 고정 (레벨이 올라도 speed 값 변경 없음)
    syncEnemies();               // 새 레벨에 맞는 몹/보스 소환
    addToast(`LEVEL ${level}`,'#facc15',1.5); // 레벨업 메시지 표시

    // 3레벨마다 아이템 1개 스폰 (레벨 3, 6, 9, 12, ...)
    const itemLevelGroup = Math.floor(level / 3); // 현재 속한 3레벨 구간
    if (level >= 3 && itemLevelGroup > lastItemLevel) {
      lastItemLevel = itemLevelGroup;
      spawnFieldItem();
      addToast('🎁 아이템 등장!', '#60A5FA', 1.3);
    }
  }
}

// ── 토스트 메시지 ───────────────────────────────────────────
// 화면 중앙에 잠깐 뜨는 알림 텍스트 (예: "LEVEL 2", "💥 폭발!")
function addToast(text, color='#facc15', scale=1) {
  toasts.push({text, color, scale, alpha:1.0, y:canvas.height/2-20});
}
// 매 프레임 토스트를 위로 움직이고 점점 투명하게 만듭니다.
function tickToasts() {
  toasts.forEach(t=>{ t.alpha-=0.018; t.y-=0.6; });
  toasts = toasts.filter(t=>t.alpha>0); // 완전히 투명해진 것은 제거
}
// 토스트를 화면에 그립니다.
function drawToasts() {
  toasts.forEach(t=>{
    ctx.save();
    ctx.globalAlpha=t.alpha;
    ctx.fillStyle=t.color;
    ctx.font=`bold ${Math.round(18*t.scale)}px 'Segoe UI',sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=6;
    ctx.fillText(t.text, canvas.width/2, t.y);
    ctx.restore();
  });
}

// ── 전체 화면 그리기 ─────────────────────────────────────────
// draw()는 RAF 루프에서 매 프레임 호출되어 화면 전체를 다시 그립니다.
// ── 구름 그리기 ─────────────────────────────────────────────
// 바다 배경 위에 흰 구름 2~3개가 천천히 떠다닙니다.
// 구름 위치 데이터 (x좌표는 시간에 따라 이동, y좌표는 고정)
const CLOUDS = [
  { baseX: 30,  y: 25,  size: 1.0, speed: 0.015 }, // 구름 1: 왼쪽 위
  { baseX: 200, y: 15,  size: 0.7, speed: 0.02  }, // 구름 2: 오른쪽 위 (작음)
  { baseX: 120, y: 45,  size: 0.85, speed: 0.01 }, // 구름 3: 중간 아래
];

function drawClouds() {
  const now = performance.now(); // 현재 시각으로 구름 위치를 계산
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // 반투명 흰색
  CLOUDS.forEach(c => {
    // x좌표가 시간에 따라 오른쪽으로 이동하고, 화면 밖으로 나가면 왼쪽에서 다시 등장
    const x = (c.baseX + now * c.speed) % (canvas.width + 60) - 30;
    const y = c.y;
    const s = c.size;
    // 구름 = 둥근 원 3개를 겹쳐서 뭉게뭉게 모양 만들기
    ctx.beginPath();
    ctx.arc(x,        y,       12 * s, 0, Math.PI * 2); // 왼쪽 원
    ctx.arc(x + 14*s, y - 5*s, 15 * s, 0, Math.PI * 2); // 가운데 원 (위로 솟음)
    ctx.arc(x + 28*s, y,       11 * s, 0, Math.PI * 2); // 오른쪽 원
    ctx.fill();
  });
}

function draw() {
  drawGrid();            // 숲 바닥 + 나무 장애물 + 벽
  drawFood();            // 일반 먹이 (빨간 사과)
  if (bonusFood) drawBonusFood(); // 보너스 먹이 (황금 별)
  drawPendingEffects();  // 번개 경고·낙뢰·폭탄 날아가기·불타기
  drawFireballs();       // 불덩이
  drawEnemies();         // 일반 몹
  drawBosses();          // 보스 태이
  drawFieldItems();      // 맵 위 아이템
  drawSnake();           // 뱀
  drawInvincibleShield(); // 무적 쉴드 효과
  drawFreezeOverlay();   // 동결 서리 효과
  tickToasts();          // 토스트 위치·투명도 업데이트
  drawToasts();          // 토스트 그리기
}

// ── 숲 스타일 필드 + 나무 장애물 + 나무 벽 그리기 ──────────────

function drawGrid() {
  // ── 바닥: 초록 체커보드 패턴 (초기 디자인) ──
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (OBSTACLES[r][c]) continue; // 장애물 칸은 나중에 따로 그림
      ctx.fillStyle = (r + c) % 2 === 0 ? '#6DB844' : '#5FA838';
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }

  // ── 벽 풀숲(부시) 그리기 (OBSTACLES 값 2) ──
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (OBSTACLES[r][c] !== 2) continue;
      const px = c * CELL, py = r * CELL;
      const cx = px + CELL / 2, cy = py + CELL / 2;

      // 풀숲 바탕
      ctx.fillStyle = '#2E7D32';
      ctx.fillRect(px, py, CELL, CELL);

      // 둥근 부시 구체
      const bushR = CELL * 0.58;
      const grd = ctx.createRadialGradient(cx - 2, cy - 2, 2, cx, cy, bushR);
      grd.addColorStop(0, '#66BB6A');
      grd.addColorStop(0.4, '#43A047');
      grd.addColorStop(0.8, '#2E7D32');
      grd.addColorStop(1, '#1B5E20');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, bushR, 0, Math.PI * 2); ctx.fill();

      // 볼록 하이라이트
      const hash = (c * 7 + r * 11) % 5;
      ctx.fillStyle = 'rgba(129,199,132,0.4)';
      ctx.beginPath();
      ctx.arc(cx - 3 + hash, cy - 3, bushR * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // 테두리
      ctx.strokeStyle = '#1B5E20'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, bushR, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // ── 필드 내 나무 그리기 (OBSTACLES 값 1) ──
  // 이미지 참고: 둥근 수관(여러 겹 초록) + 갈색 줄기 + 뿌리
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (OBSTACLES[r][c] !== 1) continue;
      const px = c * CELL, py = r * CELL;
      const cx = px + CELL / 2;

      // ── 뿌리 (땅 위로 살짝 보이는 갈색 뿌리) ──
      ctx.fillStyle = '#5D4037'; ctx.strokeStyle = '#4E342E';
      ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      // 왼쪽 뿌리 (두꺼운 곡선)
      ctx.beginPath();
      ctx.moveTo(cx - 3, py + CELL - 3);
      ctx.quadraticCurveTo(cx - 7, py + CELL - 1, cx - 9, py + CELL + 1);
      ctx.lineTo(cx - 7, py + CELL + 1);
      ctx.quadraticCurveTo(cx - 5, py + CELL - 1, cx - 2, py + CELL - 4);
      ctx.fill();
      // 오른쪽 뿌리
      ctx.beginPath();
      ctx.moveTo(cx + 3, py + CELL - 3);
      ctx.quadraticCurveTo(cx + 7, py + CELL - 1, cx + 9, py + CELL + 1);
      ctx.lineTo(cx + 7, py + CELL + 1);
      ctx.quadraticCurveTo(cx + 5, py + CELL - 1, cx + 2, py + CELL - 4);
      ctx.fill();

      // ── 줄기 (짧고 굵은 갈색 기둥) ──
      ctx.fillStyle = '#5D4037';
      roundRect(ctx, cx - 4, py + 8, 8, CELL - 8, 2); ctx.fill();
      // 줄기 밝은 면 (나무껍질 질감)
      ctx.fillStyle = '#795548';
      roundRect(ctx, cx - 2, py + 9, 3, CELL - 10, 1); ctx.fill();
      // 줄기 어두운 면
      ctx.fillStyle = '#4E342E';
      ctx.fillRect(cx + 2, py + 9, 1.5, CELL - 10);

      // ── 수관: 3겹 둥근 잎사귀 뭉치 (아래→위 점점 밝아짐) ──
      // 이미지처럼 둥근 구체가 여러 겹 겹쳐서 풍성한 나무 형태

      // 1층 (가장 아래, 가장 어두운 초록) — 넓게
      ctx.fillStyle = '#1B5E20';
      ctx.beginPath(); ctx.arc(cx, py + 8, 9, 0, Math.PI * 2); ctx.fill();
      // 왼쪽·오른쪽 잎 뭉치
      ctx.beginPath(); ctx.arc(cx - 5, py + 7, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, py + 7, 6, 0, Math.PI * 2); ctx.fill();

      // 2층 (중간, 중간 초록)
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath(); ctx.arc(cx, py + 5, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - 4, py + 5, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, py + 5, 5.5, 0, Math.PI * 2); ctx.fill();

      // 3층 (위, 밝은 초록)
      ctx.fillStyle = '#43A047';
      ctx.beginPath(); ctx.arc(cx, py + 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - 3, py + 3, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3, py + 3, 5, 0, Math.PI * 2); ctx.fill();

      // 꼭대기 (가장 밝은 연두)
      ctx.fillStyle = '#66BB6A';
      ctx.beginPath(); ctx.arc(cx, py, 5, 0, Math.PI * 2); ctx.fill();

      // 하이라이트 (빛 반사 — 왼쪽 위)
      ctx.fillStyle = 'rgba(165,214,167,0.5)';
      ctx.beginPath(); ctx.arc(cx - 3, py - 1, 3, 0, Math.PI * 2); ctx.fill();

      // 수관 전체 외곽 테두리 (어두운 초록)
      ctx.strokeStyle = '#1B5E20'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, py + 4, 10, 0, Math.PI * 2); ctx.stroke();

      // 그림자 (나무 아래)
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(cx, py + CELL - 1, CELL * 0.45, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── 뱀 그리기 ───────────────────────────────────────────────
// tickProgress를 이용해 뱀의 각 마디를 이전 위치와 현재 위치 사이 어딘가에 그립니다.
// 이 덕분에 틱 사이에도 매끄럽게 움직이는 것처럼 보입니다.
function getInterp() {
  return snake.map((seg, i) => {
    const prev = i<prevSnake.length ? prevSnake[i] : seg;
    return {
      x: prev.x + (seg.x - prev.x) * tickProgress, // 이전→현재 위치 선형 보간
      y: prev.y + (seg.y - prev.y) * tickProgress,
    };
  });
}

function drawSnake() {
  const interp = getInterp();
  if (interp.length === 0) return;

  // 각 마디의 픽셀 중심 좌표를 미리 계산합니다
  const pts = interp.map(s => ({
    x: s.x * CELL + CELL / 2,
    y: s.y * CELL + CELL / 2,
  }));

  // ── 몸통 두께: 머리부터 꼬리까지 완전 동일 ──
  const W = CELL * 0.82;          // 몸통 균일 두께

  // 모든 마디가 동일한 두께입니다 (꼬리 끝은 별도로 둥글게 그림)
  function widthAt() {
    return W;
  }

  // ── 뱀 색상: 얼룩덜룩한 자연 뱀 패턴 ──
  const SNAKE_DARK   = '#1A5C32'; // 어두운 테두리
  const SNAKE_HEAD   = '#34A853'; // 머리 밝은 초록
  // 얼룩 색상 배열 (어두운 올리브~갈색~검은색 반점)
  const BLOTCH_COLORS = ['#2C5F2D', '#1B4332', '#3B3024', '#4A6741', '#254D32'];

  // ── 1단계: 그림자 ──
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = W + 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(pts[0].x + 3, pts[0].y + 4);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x + 3, pts[i].y + 4);
  ctx.stroke();
  ctx.restore();

  // ── 2단계: 메인 몸통 (세그먼트마다 약간 다른 색으로 얼룩 표현) ──
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i + 1], b = pts[i];
    const w = (widthAt(i) + widthAt(i + 1)) / 2;
    // 마디마다 색상을 미세하게 변화시켜 얼룩덜룩한 느낌
    const colorIdx = i % 3;
    const baseColors = ['#3E8E41', '#367D39', '#469B49'];
    ctx.strokeStyle = baseColors[colorIdx];
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // ── 3단계: 배(복부) — 연한 노란빛 줄 ──
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i + 1], b = pts[i];
    const w = widthAt(i) * 0.28;
    ctx.strokeStyle = 'rgba(200,220,140,0.35)';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x - 1, a.y - 1);
    ctx.lineTo(b.x - 1, b.y - 1);
    ctx.stroke();
  }
  ctx.restore();

  // ── 4단계: 불규칙 얼룩 반점 (뱀 특유의 패턴) ──
  // 몸통을 따라 크기·위치가 불규칙한 어두운 반점을 그립니다
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const prev = pts[i - 1], next = pts[Math.min(i + 1, pts.length - 1)];
    const dx = next.x - prev.x, dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const fwd = { x: dx / len, y: dy / len };
    const prp = { x: -fwd.y, y: fwd.x };
    const hw = widthAt(i) * 0.38; // 반폭

    // 의사 랜덤 해시로 반점 패턴 결정 (매 프레임 동일)
    const hash = (i * 7 + 3) % 11;

    if (hash < 4) {
      // 큰 얼룩 반점 (어두운 색 타원)
      const bx = p.x + prp.x * (hash - 2) * 2;
      const by = p.y + prp.y * (hash - 2) * 2;
      const blobR = hw * (0.5 + (hash % 3) * 0.15);
      ctx.fillStyle = BLOTCH_COLORS[hash % BLOTCH_COLORS.length];
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.ellipse(bx, by, blobR, blobR * 0.7, Math.atan2(fwd.y, fwd.x), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (hash < 7) {
      // 중간 크기 마름모 비늘
      const sz = hw * 0.55;
      ctx.fillStyle = BLOTCH_COLORS[(hash + 2) % BLOTCH_COLORS.length];
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x + fwd.x * sz, p.y + fwd.y * sz);
      ctx.lineTo(p.x + prp.x * sz * 0.6, p.y + prp.y * sz * 0.6);
      ctx.lineTo(p.x - fwd.x * sz, p.y - fwd.y * sz);
      ctx.lineTo(p.x - prp.x * sz * 0.6, p.y - prp.y * sz * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 작은 점 반점 (모든 마디에 랜덤 위치)
    if (hash % 2 === 0) {
      const dotOff = (hash % 4 - 1.5) * 3;
      ctx.fillStyle = '#1B4332';
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(p.x + prp.x * dotOff, p.y + prp.y * dotOff, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ── 5단계: 가장자리 어두운 테두리 + 비늘 질감 ──
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i + 1], b = pts[i];
    const w = (widthAt(i) + widthAt(i + 1)) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len;

    // 양쪽 가장자리 (얼룩처럼 불규칙한 두께)
    ctx.strokeStyle = 'rgba(26,67,50,0.5)';
    ctx.lineWidth = 1.5 + (i % 3) * 0.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x + nx * w * 0.46, a.y + ny * w * 0.46);
    ctx.lineTo(b.x + nx * w * 0.46, b.y + ny * w * 0.46);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x - nx * w * 0.46, a.y - ny * w * 0.46);
    ctx.lineTo(b.x - nx * w * 0.46, b.y - ny * w * 0.46);
    ctx.stroke();
  }

  // ── 6단계: 옆면 갈라진 비늘 줄무늬 ──
  for (let i = 1; i < pts.length - 1; i++) {
    if (i % 2 !== 0) continue; // 2마디마다
    const p = pts[i];
    const prev = pts[i - 1], next = pts[Math.min(i + 1, pts.length - 1)];
    const dx = next.x - prev.x, dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const prp = { x: dy / len, y: -dx / len };
    const w = widthAt(i) * 0.46;

    ctx.strokeStyle = 'rgba(27,67,50,0.3)';
    ctx.lineWidth = 0.8;
    // 양쪽 비늘 줄
    ctx.beginPath();
    ctx.moveTo(p.x + prp.x * w * 0.5, p.y + prp.y * w * 0.5);
    ctx.lineTo(p.x + prp.x * w, p.y + prp.y * w);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - prp.x * w * 0.5, p.y - prp.y * w * 0.5);
    ctx.lineTo(p.x - prp.x * w, p.y - prp.y * w);
    ctx.stroke();
  }

  // ── 7단계: 머리 그리기 (삼각형에 가까운 뱀 머리) ──
  const h = pts[0];
  const hx = h.x, hy = h.y;
  const R = CELL * 0.55;
  const ed = dir;
  const perp = { x: -ed.y, y: ed.x };

  // 머리 본체 (진한 초록 3D 구체, 약간 앞으로 납작한 타원)
  ctx.save();
  const headW = R * 1.1; // 좌우 폭
  const headH = R * 0.9; // 앞뒤 높이

  // 머리 그라데이션 (밝은 초록 → 진한 초록)
  const hGrd = ctx.createRadialGradient(
    hx - perp.x * 2 - ed.x * 2, hy - perp.y * 2 - ed.y * 2, 1,
    hx, hy, R
  );
  hGrd.addColorStop(0, '#5CD685');   // 밝은 초록 하이라이트
  hGrd.addColorStop(0.4, SNAKE_HEAD); // 메인 초록
  hGrd.addColorStop(1, SNAKE_DARK);   // 진한 테두리
  ctx.fillStyle = hGrd;

  // 타원형 머리 (이동 방향으로 약간 납작)
  ctx.beginPath();
  const headAngle = Math.atan2(ed.y, ed.x);
  ctx.ellipse(hx + ed.x * 2, hy + ed.y * 2, headW, headH, headAngle, 0, Math.PI * 2);
  ctx.fill();

  // 머리 위 비늘 패턴 (V자 형태)
  ctx.strokeStyle = 'rgba(26,92,50,0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(hx + perp.x * 4, hy + perp.y * 4);
  ctx.lineTo(hx - ed.x * 3, hy - ed.y * 3);
  ctx.lineTo(hx - perp.x * 4, hy - perp.y * 4);
  ctx.stroke();

  // 머리 상단 하이라이트 (빛 반사)
  ctx.fillStyle = 'rgba(160,230,180,0.35)';
  ctx.beginPath();
  ctx.ellipse(hx - ed.x * 1 - perp.x * 1, hy - ed.y * 1 - perp.y * 1,
    R * 0.35, R * 0.18, headAngle - 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 눈 2개 (세로로 긴 동공 — 실제 뱀의 슬릿 동공)
  const fwd = 4;
  const eyeSpread = 4.0;
  const e1 = { x: hx + ed.x * fwd + perp.x * eyeSpread, y: hy + ed.y * fwd + perp.y * eyeSpread };
  const e2 = { x: hx + ed.x * fwd - perp.x * eyeSpread, y: hy + ed.y * fwd - perp.y * eyeSpread };
  const eyeAngle = Math.atan2(ed.y, ed.x); // 동공 각도 (이동 방향 기준)

  [e1, e2].forEach(e => {
    // 노란 홍채 (뱀의 특징적인 노란 눈)
    ctx.fillStyle = '#E8D44D';
    ctx.beginPath(); ctx.arc(e.x, e.y, 3.5, 0, Math.PI * 2); ctx.fill();
    // 어두운 테두리
    ctx.strokeStyle = '#2D5A1E';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(e.x, e.y, 3.5, 0, Math.PI * 2); ctx.stroke();
    // 세로 슬릿 동공 (뱀 특유의 세로 눈)
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(e.x + ed.x * 0.3, e.y + ed.y * 0.3,
      0.9, 2.8, eyeAngle + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    // 작은 반짝임
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(e.x - 0.8, e.y - 1.0, 0.9, 0, Math.PI * 2); ctx.fill();
  });

  // 콧구멍 2개 (머리 앞쪽에 작은 구멍)
  const noseD = R * 0.7;
  const n1 = { x: hx + ed.x * noseD + perp.x * 2, y: hy + ed.y * noseD + perp.y * 2 };
  const n2 = { x: hx + ed.x * noseD - perp.x * 2, y: hy + ed.y * noseD - perp.y * 2 };
  ctx.fillStyle = '#1A4D2E';
  [n1, n2].forEach(n => {
    ctx.beginPath(); ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2); ctx.fill();
  });

  // 혀 내밀기 (주기적으로 빨간 갈라진 혀)
  if (Math.floor(tickCount / 10) % 4 === 0) {
    const tx = hx + ed.x * (R + 2), ty = hy + ed.y * (R + 2);
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    // 혀 줄기
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + ed.x * 6, ty + ed.y * 6);
    ctx.stroke();
    // 갈라진 혀 끝 (Y자 형태)
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tx + ed.x * 6, ty + ed.y * 6);
    ctx.lineTo(tx + ed.x * 8 + perp.x * 2.5, ty + ed.y * 8 + perp.y * 2.5);
    ctx.moveTo(tx + ed.x * 6, ty + ed.y * 6);
    ctx.lineTo(tx + ed.x * 8 - perp.x * 2.5, ty + ed.y * 8 - perp.y * 2.5);
    ctx.stroke();
  }

  // ── 8단계: 꼬리 끝 (마지막 1칸만 뾰족하게 둥글림) ──
  if (pts.length > 1) {
    const tail = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    // 꼬리 방향 계산
    const tdx = tail.x - prev.x, tdy = tail.y - prev.y;
    const tLen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    const tDir = { x: tdx / tLen, y: tdy / tLen };

    // 둥근 끝 (초록 그라데이션)
    const tR = W * 0.45;
    const tipX = tail.x + tDir.x * tR * 0.3; // 약간 끝 방향으로 이동
    const tipY = tail.y + tDir.y * tR * 0.3;
    const tGrd = ctx.createRadialGradient(tipX - 1, tipY - 1, 0, tipX, tipY, tR);
    tGrd.addColorStop(0, '#3E8E41');
    tGrd.addColorStop(1, SNAKE_DARK);
    ctx.fillStyle = tGrd;
    ctx.beginPath(); ctx.arc(tipX, tipY, tR, 0, Math.PI * 2); ctx.fill();
  }
}

// 뱀 몸통 색상 (비늘 패턴에 사용 — 초록 계열)
function bodyColor(i, len) {
  const t = i / (len - 1 || 1);
  const r = Math.round(45 - t * 10);   // 45→35
  const g = Math.round(139 - t * 30);  // 139→109
  const b = Math.round(78 - t * 15);   // 78→63
  return `rgb(${r},${g},${b})`;
}
// 밝은 색상 (하이라이트용)
function bodyColorLight(i, len) {
  const t = i / (len - 1 || 1);
  const r = Math.round(92 - t * 20);
  const g = Math.round(214 - t * 40);
  const b = Math.round(133 - t * 25);
  return `rgb(${r},${g},${b})`;
}

// ── 먹이 그리기 (빨간 사과 모양 + 초록 잎사귀) ──────────────
function drawFood() {
  const x=food.x*CELL, y=food.y*CELL;
  const cx=x+CELL/2;
  const R=CELL*0.42; // 사과 반지름

  // 바운스 애니메이션 (위아래로 통통 튀는 효과)
  const t = performance.now() / 1000; // 초 단위 시간
  const bounce = Math.abs(Math.sin(t * 3)) * 4; // 0~4px 위아래 바운스
  const cy = y + CELL/2 - 2 - bounce; // 기본 위치에서 위로 띄움 + 바운스

  // 그림자 (바닥에 고정, 바운스 높이에 따라 크기 변화)
  const shadowScale = 1 - bounce / 12; // 높이 올라갈수록 그림자 작아짐
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x + CELL/2, y + CELL - 2, CELL * 0.3 * shadowScale, 2.5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // 은은한 빨간 빛 (글로우)
  const grd=ctx.createRadialGradient(cx,cy,1,cx,cy,CELL*0.8);
  grd.addColorStop(0,'rgba(248,113,113,0.4)'); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.fillRect(x-CELL*0.3,cy-CELL*0.5,CELL*1.6,CELL*1.6);

  // 사과 본체 (3D 입체 — 여러 겹 그라데이션)
  // 아래쪽 어두운 반원 (그림자 면)
  ctx.fillStyle = '#7F1D1D';
  ctx.beginPath(); ctx.arc(cx, cy + 2, R, 0, Math.PI * 2); ctx.fill();

  // 메인 사과 (밝은 빨강 그라데이션)
  const appleGrd=ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, R);
  appleGrd.addColorStop(0,'#FF8A8A'); // 아주 밝은 빨강 (하이라이트)
  appleGrd.addColorStop(0.3,'#FF6B6B'); // 밝은 빨강
  appleGrd.addColorStop(0.7,'#DC2626'); // 진한 빨강
  appleGrd.addColorStop(1,'#991B1B'); // 가장 어두운 테두리
  ctx.fillStyle=appleGrd;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // 사과 테두리 (입체감 강조)
  ctx.strokeStyle = 'rgba(127,29,29,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

  // 큰 하이라이트 (왼쪽 위 빛 반사 — 유리 같은 광택)
  ctx.fillStyle='rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.ellipse(cx - 2, cy - 3, R * 0.35, R * 0.22, -0.5, 0, Math.PI * 2); ctx.fill();

  // 작은 반짝임 점
  ctx.fillStyle='rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(cx - 3, cy - 4, 1.2, 0, Math.PI * 2); ctx.fill();

  // 꼭지 (갈색 줄기 — 더 두껍고 자연스럽게)
  ctx.strokeStyle='#78350F';
  ctx.lineWidth=2;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - R + 1);
  ctx.quadraticCurveTo(cx + 1, cy - R - 2, cx + 2, cy - R - 4);
  ctx.stroke();

  // 초록 잎사귀 (더 크고 입체적)
  ctx.fillStyle='#22C55E';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy - R - 2, 4, 2, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // 잎사귀 밝은 면
  ctx.fillStyle='rgba(134,239,172,0.6)';
  ctx.beginPath();
  ctx.ellipse(cx + 3.5, cy - R - 2.5, 2.5, 1, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // 사과 아래쪽 반사광 (바닥 반사)
  ctx.fillStyle='rgba(255,200,200,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + R * 0.6, R * 0.5, R * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
}

// 보너스 먹이(황금 별): 타이머가 20 이하로 남으면 깜빡입니다.
function drawBonusFood() {
  const x=bonusFood.x*CELL, y=bonusFood.y*CELL;
  const baseCx=x+CELL/2;
  // 3틱마다 교대로 보였다 사라졌다 (깜빡임)
  if (bonusFood.timer<20&&Math.floor(bonusFood.timer/3)%2!==0) return;

  // 바운스 애니메이션 (사과와 다른 주기로 통통 튀기)
  const t = performance.now() / 1000;
  const bounce = Math.abs(Math.sin(t * 3.5 + 1)) * 5; // 0~5px 바운스 (별은 좀 더 높이)
  const cx = baseCx;
  const cy = y + CELL/2 - 3 - bounce; // 기본 위치에서 위로 띄움 + 바운스

  // 그림자 (바닥에 고정)
  const shadowScale = 1 - bounce / 15;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(baseCx, y + CELL - 2, CELL * 0.28 * shadowScale, 2 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // 황금빛 글로우 (주변에 퍼지는 빛)
  const grd=ctx.createRadialGradient(cx,cy,1,cx,cy,CELL);
  grd.addColorStop(0,'rgba(250,204,21,0.55)'); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.fillRect(x-CELL*0.3,cy-CELL*0.5,CELL*1.6,CELL*1.6);

  // 황금 별 모양 그리기 (5각 별)
  const R=CELL*0.42;    // 바깥 꼭짓점 반지름
  const r=CELL*0.18;    // 안쪽 꼭짓점 반지름

  // 별 그림자 (약간 아래 + 어둡게)
  ctx.fillStyle = 'rgba(180,120,0,0.3)';
  ctx.beginPath();
  for (let i=0; i<10; i++) {
    const angle = -Math.PI/2 + (i * Math.PI / 5);
    const radius = i % 2 === 0 ? R : r;
    const sx = cx + Math.cos(angle) * radius;
    const sy = cy + 2 + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.closePath(); ctx.fill();

  // 별 본체 (입체 그라데이션)
  const starGrd=ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, R);
  starGrd.addColorStop(0,'#FEF3C7'); // 아주 밝은 금색 (하이라이트)
  starGrd.addColorStop(0.3,'#FDE68A'); // 밝은 금색
  starGrd.addColorStop(0.7,'#F59E0B'); // 진한 금색
  starGrd.addColorStop(1,'#D97706'); // 가장 어두운 금색
  ctx.fillStyle=starGrd;
  ctx.beginPath();
  for (let i=0; i<10; i++) {
    const angle = -Math.PI/2 + (i * Math.PI / 5);
    const radius = i % 2 === 0 ? R : r;
    const sx = cx + Math.cos(angle) * radius;
    const sy = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.closePath(); ctx.fill();

  // 별 테두리
  ctx.strokeStyle = 'rgba(180,100,0,0.4)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i=0; i<10; i++) {
    const angle = -Math.PI/2 + (i * Math.PI / 5);
    const radius = i % 2 === 0 ? R : r;
    const sx = cx + Math.cos(angle) * radius;
    const sy = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.closePath(); ctx.stroke();

  // 큰 하이라이트 (유리 광택)
  ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(cx - 1, cy - 3, R * 0.28, R * 0.18, -0.4, 0, Math.PI * 2); ctx.fill();

  // 반짝임 점
  ctx.fillStyle='rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.arc(cx - 2, cy - 4, 1.3, 0, Math.PI * 2); ctx.fill();

  // 회전하는 작은 빛 파티클 (별 주위를 도는 반짝임)
  const sparkAngle = t * 4;
  const sparkDist = R + 4;
  ctx.fillStyle='rgba(255,255,200,0.7)';
  ctx.beginPath();
  ctx.arc(cx + Math.cos(sparkAngle) * sparkDist, cy + Math.sin(sparkAngle) * sparkDist, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + Math.cos(sparkAngle + Math.PI) * sparkDist * 0.8, cy + Math.sin(sparkAngle + Math.PI) * sparkDist * 0.8, 1, 0, Math.PI * 2);
  ctx.fill();
}

// ── 이펙트 그리기 ───────────────────────────────────────────
// 번개 경고·낙뢰·폭탄 날아가기·불타기를 각각 시각적으로 표현합니다.
function drawPendingEffects() {
  const now=performance.now(); // 현재 시각 (애니메이션 흔들림 계산용)
  pendingEffects.forEach(eff => {

    if (eff.type==='lightning_warn') {
      // 번개가 내려칠 3×3 범위를 원형 경고 링으로 표시합니다.
      const mid = eff.cells[Math.floor(eff.cells.length/2)] || eff.cells[0]; // 중앙 칸
      const cx  = mid.x*CELL+CELL/2, cy = mid.y*CELL+CELL/2;
      const R   = CELL*1.72; // 원형 링 반지름
      const flash = Math.floor(eff.timer/3)%2===0; // 3틱마다 깜빡임
      const rot   = now/400; // 링 회전 속도

      // 바깥 부드러운 보라빛 글로우
      const og=ctx.createRadialGradient(cx,cy,R*0.4,cx,cy,R*1.4);
      og.addColorStop(0,`rgba(167,139,250,${flash?0.18:0.08})`);
      og.addColorStop(1,'transparent');
      ctx.fillStyle=og; ctx.beginPath(); ctx.arc(cx,cy,R*1.4,0,Math.PI*2); ctx.fill();

      // 바깥 회전 점선 링
      ctx.strokeStyle=flash?'rgba(253,224,71,0.9)':'rgba(192,132,252,0.55)';
      ctx.lineWidth=flash?2:1.2;
      ctx.setLineDash([8,5]);         // 점선 패턴
      ctx.lineDashOffset=-rot*60;     // 오프셋으로 회전 효과
      ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();

      // 안쪽 회전 점선 링 (반대 방향)
      ctx.strokeStyle=flash?'rgba(253,224,71,0.5)':'rgba(167,139,250,0.3)';
      ctx.lineWidth=1;
      ctx.setLineDash([4,6]);
      ctx.lineDashOffset=rot*40;
      ctx.beginPath(); ctx.arc(cx,cy,R*0.55,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]); // 점선 패턴 초기화

      // 원 안쪽 반투명 채우기
      ctx.fillStyle=`rgba(${flash?'253,224,71':'167,139,250'},${flash?0.1:0.05})`;
      ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();

      // 깜빡일 때 방사형 경고선 8개 추가
      if (flash) {
        for (let i=0;i<8;i++) {
          const a=rot+(i/8)*Math.PI*2;
          const r0=R*0.65, r1=R*0.95;
          ctx.strokeStyle='rgba(253,224,71,0.5)'; ctx.lineWidth=1;
          ctx.beginPath();
          ctx.moveTo(cx+Math.cos(a)*r0, cy+Math.sin(a)*r0);
          ctx.lineTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1);
          ctx.stroke();
        }
      }

      // 중앙 번개 아이콘
      ctx.fillStyle=flash?'rgba(253,224,71,0.92)':'rgba(192,132,252,0.6)';
      ctx.font=`bold ${Math.round(CELL*0.8)}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('⚡',cx,cy);

    } else if (eff.type==='lightning_strike') {
      // 번개 낙뢰: 원형 방전 플래시 + 방사형 번개 줄기
      const a = eff.timer/eff.maxTimer; // 1(시작) → 0(끝) 페이드 아웃
      const mid = eff.cells[Math.floor(eff.cells.length/2)] || eff.cells[0];
      const cx  = mid.x*CELL+CELL/2, cy = mid.y*CELL+CELL/2;
      const R   = CELL*1.72;

      // 원형 방전 빛 (흰→보라→어두운 보라)
      const lg=ctx.createRadialGradient(cx,cy,0,cx,cy,R*1.2);
      lg.addColorStop(0,  `rgba(255,255,255,${a*0.95})`);
      lg.addColorStop(0.3,`rgba(200,180,255,${a*0.7})`);
      lg.addColorStop(0.7,`rgba(120,80,255,${a*0.35})`);
      lg.addColorStop(1,  'transparent');
      ctx.fillStyle=lg;
      ctx.beginPath(); ctx.arc(cx,cy,R*1.2,0,Math.PI*2); ctx.fill();

      // 방전 링 테두리 (2겹)
      ctx.strokeStyle=`rgba(255,255,220,${a})`;
      ctx.lineWidth=3*a;
      ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle=`rgba(200,160,255,${a*0.6})`;
      ctx.lineWidth=8*a;
      ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();

      // 방사형 번개 줄기 12개 (흔들리는 애니메이션)
      for (let i=0;i<12;i++) {
        const angle = (i/12)*Math.PI*2 + now/200; // 회전하며 퍼짐
        const jx = Math.sin(now/30+i*1.7)*CELL*0.12; // 흔들림
        const jy = Math.cos(now/25+i*2.1)*CELL*0.12;
        const r0=R*0.25, r1=R*(0.6+0.4*((i%3)/3)); // 길이 변화
        ctx.strokeStyle=`rgba(255,255,180,${a*(i%2===0?1:0.5)})`;
        ctx.lineWidth=a*(i%3===0?2:1);
        ctx.beginPath();
        ctx.moveTo(cx+jx, cy+jy);
        ctx.lineTo(cx+Math.cos(angle)*r0+jx, cy+Math.sin(angle)*r0+jy);
        ctx.lineTo(cx+Math.cos(angle)*r1,    cy+Math.sin(angle)*r1);
        ctx.stroke();
      }

    } else if (eff.type==='bomb_fly') {
      // 폭탄이 포물선 궤도로 날아가는 모습
      const progress=1-eff.timer/eff.maxTimer; // 0→1 진행률
      // x는 선형 이동, y는 포물선 (sin 곡선으로 위로 솟았다가 내려옴)
      const bx=(eff.sx+(eff.tx-eff.sx)*progress)*CELL+CELL/2;
      const arcH=Math.sin(progress*Math.PI)*4*CELL; // 최고 높이
      const by=(eff.sy+(eff.ty-eff.sy)*progress)*CELL+CELL/2-arcH;

      // 목표 지점 3×3 범위 점선 표시
      const tx=eff.tx*CELL-CELL, ty=eff.ty*CELL-CELL;
      const pulse=0.35+0.25*Math.sin(now/180); // 맥동 투명도
      ctx.strokeStyle=`rgba(134,239,172,${pulse})`;
      ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
      ctx.strokeRect(tx,ty,CELL*3,CELL*3); ctx.setLineDash([]);

      // 폭탄 그리기
      ctx.save(); ctx.translate(bx,by);
      ctx.fillStyle='rgba(0,0,0,0.25)'; // 그림자
      ctx.beginPath(); ctx.ellipse(0,7,5,2.5,0,0,Math.PI*2); ctx.fill();
      const bg=ctx.createRadialGradient(-2,-2,1,0,0,7); // 폭탄 본체
      bg.addColorStop(0,'#6b7280'); bg.addColorStop(1,'#1f2937');
      ctx.fillStyle=bg;
      ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#374151'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle='#b45309'; ctx.lineWidth=1.5; // 도화선
      ctx.beginPath(); ctx.moveTo(0,-7); ctx.quadraticCurveTo(5,-12,4,-17); ctx.stroke();
      if (Math.floor(eff.timer/2)%2===0) { // 도화선 불꽃 깜빡임
        const sg=ctx.createRadialGradient(4,-17,0,4,-17,4);
        sg.addColorStop(0,'#fef08a'); sg.addColorStop(1,'rgba(251,191,36,0)');
        ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(4,-17,4,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

    } else if (eff.type==='bomb_burn') {
      // 폭발 후 타오르는 불꽃 (3×3 칸)
      eff.cells.forEach(c=>{
        const x=c.x*CELL, y=c.y*CELL, cx=x+CELL/2, cy=y+CELL/2;
        const flicker=0.55+0.35*Math.sin(now/120+c.x*1.3+c.y*0.9); // 불꽃 흔들림
        const fg=ctx.createRadialGradient(cx,cy,1,cx,cy,CELL*0.9); // 불 글로우
        fg.addColorStop(0,`rgba(251,146,60,${flicker*0.8})`);
        fg.addColorStop(0.6,`rgba(239,68,68,${flicker*0.5})`);
        fg.addColorStop(1,'transparent');
        ctx.fillStyle=fg; ctx.fillRect(x-2,y-2,CELL+4,CELL+4);
        // 불꽃 모양 3개 (중앙·왼쪽·오른쪽)
        for (let k=0;k<3;k++) {
          const fh=CELL*(0.5+0.25*Math.sin(now/100+k*2+c.x)); // 불꽃 높이
          const fw=CELL*0.22;
          const fx=cx+(k-1)*fw*1.1;
          const g2=ctx.createLinearGradient(fx,cy+CELL*0.25,fx,cy+CELL*0.25-fh);
          g2.addColorStop(0,'rgba(239,68,68,0)');
          g2.addColorStop(0.4,`rgba(249,115,22,${flicker*0.9})`);
          g2.addColorStop(1,`rgba(254,240,138,${flicker})`);
          ctx.fillStyle=g2;
          ctx.beginPath();
          ctx.ellipse(fx,cy+CELL*0.25-fh*0.5,fw,fh*0.5,0,0,Math.PI*2);
          ctx.fill();
        }
      });
    }
  });
}

// ── 불덩이 그리기 ────────────────────────────────────────────
// 보스 스킬 1(불)이 발사한 불덩이를 실감나게 그립니다.
// moveTimer와 tickProgress를 합산하여 4틱 이동 사이에도 부드럽게 보간합니다.
function drawFireballs() {
  const now = performance.now();
  fireballs.forEach(f => {
    // 4틱 이동 주기 내에서 현재 진행도 계산 (0→1)
    const moveT = Math.min(1, (f.moveTimer + tickProgress) / 4);
    const rx = ((f.ox??f.x) + (f.x - (f.ox??f.x)) * moveT) * CELL + CELL/2; // 보간 X
    const ry = ((f.oy??f.y) + (f.y - (f.oy??f.y)) * moveT) * CELL + CELL/2; // 보간 Y

    const flicker = 0.88 + 0.12 * Math.sin(now/70 + f.age * 0.8); // 불꽃 흔들림
    const R = CELL * 0.52 * flicker;

    // ① 외부 열기 글로우 (주황빛 번짐)
    const og = ctx.createRadialGradient(rx, ry, 0, rx, ry, R*3);
    og.addColorStop(0,   'rgba(255,100,10,0.38)');
    og.addColorStop(0.45,'rgba(255,50,0,0.12)');
    og.addColorStop(1,   'transparent');
    ctx.fillStyle = og;
    ctx.fillRect(rx-R*3, ry-R*3, R*6, R*6);

    // ② 꼬리 불꽃 (이동 반대 방향으로 3개 레이어)
    ctx.save();
    ctx.lineCap = 'round';
    const trailDirs = [
      {perp:0,    len:1.9, w:0.55}, // 정중앙 꼬리 (굵고 긺)
      {perp: 0.3, len:1.4, w:0.32}, // 오른쪽 꼬리
      {perp:-0.3, len:1.4, w:0.32}, // 왼쪽 꼬리
    ];
    trailDirs.forEach(td => {
      const wave = Math.sin(now/85 + f.age + td.perp*3) * 0.18; // 물결 흔들림
      const px = -f.dy * (td.perp + wave) * R; // 수직 오프셋
      const py =  f.dx * (td.perp + wave) * R;
      const ex = rx - f.dx * R * (td.len + wave*0.3) + px; // 꼬리 끝점
      const ey = ry - f.dy * R * (td.len + wave*0.3) + py;
      const tg = ctx.createLinearGradient(rx, ry, ex, ey);
      tg.addColorStop(0,   `rgba(255,210,60,${0.75*flicker})`);  // 밝은 노란 시작
      tg.addColorStop(0.35,`rgba(255,110,0,${0.55*flicker})`);   // 주황
      tg.addColorStop(1,   'transparent');                        // 투명하게 사라짐
      ctx.strokeStyle = tg;
      ctx.lineWidth = R * td.w;
      ctx.beginPath(); ctx.moveTo(rx+px*0.15, ry+py*0.15); ctx.lineTo(ex, ey); ctx.stroke();
    });
    ctx.restore();

    // ③ 외화염층: 불규칙적으로 흔들리는 바깥 불꽃 3겹
    for (let i=0; i<3; i++) {
      const a = now/110 + i*2.1 + f.age;
      const ox2 = Math.sin(a)*R*0.22, oy2 = Math.cos(a)*R*0.18;
      const fr = R*(0.78 + 0.14*Math.sin(now/90+i));
      const fg = ctx.createRadialGradient(rx+ox2,ry+oy2,0, rx,ry, fr);
      fg.addColorStop(0,   `rgba(255,140,0,${0.45*flicker})`);
      fg.addColorStop(0.6, `rgba(255,60,0,${0.2*flicker})`);
      fg.addColorStop(1,   'transparent');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(rx+ox2, ry+oy2, fr, 0, Math.PI*2); ctx.fill();
    }

    // ④ 메인 불꽃 본체 (투명→불투명 코어로 입체감)
    const mg = ctx.createRadialGradient(rx, ry, 0, rx, ry, R);
    mg.addColorStop(0,   `rgba(255,255,180,${flicker})`);    // 흰 코어
    mg.addColorStop(0.25,`rgba(255,200,40,${0.95*flicker})`); // 밝은 노랑
    mg.addColorStop(0.55,`rgba(255,80,0,${0.8*flicker})`);   // 주황
    mg.addColorStop(1,   `rgba(200,20,0,${0.3*flicker})`);   // 어두운 빨강
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI*2); ctx.fill();

    // ⑤ 백열 코어 (가장 밝은 중심부)
    const cg = ctx.createRadialGradient(rx,ry,0, rx,ry, R*0.32);
    cg.addColorStop(0, 'rgba(255,255,255,1)');
    cg.addColorStop(1, 'rgba(255,240,100,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(rx, ry, R*0.32, 0, Math.PI*2); ctx.fill();

    // ⑥ 주변 불꽃 파편 3개 (궤도를 그리며 돌음)
    for (let i=0; i<3; i++) {
      const angle = now/180 + i*2.09 + f.age*0.4; // 회전 각도
      const dist  = R*(0.7 + 0.35*Math.sin(now/220+i)); // 궤도 반지름
      const pr    = R*(0.1 + 0.06*Math.sin(now/130+i*1.7)); // 파편 크기
      const sx = rx + Math.cos(angle)*dist, sy = ry + Math.sin(angle)*dist;
      ctx.fillStyle = `rgba(255,200,50,${0.6*flicker})`;
      ctx.beginPath(); ctx.arc(sx, sy, pr, 0, Math.PI*2); ctx.fill();
    }
  });
}

// ── 일반 몹 그리기 (2×2 귀여운 몬스터 스타일) ──────────────
// 이미지 참고: 둥근 몸통 + 뿔/귀 + 큰 눈 + 이빨 + 털/가시 장식
const ENEMY_STYLE = {
  wanderer: {
    body: '#E53935', bodyDark: '#B71C1C', outline: '#7f1d1d',  // 빨강 몬스터
    horn: '#FBC02D', eyeColor: '#1a1a1a', glow: 'rgba(229,57,53,0.3)',
  },
  chaser: {
    body: '#039BE5', bodyDark: '#0277BD', outline: '#01579B',  // 파랑 몬스터
    horn: '#FDD835', eyeColor: '#1a1a1a', glow: 'rgba(3,155,229,0.3)',
  },
  teleporter: {
    body: '#8E24AA', bodyDark: '#6A1B9A', outline: '#4A148C',  // 보라 몬스터
    horn: '#FF8F00', eyeColor: '#1a1a1a', glow: 'rgba(142,36,170,0.3)',
  },
};
function drawEnemies() { enemies.forEach(e => drawEnemy(e)); }

function drawEnemy(e) {
  // 순간이동자가 이동 직전이면 깜빡이게 합니다.
  if (e.type === 'teleporter' && e.teleTimer >= 16 && tickCount % 4 < 2) return;

  // 보간 위치 계산 (2×2이므로 중심은 +1칸씩)
  const mi = e.mi || 4;
  const t  = e.type === 'teleporter' ? 1 : Math.min(1, ((e.mt ?? mi) + tickProgress) / mi);
  const rx = e.ox != null ? e.ox + (e.x - e.ox) * t : e.x;
  const ry = e.oy != null ? e.oy + (e.y - e.oy) * t : e.y;
  // 2×2 크기의 중심 좌표 (좌상단 + 1칸)
  const cx = (rx + 1) * CELL, cy = (ry + 1) * CELL;
  const S  = CELL; // 2×2 = 40px, 반지름 = CELL (20px)
  const R  = S * 0.85; // 몸통 반지름
  const s  = ENEMY_STYLE[e.type];
  const now = performance.now();

  // ── 0단계: 바닥 그림자 (떠 있는 느낌) ──
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + R + 3, R * 0.7, R * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 1단계: 털/가시 장식 (몸통 주변에 뾰족하게 튀어나온 털) ──
  const spikeCount = e.type === 'wanderer' ? 10 : e.type === 'chaser' ? 8 : 12;
  for (let i = 0; i < spikeCount; i++) {
    const angle = (i / spikeCount) * Math.PI * 2 + Math.sin(now / 400 + i) * 0.1;
    const spikeR = R + 4 + Math.sin(now / 300 + i * 1.7) * 2; // 살짝 흔들림
    const baseR = R - 1;
    const sx = cx + Math.cos(angle) * spikeR;
    const sy = cy + Math.sin(angle) * spikeR - 2; // 약간 위로 (떠있는 느낌)
    const bx1 = cx + Math.cos(angle - 0.25) * baseR;
    const by1 = cy + Math.sin(angle - 0.25) * baseR - 2;
    const bx2 = cx + Math.cos(angle + 0.25) * baseR;
    const by2 = cy + Math.sin(angle + 0.25) * baseR - 2;
    ctx.fillStyle = s.body;
    ctx.beginPath();
    ctx.moveTo(bx1, by1); ctx.lineTo(sx, sy); ctx.lineTo(bx2, by2);
    ctx.closePath(); ctx.fill();
  }

  // ── 2단계: 둥근 몸통 (3D 구체 그라데이션) ──
  const bodyGrd = ctx.createRadialGradient(cx - 4, cy - 6, 2, cx, cy - 2, R);
  bodyGrd.addColorStop(0, s.body);       // 밝은 면
  bodyGrd.addColorStop(0.7, s.body);
  bodyGrd.addColorStop(1, s.bodyDark);   // 어두운 가장자리
  ctx.fillStyle = bodyGrd;
  ctx.beginPath(); ctx.arc(cx, cy - 2, R, 0, Math.PI * 2); ctx.fill();

  // 몸통 테두리 (두꺼운 검정 외곽선 — 캐릭터 느낌)
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy - 2, R, 0, Math.PI * 2); ctx.stroke();

  // 상단 하이라이트 (빛 반사)
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - R * 0.5, R * 0.4, R * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // ── 3단계: 뿔 (타입별 다른 뿔 모양) ──
  if (e.type === 'wanderer') {
    // 방랑자: 짧고 둥근 뿔 2개 (빨간 몬스터의 노란 뿔)
    [[-0.55, -0.75, -0.2], [0.55, -0.75, 0.2]].forEach(([ox, oy, tilt]) => {
      const hx = cx + R * ox, hy = cy + R * oy - 2;
      ctx.fillStyle = s.horn;
      ctx.beginPath();
      ctx.moveTo(hx - 4, hy + 2);
      ctx.quadraticCurveTo(hx + tilt * 8, hy - 10, hx + 4, hy + 2);
      ctx.closePath(); ctx.fill();
      // 뿔 테두리
      ctx.strokeStyle = '#F9A825'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hx - 4, hy + 2);
      ctx.quadraticCurveTo(hx + tilt * 8, hy - 10, hx + 4, hy + 2);
      ctx.stroke();
    });

  } else if (e.type === 'chaser') {
    // 추격자: 크고 날카로운 뿔 2개 (파란 몬스터의 노란 뿔)
    [[-0.5, -0.8, -0.4], [0.5, -0.8, 0.4]].forEach(([ox, oy, tilt]) => {
      const hx = cx + R * ox, hy = cy + R * oy - 2;
      ctx.fillStyle = s.horn;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy + 3);
      ctx.lineTo(hx + tilt * 12, hy - 14);
      ctx.lineTo(hx + 3, hy + 3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#F57F17'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy + 3);
      ctx.lineTo(hx + tilt * 12, hy - 14);
      ctx.lineTo(hx + 3, hy + 3);
      ctx.stroke();
    });

  } else {
    // 순간이동자: 작은 뿔 3개 (보라 몬스터의 주황 뿔)
    [[-0.6, -0.7], [0, -1.0], [0.6, -0.7]].forEach(([ox, oy]) => {
      const hx = cx + R * ox, hy = cy + R * oy - 2;
      ctx.fillStyle = s.horn;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy + 3);
      ctx.quadraticCurveTo(hx, hy - 8, hx + 3, hy + 3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#EF6C00'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy + 3);
      ctx.quadraticCurveTo(hx, hy - 8, hx + 3, hy + 3);
      ctx.stroke();
    });
  }

  // ── 4단계: 큰 눈 (타입별 다른 눈 스타일) ──
  if (e.type === 'wanderer') {
    // 방랑자: 크고 동그란 두 눈 (멍청하고 귀여운 느낌)
    const eyeR = 7;
    [-7, 7].forEach(ox => {
      const ex = cx + ox, ey = cy - 4;
      // 흰 눈
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = s.outline; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.stroke();
      // 검은 동공 (크고 귀여운)
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(ex + 1, ey + 1, 4, 0, Math.PI * 2); ctx.fill();
      // 반짝임 2개
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex - 1, ey - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 2, ey + 1, 0.8, 0, Math.PI * 2); ctx.fill();
    });

  } else if (e.type === 'chaser') {
    // 추격자: 크고 화난 눈 (눈썹이 V자로 치켜올라감)
    const eyeR = 6.5;
    [-7, 7].forEach(ox => {
      const ex = cx + ox, ey = cy - 3;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = s.outline; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.stroke();
      // 동공
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(ex, ey + 1, 3.5, 0, Math.PI * 2); ctx.fill();
      // 빨간 홍채 테두리
      ctx.strokeStyle = '#D32F2F'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ex, ey + 1, 3.5, 0, Math.PI * 2); ctx.stroke();
      // 반짝임
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex - 1.5, ey - 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
    });
    // V자 화난 눈썹
    ctx.strokeStyle = s.outline; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 12); ctx.lineTo(cx - 4, cy - 8);
    ctx.moveTo(cx + 14, cy - 12); ctx.lineTo(cx + 4, cy - 8);
    ctx.stroke();

  } else {
    // 순간이동자: 한쪽 큰 눈 + 한쪽 작은 눈 (장난스러운 비대칭)
    const sparkle = 0.6 + 0.4 * Math.sin(now / 200);
    // 큰 눈 (왼쪽)
    const bigR = 8;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - 5, cy - 3, bigR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = s.outline; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx - 5, cy - 3, bigR, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(cx - 4, cy - 2, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - 6, cy - 5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - 2, cy, 0.8, 0, Math.PI * 2); ctx.fill();
    // 작은 눈 (오른쪽)
    const smR = 5.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx + 8, cy - 1, smR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = s.outline; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx + 8, cy - 1, smR, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(cx + 8.5, cy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx + 7, cy - 2.5, 1.5, 0, Math.PI * 2); ctx.fill();

    // 충전 링
    if (e.teleTimer > 5) {
      ctx.strokeStyle = `rgba(206,147,255,${0.4 + sparkle * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, R + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.teleTimer / 22));
      ctx.stroke();
    }
  }

  // ── 5단계: 입 (타입별) ──
  if (e.type === 'wanderer') {
    // 크게 벌린 입 + 이빨 2개 (귀여운 느낌)
    ctx.fillStyle = '#4E342E';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 9, 8, 5.5, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = s.outline; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 9, 8, 5.5, 0, 0, Math.PI);
    ctx.stroke();
    // 이빨 (위에서 아래로 삐죽)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 7); ctx.lineTo(cx - 2, cy + 12); ctx.lineTo(cx, cy + 7);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy + 7); ctx.lineTo(cx + 3, cy + 12); ctx.lineTo(cx + 5, cy + 7);
    ctx.closePath(); ctx.fill();
    // 혀 (분홍)
    ctx.fillStyle = '#E91E63';
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy + 13, 3.5, 2, 0.2, 0, Math.PI * 2);
    ctx.fill();

  } else if (e.type === 'chaser') {
    // 으르렁 입 + 삐죽 이빨 여러 개
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 6);
    ctx.quadraticCurveTo(cx, cy + 16, cx + 10, cy + 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = s.outline; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 6);
    ctx.quadraticCurveTo(cx, cy + 16, cx + 10, cy + 6);
    ctx.stroke();
    // 지그재그 이빨 (위쪽에서 아래로 + 아래쪽에서 위로)
    ctx.fillStyle = '#fff';
    for (let i = -3; i <= 3; i++) {
      const tx = cx + i * 3;
      // 위에서 아래로
      ctx.beginPath();
      ctx.moveTo(tx - 1.5, cy + 6); ctx.lineTo(tx, cy + 10); ctx.lineTo(tx + 1.5, cy + 6);
      ctx.closePath(); ctx.fill();
    }

  } else {
    // 순간이동자: 동그란 O 모양 입 (놀란 표정)
    ctx.fillStyle = '#311B92';
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = s.outline; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 9, 4, 0, Math.PI * 2);
    ctx.stroke();
    // 혀 살짝
    ctx.fillStyle = '#E91E63';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 12, 2.5, 1.5, 0, 0, Math.PI);
    ctx.fill();
  }

  // ── 6단계: 발 (동글동글한 작은 발 2개) ──
  ctx.fillStyle = s.bodyDark;
  ctx.beginPath(); ctx.ellipse(cx - 6, cy + R - 1, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 6, cy + R - 1, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = s.outline; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(cx - 6, cy + R - 1, 5, 3, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx + 6, cy + R - 1, 5, 3, 0, 0, Math.PI * 2); ctx.stroke();

  // (타입 배지 레이블 삭제됨)
}

// ── 보스 그리기 ──────────────────────────────────────────────
// 보스는 3×3 = 60×60px 크기로 그려집니다.
function drawBosses() { bossEnemies.forEach(b=>drawBoss(b)); }

function drawBoss(boss) {
  // 7틱 이동 주기 내에서 보간 위치 계산
  const t = Math.min(1, (boss.moveTimer + tickProgress) / 7);
  const rx = boss.ox!=null ? boss.ox+(boss.x-boss.ox)*t : boss.x;
  const ry = boss.oy!=null ? boss.oy+(boss.y-boss.oy)*t : boss.y;
  const x=rx*CELL, y=ry*CELL;
  const W=CELL*3, H=CELL*3; // 가로·세로 60px (3칸×20px)
  const cx=x+W/2, cy=y+H/2; // 중심 좌표
  const st=BOSS_STYLE[boss.skillType]; // 스킬 타입별 색상

  // 숨 쉬는 듯한 맥동 글로우 (glowPhase로 크기가 파도처럼 변함)
  const gs=W*(0.65+Math.sin(boss.glowPhase)*0.12);
  const grd=ctx.createRadialGradient(cx,cy,4,cx,cy,gs);
  grd.addColorStop(0,st.glow);
  grd.addColorStop(0.55,st.glow.replace('0.55','0.18')); // 중간은 연하게
  grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd;
  ctx.fillRect(x-gs*0.5,y-gs*0.5,W+gs,H+gs);

  // 배경 패널 (둥근 사각형)
  ctx.fillStyle=st.bg;
  roundRect(ctx,x+1,y+1,W-2,H-2,10); ctx.fill();
  ctx.strokeStyle=st.border; ctx.lineWidth=0.8;
  roundRect(ctx,x+1,y+1,W-2,H-2,10); ctx.stroke();

  // 태이 얼굴 사진을 원형으로 잘라 중앙에 표시
  const faceR = W*0.42; // 얼굴 원 반지름
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, faceR, 0, Math.PI*2);
  ctx.clip(); // 원 안에만 그리기 (원형 마스크)
  if (bossImg.complete && bossImg.naturalWidth>0) {
    // tae.jpg 파일이 있으면 사진 표시
    ctx.drawImage(bossImg, cx-faceR, cy-faceR, faceR*2, faceR*2);
  } else {
    // 사진이 없으면 기본 캐릭터 얼굴 그리기
    const fg=ctx.createRadialGradient(cx-3,cy-4,2,cx,cy,faceR);
    fg.addColorStop(0,'#fde68a'); fg.addColorStop(1,'#f59e0b'); // 노란 피부색
    ctx.fillStyle=fg; ctx.fillRect(cx-faceR,cy-faceR,faceR*2,faceR*2);
    ctx.fillStyle='#1a1a1a'; // 눈 (검정)
    ctx.beginPath();
    ctx.ellipse(cx-6,cy-4,3.5,4,0,0,Math.PI*2);
    ctx.ellipse(cx+6,cy-4,3.5,4,0,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#fff'; // 눈 반짝임
    ctx.beginPath();
    ctx.ellipse(cx-5,cy-5,1.2,1.5,0,0,Math.PI*2);
    ctx.ellipse(cx+7,cy-5,1.2,1.5,0,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle='#92400e'; ctx.lineWidth=2; // 입
    ctx.beginPath(); ctx.arc(cx,cy+5,6,0.2,Math.PI-0.2); ctx.stroke();
  }
  ctx.restore();

  // 얼굴 테두리 링
  ctx.strokeStyle=st.border; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.arc(cx,cy,faceR,0,Math.PI*2); ctx.stroke();

  // 우하단에 스킬 종류 아이콘 표시
  const iconX=x+W-12, iconY=y+H-12;
  ctx.fillStyle='rgba(0,0,0,0.65)';
  ctx.beginPath(); ctx.arc(iconX,iconY,9,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=st.border; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(iconX,iconY,9,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle=st.border; ctx.font='bold 9px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const icons={fire:'🔥',lightning:'⚡',bomb:'💣'};
  ctx.fillText(icons[boss.skillType],iconX,iconY+1);

  // 스킬 쿨다운 링 (얼마나 스킬이 찼는지 원형 게이지)
  const fireP=boss.skillTimer/getSkillInterval(); // 0→1
  const ringR=W*0.5-2;
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(cx,cy,ringR,0,Math.PI*2); ctx.stroke(); // 빈 링
  ctx.strokeStyle=fireP>0.75?`rgba(255,80,0,${0.6+fireP*0.4})`:`${st.border}cc`;
  ctx.lineWidth=3;
  // 쿨다운이 75% 이상 차면 빨갛게 강조
  ctx.beginPath(); ctx.arc(cx,cy,ringR,-Math.PI/2,-Math.PI/2+Math.PI*2*fireP); ctx.stroke();

  // 이름 배지 (보스 위쪽에 작게 표시)
  const label=st.label;
  const bw=label.length*6+10;
  ctx.fillStyle='rgba(0,0,0,0.82)'; roundRect(ctx,cx-bw/2,y-16,bw,13,4); ctx.fill();
  ctx.strokeStyle=st.border; ctx.lineWidth=0.8;
  roundRect(ctx,cx-bw/2,y-16,bw,13,4); ctx.stroke();
  ctx.fillStyle=st.border; ctx.font='bold 8px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label,cx,y-9.5);
}

// ── 유틸: 둥근 사각형 경로 ──────────────────────────────────
// ctx.fill() 또는 ctx.stroke() 전에 호출해 둥근 모서리 사각형 경로를 만듭니다.
// r: 모서리 둥글기 반지름
function roundRect(ctx,x,y,w,h,r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

// ── 아이템 스폰 함수 ─────────────────────────────────────────
// 맵에 랜덤 위치에 랜덤 아이템을 하나 생성합니다.
// 최대 3개까지만 맵에 동시에 존재합니다.
function spawnFieldItem() {
  if (fieldItems.length >= 3) return; // 맵에 이미 3개 있으면 추가 안 함
  let p, att = 0;
  do { p = randomCell(); att++; }
  while (att < 200 && (
    onSnake(p) || onEnemy(p, null) || onBoss(p, null) || onObstacle(p) ||
    (p.x === food.x && p.y === food.y) ||
    fieldItems.some(it => it.x === p.x && it.y === p.y)
  ));
  // 3가지 중 랜덤 선택
  const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
  fieldItems.push({ x: p.x, y: p.y, type });
}

// ── 아이템 사용 함수 ─────────────────────────────────────────
// 인벤토리에서 가장 먼저 주운 아이템을 꺼내 사용합니다. (FIFO)
function useItem() {
  if (!running || paused || inventory.length === 0) return;
  const type = inventory.shift(); // 가장 오래된 아이템 꺼내기
  updateInventoryUI();

  if (type === 'freeze') {
    // ⏱️ 동결: 3초 동안 모든 적과 보스가 멈춤 (보스 스킬 포함)
    frozenTimer = Math.round(3000 / speed);
    addToast('⏱️ 적 동결! 3초', '#60A5FA', 1.5);
  } else if (type === 'kill') {
    // 💀 처치: 랜덤 적 1마리 삭제 (보스 우선, 없으면 일반 몹)
    if (bossEnemies.length > 0) {
      const idx = Math.floor(Math.random() * bossEnemies.length);
      const removed = bossEnemies.splice(idx, 1)[0];
      addToast(`💀 ${BOSS_STYLE[removed.skillType].label} 처치!`, '#F87171', 1.5);
    } else if (enemies.length > 0) {
      const idx = Math.floor(Math.random() * enemies.length);
      enemies.splice(idx, 1);
      addToast('💀 적 처치!', '#F87171', 1.5);
    } else {
      addToast('💀 적이 없습니다', '#888', 1.2);
    }
  } else if (type === 'invincible') {
    // 🛡️ 무적: 5초 동안 적·불·번개·폭탄에 안 죽음
    invincibleTimer = Math.round(5000 / speed);
    addToast('🛡️ 무적! 5초', '#FBBF24', 1.5);
  }
}

// ── 인벤토리 UI 업데이트 ─────────────────────────────────────
// HTML의 인벤토리 슬롯과 아이템 버튼 상태를 갱신합니다.
function updateInventoryUI() {
  const slots = document.getElementById('inventory-slots');
  const itemBtn = document.getElementById('btn-item');
  if (!slots || !itemBtn) return;

  // 인벤토리 슬롯 5개를 그리기
  let html = '';
  for (let i = 0; i < 5; i++) {
    if (i < inventory.length) {
      const t = inventory[i];
      html += `<span class="inv-slot filled" style="border-color:${ITEM_COLORS[t]}">${ITEM_ICONS[t]}</span>`;
    } else {
      html += `<span class="inv-slot empty">·</span>`;
    }
  }
  slots.innerHTML = html;

  // 아이템이 있으면 버튼 활성화 표시
  if (inventory.length > 0) {
    itemBtn.classList.add('has-item');
    itemBtn.textContent = `${ITEM_ICONS[inventory[0]]}`;
  } else {
    itemBtn.classList.remove('has-item');
    itemBtn.textContent = '🎒';
  }
}

// ── 맵 위 아이템 그리기 ──────────────────────────────────────
// 필드에 놓인 아이템을 반짝이는 원형으로 그립니다.
function drawFieldItems() {
  const now = performance.now();
  fieldItems.forEach(item => {
    const x = item.x * CELL, y = item.y * CELL;
    const cx = x + CELL / 2, cy = y + CELL / 2;
    const pulse = 0.8 + 0.2 * Math.sin(now / 300 + item.x + item.y); // 맥동
    const R = CELL * 0.42 * pulse;
    const color = ITEM_COLORS[item.type];

    // 글로우 효과
    const grd = ctx.createRadialGradient(cx, cy, 1, cx, cy, CELL * 0.9);
    grd.addColorStop(0, color.replace(')', ',0.4)').replace('rgb', 'rgba'));
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(x - CELL * 0.3, y - CELL * 0.3, CELL * 1.6, CELL * 1.6);

    // 아이템 배경 원
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // 아이콘 텍스트
    ctx.font = `${Math.round(CELL * 0.65)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ITEM_ICONS[item.type], cx, cy + 1);
  });
}

// ── 무적 효과 시각화 ─────────────────────────────────────────
// 무적 상태일 때 뱀 주변에 황금 빛 쉴드를 그립니다.
function drawInvincibleShield() {
  if (invincibleTimer <= 0) return;
  const interp = getInterp();
  if (interp.length === 0) return;
  const h = interp[0];
  const cx = h.x * CELL + CELL / 2, cy = h.y * CELL + CELL / 2;
  const now = performance.now();
  const pulse = 0.6 + 0.3 * Math.sin(now / 200);
  const R = CELL * 1.2;

  ctx.save();
  ctx.globalAlpha = pulse * 0.5;
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  ctx.lineDashOffset = -now / 100;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  // 안쪽 빛
  const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  sg.addColorStop(0, 'rgba(251,191,36,0.25)');
  sg.addColorStop(1, 'transparent');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── 동결 효과 시각화 ─────────────────────────────────────────
// 동결 상태일 때 화면 가장자리에 파란 서리 효과를 그립니다.
function drawFreezeOverlay() {
  if (frozenTimer <= 0) return;
  const alpha = Math.min(0.15, frozenTimer / 20 * 0.15);
  ctx.fillStyle = `rgba(96,165,250,${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── 게임 오버 ────────────────────────────────────────────────
// 뱀이 충돌했을 때 호출됩니다.
function gameOver() {
  if (!running) return;
  running=false;
  clearInterval(loopId); // 틱 타이머 정지
  saveBest(score);        // 최고 점수 갱신 여부 확인 및 저장

  // 오버레이에 게임 오버 메시지 표시
  overlayIcon.textContent='💀';
  overlayTitle.textContent='게임 오버';
  overlayMsg.textContent=`점수: ${score}  |  최고점수: ${getBest()}`;
  startBtn.classList.add('hidden');
  startBtn.textContent='다시 시작';

  // 이름 입력칸 표시 (랭킹 등록용)
  nameInput.value='';
  nameSection.classList.remove('hidden');
  overlay.classList.remove('hidden');
  setTimeout(()=>nameInput.focus(), 150); // 살짝 딜레이 후 입력칸 포커스

  // 화면 빨간 플래시 효과 (6회 반짝임)
  let flashes=0;
  const flash=setInterval(()=>{
    ctx.fillStyle=`rgba(239,68,68,${0.25-flashes*0.03})`;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    if (++flashes>=6) clearInterval(flash);
  },80);
}

// 이름 저장 또는 건너뛰기 후 최종 게임 오버 화면으로 전환
function finishGameOver() {
  nameSection.classList.add('hidden');  // 이름 입력칸 숨기기
  startBtn.classList.remove('hidden'); // 다시 시작 버튼 표시
  bestEl.textContent=getBest();         // 최고 점수 갱신
}

// ── 일시 정지 ────────────────────────────────────────────────
// Space 키 또는 ⏸ 버튼으로 게임을 일시 정지/재개합니다.
function togglePause() {
  if (!running) return;
  paused=!paused;
  if (paused) {
    // 일시 정지 오버레이 표시
    overlayIcon.textContent='⏸';
    overlayTitle.textContent='일시 정지';
    overlayMsg.textContent='Space 또는 ⏸ 버튼으로 재개';
    startBtn.textContent='재개하기';
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden'); // 재개 시 오버레이 숨기기
  }
}

// ── 키보드·버튼 입력 처리 ────────────────────────────────────
// 방향키(또는 WASD)로 이동 방향을 변경합니다.
const DIRS={
  ArrowUp:{x:0,y:-1}, w:{x:0,y:-1},   // 위
  ArrowDown:{x:0,y:1}, s:{x:0,y:1},   // 아래
  ArrowLeft:{x:-1,y:0}, a:{x:-1,y:0}, // 왼쪽
  ArrowRight:{x:1,y:0}, d:{x:1,y:0},  // 오른쪽
};
document.addEventListener('keydown', e=>{
  // ★ 이름 입력칸에 포커스 중이면 게임 키 처리를 하지 않습니다.
  //    (방향키, Space, WASD 등이 입력칸으로 정상 입력됩니다)
  if (document.activeElement === nameInput) return;

  // Space/Escape: 일시 정지 토글
  if (e.key===' '||e.key==='Escape') {
    e.preventDefault();
    if(!running&&!paused) return;
    togglePause(); return;
  }
  const d=DIRS[e.key]||DIRS[e.key.toLowerCase()];
  if(!d) return;
  e.preventDefault();
  // 현재 이동 방향의 정반대 방향은 무시 (180도 반전 방지)
  if(d.x===-dir.x&&d.y===-dir.y) return;
  nextDir=d;
  if(paused) { togglePause(); return; }
  // 즉시 반응: 인터벌을 리셋하고 틱을 즉시 실행합니다.
  if(running) { clearInterval(loopId); tick(); loopId=setInterval(tick,speed); }
});

// 화면 D-패드 버튼 클릭 처리
document.getElementById('btn-up').addEventListener('click',    ()=>setDir(0,-1));
document.getElementById('btn-down').addEventListener('click',  ()=>setDir(0,1));
document.getElementById('btn-left').addEventListener('click',  ()=>setDir(-1,0));
document.getElementById('btn-right').addEventListener('click', ()=>setDir(1,0));
document.getElementById('btn-pause').addEventListener('click', togglePause);

// 방향 설정 공통 함수 (D-패드 버튼용)
function setDir(x,y) {
  if(x===-dir.x&&y===-dir.y) return; // 역방향 무시
  nextDir={x,y};
  if(paused) { togglePause(); return; }
  if(running) { clearInterval(loopId); tick(); loopId=setInterval(tick,speed); }
}

// 캔버스 터치 스와이프로 방향 전환 (모바일용)
let touchStart=null;
canvas.addEventListener('touchstart', e=>{ touchStart=e.touches[0]; }, {passive:true});
canvas.addEventListener('touchend', e=>{
  if(!touchStart) return;
  const dx=e.changedTouches[0].clientX-touchStart.clientX; // 가로 스와이프 거리
  const dy=e.changedTouches[0].clientY-touchStart.clientY; // 세로 스와이프 거리
  if(Math.abs(dx)<10&&Math.abs(dy)<10) return; // 너무 짧은 터치는 무시
  // 가로·세로 중 더 긴 방향으로 이동
  if(Math.abs(dx)>Math.abs(dy)) setDir(dx>0?1:-1, 0);
  else setDir(0, dy>0?1:-1);
  touchStart=null;
}, {passive:true});

// ── Supabase 초기화 ──────────────────────────────────────────
const _sb = supabase.createClient(
  'https://vsarezedzxtbouozddok.supabase.co',
  'sb_publishable_vDf5h3Qlji_omN1JTyOP3w_OCRzX13q'
);

// ── 최고 점수 저장 ───────────────────────────────────────────
// 브라우저 localStorage에 최고 점수를 저장합니다. (앱을 꺼도 유지됨)
function getBest() { return parseInt(localStorage.getItem('snake_best')||'0'); }
function saveBest(s) { if(s>getBest()) localStorage.setItem('snake_best',s); }

// ── 랭킹 시스템 (Supabase 연동) ─────────────────────────────

// Supabase에서 상위 10위 랭킹을 가져옵니다.
async function getRankings() {
  const { data, error } = await _sb
    .from('rankings')
    .select('name, score, created_at')
    .order('score', { ascending: false })
    .limit(10);
  if (error) { console.error('랭킹 조회 오류:', error.message); return []; }
  return data.map(r => ({
    name: r.name,
    score: r.score,
    date: new Date(r.created_at).toLocaleDateString('ko-KR'),
  }));
}

// 새 기록을 Supabase rankings 테이블에 저장합니다.
async function saveRanking(name, sc) {
  const { error } = await _sb.from('rankings').insert({
    name: (name||'무명용사').trim()||'무명용사',
    score: sc,
  });
  if (error) console.error('랭킹 저장 오류:', error.message);
}

// 랭킹 목록을 화면에 렌더링합니다.
async function renderRankings() {
  rankingList.innerHTML = '<p class="rank-empty">불러오는 중...</p>';
  const r = await getRankings();
  if (!r.length) {
    rankingList.innerHTML='<p class="rank-empty">아직 기록이 없습니다 🐍</p>';
    return;
  }
  const medals=['🥇','🥈','🥉']; // 1~3위 메달
  rankingList.innerHTML = r.map((item,i)=>`
    <div class="rank-item rank-${i<3?i+1:''}">
      <div class="rank-badge ${i<3?'':'num'}">${i<3?medals[i]:`${i+1}위`}</div>
      <div class="rank-info">
        <div class="rank-name">${escHtml(item.name)}</div>
        <div class="rank-date">${item.date||''}</div>
      </div>
      <div class="rank-score">${item.score.toLocaleString()}</div>
    </div>`).join('');
}

// HTML 특수문자를 안전하게 변환합니다. (XSS 방지)
// 예: <script> → &lt;script&gt; (그냥 텍스트로 표시됨)
function escHtml(s) {
  return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// 랭킹 모달 열기·닫기
// 랭킹 데이터를 불러온 뒤 모달을 엽니다 (async로 저장 직후에도 최신 데이터 보장)
async function openRankingModal() { await renderRankings(); rankingModal.classList.remove('hidden'); }
function closeRankingModal() { rankingModal.classList.add('hidden'); }

// ── 랭킹 이벤트 바인딩 ──────────────────────────────────────
rankingBtn.addEventListener('click', openRankingModal);
closeRanking.addEventListener('click', closeRankingModal);
// 모달 바깥 클릭 시 닫기
rankingModal.addEventListener('click', e=>{ if(e.target===rankingModal) closeRankingModal(); });

// 이름 저장 버튼: 랭킹에 등록 후 랭킹 모달 열기
saveBtn.addEventListener('click', async ()=>{
  // 저장 버튼 비활성화 (중복 클릭 방지)
  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중...';
  try {
    await saveRanking(nameInput.value, score);
    finishGameOver();
    // 저장 완료 후 랭킹 목록을 다시 불러와서 표시
    await openRankingModal();
  } catch (err) {
    console.error('저장 실패:', err);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '저장';
  }
});
// Enter 키도 저장 버튼과 동일하게 처리
nameInput.addEventListener('keydown', e=>{ if(e.key==='Enter') saveBtn.click(); });
// 건너뛰기: 이름 없이 최종 화면으로
skipBtn.addEventListener('click', finishGameOver);

// ── 아이템 버튼 바인딩 ──────────────────────────────────────
// 컨트롤러의 아이템 사용 버튼 클릭 시 인벤토리 첫 아이템 발동
document.getElementById('btn-item').addEventListener('click', useItem);
// 키보드 Q 키로도 아이템 사용 가능
document.addEventListener('keydown', e => {
  if (document.activeElement === nameInput) return;
  if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); useItem(); }
});

// ── 시작 버튼 ────────────────────────────────────────────────
// 일시 정지 중이면 재개, 아니면 게임 초기화 후 시작
startBtn.addEventListener('click', ()=>{ if(paused){ togglePause(); return; } init(); });

// ── 초기 화면 ────────────────────────────────────────────────
// 페이지 로드 시 최고 점수 표시 및 검정 배경으로 캔버스 초기화
bestEl.textContent=getBest();
ctx.fillStyle='#111827';
ctx.fillRect(0,0,canvas.width,canvas.height);
