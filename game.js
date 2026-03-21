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
const COLS = 20, ROWS = 20;
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

// ── 게임 초기화 ─────────────────────────────────────────────
// 게임을 처음 시작하거나 다시 시작할 때 모든 변수를 초기 상태로 되돌립니다.
function init() {
  // 뱀을 게임판 중앙(10,10)에 오른쪽 방향으로 3칸 길이로 배치
  snake       = [{ x:10,y:10 },{ x:9,y:10 },{ x:8,y:10 }];
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
// 다른 일반 몹 위에 있는지 확인 (ex 제외)
function onEnemy(p, ex) { return enemies.some(e => e!==ex && e.x===p.x && e.y===p.y); }

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

// 일반 먹이를 뱀·몹·보스가 없는 빈 칸에 랜덤 배치
function placeFood() {
  let p;
  do { p = randomCell(); } while (onSnake(p) || onEnemy(p,null) || onBoss(p,null));
  food = p;
}
// 보너스 먹이(별) 배치. 80틱 후 사라집니다.
function placeBonusFood() {
  let p;
  do { p = randomCell(); }
  while (onSnake(p) || onEnemy(p,null) || onBoss(p,null) || (p.x===food.x && p.y===food.y));
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
// 새 몹 한 마리를 랜덤 위치에 소환합니다.
function spawnEnemy(type) {
  let p, att=0;
  do { p=randomCell(); att++; }
  while (att<300 && (onSnake(p)||distToHead(p)<6||onEnemy(p,null)||onBoss(p,null)||(p.x===food.x&&p.y===food.y)));
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
    bossOccupies(p).some(c => onSnake(c)||onEnemy(c,null)||onBoss(c,null)||(c.x===food.x&&c.y===food.y))
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
  const nx=boss.x+boss.dx, ny=boss.y+boss.dy;
  // 3×3 크기이므로 x+2, y+2 까지 게임판 안에 있어야 합니다.
  if (nx<0||nx+2>=COLS||ny<0||ny+2>=ROWS) {
    const opts=dirs4.filter(d=>{
      const bx=boss.x+d.x, by=boss.y+d.y;
      return bx>=0&&bx+2<COLS&&by>=0&&by+2<ROWS;
    });
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
      // 번개 칸에 뱀 머리가 있으면 게임 오버
      if (eff.cells.some(c => c.x===snake[0].x && c.y===snake[0].y)) {
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
      // 불타는 칸에 뱀 머리가 있으면 게임 오버
      if (eff.cells.some(c => c.x===snake[0].x && c.y===snake[0].y)) {
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

// 방랑자(wanderer): 25% 확률로 방향 전환, 벽에 닿으면 다른 방향으로
function moveWanderer(e) {
  const dirs4=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  if (Math.random()<0.25) {
    const d=dirs4[Math.floor(Math.random()*4)];
    e.dx=d.x; e.dy=d.y;
  }
  const nx=e.x+e.dx, ny=e.y+e.dy;
  if (nx<0||nx>=COLS||ny<0||ny>=ROWS) {
    // 벽에 막히면 갈 수 있는 방향 중 랜덤 선택
    const opts=dirs4.filter(d=>{
      const bx=e.x+d.x, by=e.y+d.y;
      return bx>=0&&bx<COLS&&by>=0&&by<ROWS;
    });
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
    if (nx>=0&&nx<COLS&&ny>=0&&ny<ROWS) { e.x=nx; e.y=ny; e.dx=m.x; e.dy=m.y; return; }
  }
}

// 순간이동자(teleporter): 22틱마다 뱀 근처 랜덤 위치로 순간이동
function moveTeleporter(e) {
  e.teleTimer++;
  if (e.teleTimer>=22) {
    let p, att=0;
    do { p=randomCell(); att++; } while (att<150&&(onSnake(p)||distToHead(p)<3||onEnemy(p,e)));
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

// 충돌 판정: 뱀 머리가 몹·보스·불덩이에 닿았는지 확인
function checkCollision(head) {
  if (enemies.some(e=>e.x===head.x&&e.y===head.y)) return true;
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

  // 벽에 닿으면 죽는 대신 수직 방향으로 랜덤하게 꺾습니다.
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    // 현재 이동 방향의 수직 방향 2가지를 선택지로 만들기
    const perps = dir.x !== 0
      ? [{x:0,y:-1},{x:0,y:1}]   // 가로 이동 중 → 위/아래로 전환
      : [{x:-1,y:0},{x:1,y:0}];  // 세로 이동 중 → 좌/우로 전환
    const pick = Math.floor(Math.random()*2); // 0 또는 1 랜덤 선택
    let nd = perps[pick];
    let nh = { x: snake[0].x + nd.x, y: snake[0].y + nd.y };
    // 선택한 방향도 벽이면 반대 방향 시도
    if (nh.x < 0 || nh.x >= COLS || nh.y < 0 || nh.y >= ROWS) {
      nd = perps[1-pick];
      nh = { x: snake[0].x + nd.x, y: snake[0].y + nd.y };
    }
    // 양쪽 다 막힌 극단적 코너 상황이면 이번 틱 이동 건너뜀
    if (nh.x < 0 || nh.x >= COLS || nh.y < 0 || nh.y >= ROWS) return;
    dir = nd; nextDir = nd;
    head.x = nh.x; head.y = nh.y;
  }

  // 자기 몸통에 부딪히면 게임 오버
  if (onSnake(head)) return gameOver();

  // 머리를 맨 앞에 추가 (뱀이 한 칸 앞으로 이동)
  snake.unshift(head);

  // 이동 후 충돌 확인 (몹·보스·불덩이)
  if (checkCollision(head)) return gameOver();

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

  // 몹·보스·불덩이 이동 및 이펙트 처리
  moveEnemies();
  // 몹이 뱀의 몸통(꼬리)에 닿으면 그 몹은 사라집니다.
  enemies = enemies.filter(e => !snake.slice(1).some(s=>s.x===e.x&&s.y===e.y));
  moveBosses();
  moveFireballs();
  tickEffects();

  // 이동 후 다시 한 번 충돌 확인 (불덩이가 이동해서 뱀과 겹칠 수 있음)
  if (checkCollision(snake[0])) return gameOver();

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
function draw() {
  // 배경을 진한 남색으로 가득 채워 이전 프레임을 지웁니다.
  ctx.fillStyle='#111827';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();            // 격자 선
  drawFood();            // 일반 먹이 (빨간 사각형)
  if (bonusFood) drawBonusFood(); // 보너스 먹이 (별)
  drawPendingEffects();  // 번개 경고·낙뢰·폭탄 날아가기·불타기
  drawFireballs();       // 불덩이
  drawEnemies();         // 일반 몹
  drawBosses();          // 보스 태이
  drawSnake();           // 뱀
  tickToasts();          // 토스트 위치·투명도 업데이트
  drawToasts();          // 토스트 그리기
}

// 격자 선을 아주 연하게 그립니다. (게임판 구분용)
function drawGrid() {
  ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=0.5;
  for (let i=0;i<=COLS;i++){
    ctx.beginPath(); ctx.moveTo(i*CELL,0); ctx.lineTo(i*CELL,canvas.height); ctx.stroke();
  }
  for (let j=0;j<=ROWS;j++){
    ctx.beginPath(); ctx.moveTo(0,j*CELL); ctx.lineTo(canvas.width,j*CELL); ctx.stroke();
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
  if (interp.length===0) return;

  // 1) 몸통 연결선: 꼬리→머리 방향으로 그립니다 (머리가 위에 덮임)
  for (let i=interp.length-1; i>0; i--) {
    const a=interp[i], b=interp[i-1];
    const ax=a.x*CELL+CELL/2, ay=a.y*CELL+CELL/2;
    const bx=b.x*CELL+CELL/2, by=b.y*CELL+CELL/2;
    // 꼬리 쪽은 짙은 초록, 머리 쪽은 밝은 초록으로 그라데이션
    const g=ctx.createLinearGradient(ax,ay,bx,by);
    g.addColorStop(0, bodyColor(i,   interp.length));
    g.addColorStop(1, bodyColor(i-1, interp.length));
    ctx.strokeStyle=g;
    ctx.lineWidth=CELL*0.76; // 칸 크기의 76% 두께
    ctx.lineCap='round';     // 끝을 둥글게
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
  }

  // 2) 몸통 원: 각 마디를 원으로 그려 3D 질감을 줍니다.
  for (let i=interp.length-1; i>=1; i--) {
    const s=interp[i];
    const cx=s.x*CELL+CELL/2, cy=s.y*CELL+CELL/2;
    const R=CELL*0.42;
    // 왼쪽 위에서 빛이 오는 방사형 그라데이션 (입체감)
    const grd=ctx.createRadialGradient(cx-2,cy-2,1,cx,cy,R);
    grd.addColorStop(0, bodyColorLight(i,interp.length)); // 밝은 부분
    grd.addColorStop(1, bodyColor(i,interp.length));      // 어두운 부분
    ctx.fillStyle=grd;
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();
    // 하이라이트 (작은 흰 원으로 반짝임 표현)
    ctx.fillStyle='rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.arc(cx-2,cy-2,R*0.38,0,Math.PI*2); ctx.fill();
  }

  // 3) 머리 그리기
  const h=interp[0];
  const hx=h.x*CELL+CELL/2, hy=h.y*CELL+CELL/2;
  const R=CELL*0.50; // 머리는 몸통보다 약간 큼

  // 머리 주변 부드러운 빛 (글로우)
  const hGlow=ctx.createRadialGradient(hx,hy,1,hx,hy,R*1.6);
  hGlow.addColorStop(0,'rgba(74,222,128,0.35)');
  hGlow.addColorStop(1,'transparent');
  ctx.fillStyle=hGlow;
  ctx.beginPath(); ctx.arc(hx,hy,R*1.6,0,Math.PI*2); ctx.fill();

  // 머리 본체 (연한 초록 → 진한 초록 그라데이션)
  const hGrd=ctx.createRadialGradient(hx-3,hy-4,1,hx,hy,R);
  hGrd.addColorStop(0,'#a7f3d0');
  hGrd.addColorStop(0.5,'#4ade80');
  hGrd.addColorStop(1,'#16a34a');
  ctx.fillStyle=hGrd;
  ctx.beginPath(); ctx.arc(hx,hy,R,0,Math.PI*2); ctx.fill();

  // 머리 상단 하이라이트 (타원형으로 빛 반사 표현)
  ctx.fillStyle='rgba(255,255,255,0.38)';
  ctx.beginPath();
  ctx.ellipse(hx-3,hy-4,R*0.42,R*0.28,-0.4,0,Math.PI*2);
  ctx.fill();

  // 이동 방향에 수직인 방향 벡터 (눈, 볼터치 위치 계산용)
  const ed=dir;
  const perp={x:-ed.y, y:ed.x}; // 90도 회전한 방향
  const fwd=3;

  // 눈 2개 그리기
  const e1={x:hx+ed.x*fwd+perp.x*3.5, y:hy+ed.y*fwd+perp.y*3.5}; // 왼쪽 눈
  const e2={x:hx+ed.x*fwd-perp.x*3.5, y:hy+ed.y*fwd-perp.y*3.5}; // 오른쪽 눈
  [e1,e2].forEach(e=>{
    ctx.fillStyle='#fff';                          // 흰자
    ctx.beginPath(); ctx.arc(e.x,e.y,3.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1a6633';                       // 홍채 (초록)
    ctx.beginPath(); ctx.arc(e.x+ed.x*0.6,e.y+ed.y*0.6,2.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#0a1628';                       // 동공 (검정)
    ctx.beginPath(); ctx.arc(e.x+ed.x*0.8,e.y+ed.y*0.8,1.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';                          // 눈 반짝임
    ctx.beginPath(); ctx.arc(e.x+ed.x*0.4-0.5,e.y+ed.y*0.4-0.5,0.6,0,Math.PI*2); ctx.fill();
  });

  // 볼터치 (귀여운 핑크 타원)
  [1,-1].forEach(s=>{
    const bx=hx+perp.x*5.5*s, by=hy+perp.y*5.5*s;
    ctx.fillStyle='rgba(255,130,130,0.42)';
    ctx.beginPath(); ctx.ellipse(bx,by,3.5,2,Math.atan2(perp.y,perp.x),0,Math.PI*2); ctx.fill();
  });

  // 콧구멍 2개 (이동 방향 끝에 작은 점)
  const nx=hx+ed.x*6, ny=hy+ed.y*6;
  ctx.fillStyle='rgba(0,100,30,0.55)';
  ctx.beginPath();
  ctx.arc(nx-perp.x, ny-perp.y, 0.9, 0, Math.PI*2);
  ctx.arc(nx+perp.x, ny+perp.y, 0.9, 0, Math.PI*2);
  ctx.fill();

  // 혀 내밀기 (10틱 중 특정 구간에만 그려 깜빡이는 효과)
  if (Math.floor(tickCount/10)%4===0) {
    const tx=hx+ed.x*R, ty=hy+ed.y*R;
    ctx.strokeStyle='#f43f5e'; ctx.lineWidth=1.2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx+ed.x*4, ty+ed.y*4); // 혀 줄기
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx+ed.x*4, ty+ed.y*4);
    ctx.lineTo(tx+ed.x*4+perp.x*2, ty+ed.y*4+perp.y*2); // 갈라진 혀 오른쪽
    ctx.moveTo(tx+ed.x*4, ty+ed.y*4);
    ctx.lineTo(tx+ed.x*4-perp.x*2, ty+ed.y*4-perp.y*2); // 갈라진 혀 왼쪽
    ctx.stroke();
  }
}

// 뱀 몸통 색상 (i번째 마디, 전체 길이에서 꼬리에 가까울수록 짙어짐)
function bodyColor(i, len) {
  const t=i/len; // 0(머리) ~ 1(꼬리)
  const r=Math.round(22+t*12), g=Math.round(163-t*80), b=Math.round(74-t*40);
  return `rgb(${r},${g},${b})`;
}
// 빛 받는 면의 밝은 색상 (그라데이션 하이라이트용)
function bodyColorLight(i, len) {
  const t=i/len;
  const r=Math.round(60+t*15), g=Math.round(210-t*80), b=Math.round(110-t*40);
  return `rgb(${r},${g},${b})`;
}

// ── 먹이 그리기 ─────────────────────────────────────────────
function drawFood() {
  const x=food.x*CELL, y=food.y*CELL;
  const cx=x+CELL/2, cy=y+CELL/2;
  // 은은한 빨간 빛 (글로우)
  const grd=ctx.createRadialGradient(cx,cy,1,cx,cy,CELL*0.8);
  grd.addColorStop(0,'rgba(248,113,113,0.4)'); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.fillRect(x-CELL*0.3,y-CELL*0.3,CELL*1.6,CELL*1.6);
  // 빨간 사각형 본체
  ctx.fillStyle='#f87171'; roundRect(ctx,x+3,y+3,CELL-6,CELL-6,5); ctx.fill();
  // 하이라이트
  ctx.fillStyle='rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(cx-2,cy-2,2.5,1.5,-0.5,0,Math.PI*2); ctx.fill();
}

// 보너스 먹이(★): 타이머가 20 이하로 남으면 깜빡입니다.
function drawBonusFood() {
  const x=bonusFood.x*CELL, y=bonusFood.y*CELL;
  const cx=x+CELL/2, cy=y+CELL/2;
  // 3틱마다 교대로 보였다 사라졌다 (깜빡임)
  if (bonusFood.timer<20&&Math.floor(bonusFood.timer/3)%2!==0) return;
  const grd=ctx.createRadialGradient(cx,cy,1,cx,cy,CELL);
  grd.addColorStop(0,'rgba(250,204,21,0.5)'); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.fillRect(x-CELL*0.3,y-CELL*0.3,CELL*1.6,CELL*1.6);
  ctx.fillStyle='#facc15'; roundRect(ctx,x+3,y+3,CELL-6,CELL-6,5); ctx.fill();
  ctx.fillStyle='#0f172a'; ctx.font=`bold ${CELL*0.55}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('★',cx,cy+1);
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

// ── 일반 몹 그리기 ───────────────────────────────────────────
// 각 몹 타입별 색상 정의
const ENEMY_STYLE = {
  wanderer:   { glow:'rgba(251,146,60,0.35)',  body:'#fb923c', dark:'#7c2d12' }, // 주황
  chaser:     { glow:'rgba(239,68,68,0.45)',   body:'#ef4444', dark:'#7f1d1d' }, // 빨강
  teleporter: { glow:'rgba(167,139,250,0.45)', body:'#a78bfa', dark:'#3b0764' }, // 보라
};
function drawEnemies() { enemies.forEach(e=>drawEnemy(e)); }

function drawEnemy(e) {
  // 순간이동자가 이동 직전이면 깜빡이게 합니다.
  if (e.type==='teleporter'&&e.teleTimer>=16&&tickCount%4<2) return;

  // 보간 위치 계산 (teleporter는 보간 없이 즉시 이동)
  const mi = e.mi || 4;
  const t  = e.type==='teleporter' ? 1 : Math.min(1, ((e.mt??mi) + tickProgress) / mi);
  const rx = e.ox!=null ? e.ox+(e.x-e.ox)*t : e.x; // 보간 X
  const ry = e.oy!=null ? e.oy+(e.y-e.oy)*t : e.y; // 보간 Y
  const x=rx*CELL, y=ry*CELL, cx=x+CELL/2, cy=y+CELL/2;
  const s=ENEMY_STYLE[e.type];

  // 글로우 + 본체 사각형
  const grd=ctx.createRadialGradient(cx,cy,1,cx,cy,CELL*0.95);
  grd.addColorStop(0,s.glow); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.fillRect(x-CELL*0.45,y-CELL*0.45,CELL*1.9,CELL*1.9);
  ctx.fillStyle=s.body; roundRect(ctx,x+2,y+2,CELL-4,CELL-4,5); ctx.fill();

  // 몹 타입별 얼굴 표현
  if (e.type==='wanderer') {
    // 방랑자: 눈 2개 + 물결 입
    ctx.fillStyle=s.dark;
    ctx.beginPath();
    ctx.arc(cx-3,cy-1.5,2,0,Math.PI*2);
    ctx.arc(cx+3,cy-1.5,2,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle=s.dark; ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(cx-4,cy+3.5);
    ctx.quadraticCurveTo(cx-1.5,cy+5.5,cx,cy+3.5);
    ctx.quadraticCurveTo(cx+1.5,cy+1.5,cx+4,cy+3.5);
    ctx.stroke();
  } else if (e.type==='chaser') {
    // 추격자: 치켜 뜬 눈썹 + 이빨
    ctx.strokeStyle=s.dark; ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(cx-5,cy-4); ctx.lineTo(cx-2,cy-1.5); // 왼쪽 눈썹
    ctx.moveTo(cx+5,cy-4); ctx.lineTo(cx+2,cy-1.5); // 오른쪽 눈썹
    ctx.stroke();
    ctx.fillStyle='#fff'; // 이빨 3개
    for (let i=-1;i<=1;i++) ctx.fillRect(cx+i*3-1,cy+2.5,2.5,3.5);
  } else {
    // 순간이동자: 번개 모양 + 이동 준비 시 충전 링
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.moveTo(cx+1,cy-6); ctx.lineTo(cx-2.5,cy+0.5);
    ctx.lineTo(cx+1,cy+0.5); ctx.lineTo(cx-1,cy+6);
    ctx.lineTo(cx+2.5,cy-0.5); ctx.lineTo(cx-1,cy-0.5);
    ctx.closePath(); ctx.fill();
    if (e.teleTimer>5) {
      // 이동 전 충전 게이지 링
      ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.arc(cx,cy,CELL/2-1,-Math.PI/2,-Math.PI/2+Math.PI*2*(e.teleTimer/22));
      ctx.stroke();
    }
  }

  // 몹 타입 레이블 (방/추/순)
  const labels={wanderer:'방',chaser:'추',teleporter:'순'};
  ctx.fillStyle='rgba(0,0,0,0.55)'; roundRect(ctx,x+2,y-8,9,8,2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='bold 6px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(labels[e.type],x+6,y-4);
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
function openRankingModal()  { renderRankings(); rankingModal.classList.remove('hidden'); }
function closeRankingModal() { rankingModal.classList.add('hidden'); }

// ── 랭킹 이벤트 바인딩 ──────────────────────────────────────
rankingBtn.addEventListener('click', openRankingModal);
closeRanking.addEventListener('click', closeRankingModal);
// 모달 바깥 클릭 시 닫기
rankingModal.addEventListener('click', e=>{ if(e.target===rankingModal) closeRankingModal(); });

// 이름 저장 버튼: 랭킹에 등록 후 랭킹 모달 열기
saveBtn.addEventListener('click', async ()=>{
  await saveRanking(nameInput.value, score);
  finishGameOver();
  openRankingModal();
});
// Enter 키도 저장 버튼과 동일하게 처리
nameInput.addEventListener('keydown', e=>{ if(e.key==='Enter') saveBtn.click(); });
// 건너뛰기: 이름 없이 최종 화면으로
skipBtn.addEventListener('click', finishGameOver);

// ── 시작 버튼 ────────────────────────────────────────────────
// 일시 정지 중이면 재개, 아니면 게임 초기화 후 시작
startBtn.addEventListener('click', ()=>{ if(paused){ togglePause(); return; } init(); });

// ── 초기 화면 ────────────────────────────────────────────────
// 페이지 로드 시 최고 점수 표시 및 검정 배경으로 캔버스 초기화
bestEl.textContent=getBest();
ctx.fillStyle='#111827';
ctx.fillRect(0,0,canvas.width,canvas.height);
