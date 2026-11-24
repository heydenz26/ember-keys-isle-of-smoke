// Ember Keys — Isle of Smoke
// game.js — the main game: state, input, fixed-step simulation, car physics,
// traffic and pedestrian AI, the EKPD wanted/pursuit system, on-foot and
// in-car combat, missions wiring, saving, camera, the render pipeline and
// the deterministic screenshot scene modes (?shot=cover|chase|mission|menu).
//
// Plain ES modules + canvas 2D. No libraries, no network, runs offline.
// Written from scratch for this build.

import {
  mulberry32, WORLD, DISTRICTS, districtAt, buildCity, isOnRoad,
  nearestVerticalRoad, nearestHorizontalRoad, resolveBuildingCollision,
  clampToIsland, CAR_PAINTS, CAR_MODELS,
} from './city.js';
import {
  MISSIONS, ISLAND_LINES, rankFor, startMissionState, updateMission,
  currentObjectiveText, currentMarker, FIXER_NAME,
} from './missions.js';
import { drawWorld, drawDistrictLabels, drawCar, drawPerson, drawMarker, drawHitFx } from './render.js';
import { drawHud, drawMinimap, drawDialog, drawMenu, drawPause, drawBusted } from './hud.js';
import { SoundBank } from './audio.js';

// ---------------------------------------------------------------------------
// Boot: canvas, URL parameters, seed.
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shotMode = params.get('shot') || '';
const seedParam = parseInt(params.get('seed') || '20261124', 10);
const SEED = Number.isFinite(seedParam) ? seedParam : 20261124;

function resize() {
  canvas.width = Math.min(window.innerWidth, 1600);
  canvas.height = Math.min(window.innerHeight, 1000);
  // Screenshot scenes are composed at exactly 1280x800.
  if (shotMode) { canvas.width = 1280; canvas.height = 800; }
}
window.addEventListener('resize', resize);
resize();

const city = buildCity(SEED);
const sound = new SoundBank();

// ---------------------------------------------------------------------------
// Save data (localStorage): cash, total earned, missions completed, muted.
// ---------------------------------------------------------------------------
const SAVE_KEY = 'ember-keys-save-v1';
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch { return null; }
}
function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      totalEarned: state.totalEarned,
      missionsDone: state.missionsDone,
      muted: sound.muted,
    }));
  } catch { /* private mode etc. — saving is best-effort */ }
}

// ---------------------------------------------------------------------------
// Entity factories. Cars share one shape whether parked, traffic, police or
// player-driven; a `kind` field drives AI and livery.
// ---------------------------------------------------------------------------
let nextId = 1;
function makeCar(x, y, angle, color, modelIdx, kind) {
  const model = CAR_MODELS[modelIdx % CAR_MODELS.length];
  return {
    id: nextId++,
    x, y, angle,
    vx: 0, vy: 0, speed: 0,
    steerVisual: 0,
    len: model.len, wid: model.wid,
    topSpeed: model.topSpeed,
    modelName: model.name,
    color,
    kind: kind || 'civilian',
    health: 100,
    flashPhase: Math.random() * 2,
    // traffic AI state
    routeAxis: Math.abs(Math.sin(angle)) > 0.5 ? 'v' : 'h',
    targetX: x, targetY: y,
    cruise: 120 + Math.random() * 70,
    stuckTime: 0,
    occupied: false,
  };
}

function makePed(x, y, rng) {
  const shirts = ['#b5524a', '#4a6db5', '#4ab57a', '#b5a04a', '#7a4ab5', '#d8d3c8', '#3f8f9a'];
  const skins = ['#d9a066', '#a0663a', '#f0c8a0', '#7a4a28'];
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 34 + rng() * 30,
    moving: true,
    phase: rng() * 10,
    shirt: shirts[Math.floor(rng() * shirts.length)],
    skin: skins[Math.floor(rng() * skins.length)],
    hair: rng() < 0.5 ? '#2a2118' : '#574433',
    wanderT: 0,
    fleeT: 0,
    downT: 0,
  };
}

// ---------------------------------------------------------------------------
// Game state.
// ---------------------------------------------------------------------------
const state = {
  screen: shotMode === 'menu' ? 'menu' : (shotMode ? 'play' : 'menu'),
  time: 0,
  cash: 250,
  totalEarned: 0,
  missionsDone: 0,
  hasSave: false,
  wanted: 0,
  lastWantedChange: -9,
  heatExposure: 0, // builds while police see the player; stars decay when hidden
  hiddenTime: 0,
  player: null,
  traffic: [],
  parked: [],
  police: [],
  peds: [],
  mission: null,
  objectiveText: '',
  marker: null,
  district: DISTRICTS[2],
  districtSince: -9,
  ticker: ISLAND_LINES[0],
  tickerT: 0,
  dialog: null,
  hitFx: [],
  cam: { x: 1500, y: 1400, zoom: 1 },
  bailCost: 0,
  endKind: '',
  endT: 0,
  policeSpawnT: 0,
  crimeCooldown: 0,
  shotReady: false,
};

function resetPlayer() {
  state.player = {
    x: 1500, y: 1470, angle: -Math.PI / 2,
    vx: 0, vy: 0,
    health: 100,
    car: null,
    moving: false,
    phase: 0,
    shirt: '#e8641e', skin: '#d9a066', hair: '#1d1712',
  };
}
resetPlayer();

// Spawn the living city: traffic on the grid, parked cars at block edges,
// pedestrians on sidewalks.
function populateWorld() {
  const rng = mulberry32(SEED ^ 0x9e3779b9);
  state.traffic = [];
  state.parked = [];
  state.peds = [];
  state.police = [];

  for (let i = 0; i < 26; i++) {
    const vertical = rng() < 0.5;
    let x, y, angle;
    if (vertical) {
      const roads = [520, 1120, 1720, 2320, 2920, 3520, 4120];
      x = roads[Math.floor(rng() * roads.length)] + (rng() < 0.5 ? -22 : 22);
      y = 200 + rng() * 3200;
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const roads = [460, 1060, 1660, 2260, 2860];
      y = roads[Math.floor(rng() * roads.length)] + (rng() < 0.5 ? -22 : 22);
      x = 200 + rng() * 4400;
      angle = rng() < 0.5 ? 0 : Math.PI;
    }
    const car = makeCar(x, y, angle, CAR_PAINTS[Math.floor(rng() * CAR_PAINTS.length)], Math.floor(rng() * CAR_MODELS.length), rng() < 0.14 ? 'taxi' : 'civilian');
    if (car.modelName === 'Cargo Van') car.kind = 'van';
    car.routeAxis = vertical ? 'v' : 'h';
    state.traffic.push(car);
  }

  for (const spot of city.parkedSpots) {
    if (rng() < 0.3) continue;
    const car = makeCar(spot.x, spot.y, spot.angle + (rng() < 0.5 ? 0 : Math.PI), CAR_PAINTS[Math.floor(rng() * CAR_PAINTS.length)], Math.floor(rng() * CAR_MODELS.length), 'parked');
    state.parked.push(car);
  }

  for (let i = 0; i < 46; i++) {
    let x = 0, y = 0, tries = 0;
    do {
      x = 120 + rng() * (WORLD.width - 240);
      y = 120 + rng() * (WORLD.height - 240);
      tries++;
    } while (!isOnRoad(x, y) && tries < 12);
    // Nudge pedestrians onto the sidewalk band beside their road.
    const nv = nearestVerticalRoad(x);
    const nh = nearestHorizontalRoad(y);
    if (Math.abs(x - nv) < Math.abs(y - nh)) x = nv + (x >= nv ? 56 : -56);
    else y = nh + (y >= nh ? 56 : -56);
    state.peds.push(makePed(x, y, rng));
  }
}
populateWorld();

// ---------------------------------------------------------------------------
// Input.
// ---------------------------------------------------------------------------
const keys = {};
let enterPressed = false;
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) {
    if (e.code === 'KeyE') tryEnterExit();
    if (e.code === 'Space') doCombatAction();
    if (e.code === 'KeyM') { sound.setMuted(!sound.muted); writeSave(); }
    if (e.code === 'KeyP' && state.screen === 'play') state.screen = 'pause';
    else if (e.code === 'KeyP' && state.screen === 'pause') state.screen = 'play';
    if (e.code === 'Enter') enterPressed = true;
    if (e.code === 'KeyN' && state.screen === 'menu') startNewGame();
  }
  keys[e.code] = true;
  sound.ensureStarted();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('pointerdown', () => sound.ensureStarted());

function inputAxis(negCodes, posCodes) {
  let v = 0;
  for (const c of negCodes) if (keys[c]) v -= 1;
  for (const c of posCodes) if (keys[c]) v += 1;
  return v;
}

// ---------------------------------------------------------------------------
// Wanted system. Crimes add stars; police presence while the player is
// visible keeps heat up; hiding lets stars decay one at a time.
// ---------------------------------------------------------------------------
function commitCrime(stars, label) {
  if (state.crimeCooldown > 0 && stars < 1) return;
  const before = state.wanted;
  state.wanted = Math.max(0, Math.min(5, state.wanted + stars));
  if (state.wanted !== before) {
    state.lastWantedChange = state.time;
    sound.blip('star');
  }
  state.hiddenTime = 0;
  if (label) showDialog('EKPD DISPATCH', label, 2.6);
}

function wantedTargetPolice() {
  return [0, 0, 2, 3, 5, 7][state.wanted] || 0;
}

function spawnPolice() {
  // Spawn just off-screen near a road, aimed at the player.
  const p = state.player;
  const a = Math.random() * Math.PI * 2;
  const dist = 620 + Math.random() * 160;
  let x = p.x + Math.cos(a) * dist;
  let y = p.y + Math.sin(a) * dist;
  x = nearestVerticalRoad(x);
  y = Math.max(80, Math.min(WORLD.height - 80, y));
  const car = makeCar(x, y, Math.atan2(p.y - y, p.x - x), '#eef1f4', 1, 'police');
  car.color = '#dfe5ea';
  car.topSpeed = 305;
  car.cruise = 280;
  state.police.push(car);
}

// ---------------------------------------------------------------------------
// Enter / exit cars — the steal-anything rule: any parked or traffic car
// within reach can be taken; taking an occupied/parked car is a crime.
// ---------------------------------------------------------------------------
function nearestCarTo(x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const list of [state.parked, state.traffic, state.police]) {
    for (const car of list) {
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) { bestD = d; best = car; }
    }
  }
  return best;
}

function tryEnterExit() {
  if (state.screen !== 'play') return;
  const p = state.player;
  if (p.car) {
    // Exit: step out to the left side of the car.
    const car = p.car;
    car.occupied = false;
    p.x = car.x + Math.cos(car.angle - Math.PI / 2) * (car.wid + 16);
    p.y = car.y + Math.sin(car.angle - Math.PI / 2) * (car.wid + 16);
    p.car = null;
    sound.blip('door');
    return;
  }
  const car = nearestCarTo(p.x, p.y, 62);
  if (!car) return;
  // Remove from its AI list; the player drives it now.
  state.parked = state.parked.filter((c) => c !== car);
  state.traffic = state.traffic.filter((c) => c !== car);
  const wasPolice = car.kind === 'police';
  if (wasPolice) state.police = state.police.filter((c) => c !== car);
  car.occupied = true;
  car.kind = car.kind === 'parked' ? 'civilian' : car.kind;
  p.car = car;
  sound.blip('door');
  if (!car.wasStolen) {
    car.wasStolen = true;
    commitCrime(1, 'Vehicle theft reported — EKPD responding.');
  }
  if (wasPolice) commitCrime(2, 'That was a POLICE car. Bold.');
}

// ---------------------------------------------------------------------------
// Combat: SPACE shoves (on foot) or fires a mounted flare gun (in car).
// Hits knock pedestrians down / damage cars and always raise heat.
// ---------------------------------------------------------------------------
function doCombatAction() {
  if (state.screen !== 'play') return;
  const p = state.player;
  const range = p.car ? 130 : 46;
  const fx = p.car ? p.car.x + Math.cos(p.car.angle) * 60 : p.x + Math.cos(p.angle) * 24;
  const fy = p.car ? p.car.y + Math.sin(p.car.angle) * 60 : p.y + Math.sin(p.angle) * 24;
  state.hitFx.push({ x: fx, y: fy, t0: state.time, seed: Math.random() * 6 });
  sound.blip('thud');

  let hitSomething = false;
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - fx, ped.y - fy) < range * 0.6) {
      ped.downT = 3.2;
      ped.fleeT = 6;
      hitSomething = true;
    }
  }
  for (const list of [state.traffic, state.parked, state.police]) {
    for (const car of list) {
      if (car === p.car) continue;
      if (Math.hypot(car.x - fx, car.y - fy) < range) {
        car.health -= p.car ? 22 : 9;
        car.x += Math.cos(p.angle) * 6;
        car.y += Math.sin(p.angle) * 6;
        hitSomething = true;
      }
    }
  }
  if (hitSomething) commitCrime(1, 'Assault reported in ' + state.district.name + '.');
}

// ---------------------------------------------------------------------------
// Dialog + mission helpers.
// ---------------------------------------------------------------------------
function showDialog(speaker, text, seconds) {
  state.dialog = { speaker, text, until: state.time + (seconds || 4.5) };
}

function beginMission(index) {
  state.mission = startMissionState(index);
  if (state.mission.def.heat) {
    state.wanted = Math.max(state.wanted, state.mission.def.heat);
    state.lastWantedChange = state.time;
  }
  showDialog(FIXER_NAME, state.mission.def.brief.replace(/^Mara: /, ''), 6);
}

function freeRoamObjective() {
  if (state.missionsDone >= MISSIONS.length) {
    return 'All fixer work complete — Ember Isle is yours. Free roam, outrun the EKPD, grow the legend.';
  }
  return 'Free roam — visit Mara at the Old Market garage (gold marker) to start: ' + MISSIONS[state.missionsDone].title;
}

// ---------------------------------------------------------------------------
// Physics + AI step (fixed timestep).
// ---------------------------------------------------------------------------
function stepPlayer(dt) {
  const p = state.player;
  if (p.car) {
    const car = p.car;
    const throttle = inputAxis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    const steer = inputAxis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    const handbrake = keys['ShiftLeft'] || keys['ShiftRight'];
    const accel = throttle > 0 ? 235 : throttle < 0 ? -150 : 0;
    car.speed += accel * dt;
    const drag = handbrake ? 2.6 : 0.55;
    car.speed -= car.speed * drag * dt;
    if (!throttle) car.speed -= car.speed * 1.1 * dt;
    car.speed = Math.max(-110, Math.min(car.topSpeed, car.speed));
    if (Math.abs(car.speed) < 2 && !throttle) car.speed = 0;
    const steerAmount = steer * 0.62 * Math.min(1, Math.abs(car.speed) / 90 + 0.25);
    car.angle += steerAmount * dt * (car.speed >= 0 ? 1 : -1) * 1.55;
    car.steerVisual += ((steer * 0.4) - car.steerVisual) * Math.min(1, dt * 10);
    car.vx = Math.cos(car.angle) * car.speed;
    car.vy = Math.sin(car.angle) * car.speed;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    if (resolveBuildingCollision(city.buildings, car, car.wid * 0.72)) {
      car.speed *= -0.25;
      car.health -= Math.abs(car.speed) * 0.02;
    }
    if (clampToIsland(car, 30)) car.speed *= 0.4;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    p.moving = Math.abs(car.speed) > 8;
    collideCarWithWorld(car, true);
  } else {
    const mx = inputAxis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    const my = inputAxis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    const len = Math.hypot(mx, my) || 1;
    const runSpeed = keys['ShiftLeft'] || keys['ShiftRight'] ? 215 : 138;
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) {
      p.angle = Math.atan2(my / len, mx / len);
      p.x += (mx / len) * runSpeed * dt;
      p.y += (my / len) * runSpeed * dt;
      p.phase += dt * 10;
    }
    resolveBuildingCollision(city.buildings, p, 11);
    clampToIsland(p, 12);
    // Bumping into a car at a run nudges it (and can count as vandalism).
    const near = nearestCarTo(p.x, p.y, 30);
    if (near && p.moving && state.crimeCooldown <= 0) {
      near.x += Math.cos(p.angle) * 1.2;
      near.y += Math.sin(p.angle) * 1.2;
    }
  }
}

// Car-vs-car and car-vs-pedestrian interactions for any moving car.
function collideCarWithWorld(car, isPlayerCar) {
  const all = [...state.traffic, ...state.parked, ...state.police];
  for (const other of all) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    const minD = (car.len + other.len) * 0.36;
    if (d > 0.01 && d < minD) {
      const push = (minD - d) / 2;
      const nx = dx / d, ny = dy / d;
      other.x += nx * push; other.y += ny * push;
      car.x -= nx * push; car.y -= ny * push;
      if (Math.abs(car.speed) > 60) {
        other.health -= 6;
        car.health -= 4;
        if (isPlayerCar) {
          state.player.health -= 1.2;
          commitCrime(1, 'Hit-and-run reported — EKPD closing in.');
          sound.blip('thud');
        }
        car.speed *= 0.55;
      }
    }
  }
  if (state.player.car !== car || !isPlayerCar) {
    // AI cars must not run through the player on foot.
  }
  for (const ped of state.peds) {
    if (ped.downT > 0) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < car.len * 0.42 && Math.abs(car.speed) > 26) {
      ped.downT = 4;
      ped.fleeT = 8;
      if (isPlayerCar) {
        state.player.health -= 0.5;
        commitCrime(2, 'Pedestrian down in ' + state.district.name + '!');
        sound.blip('thud');
      }
    }
  }
}

// Traffic AI: follow the current road axis; at intersections sometimes
// turn; slow for the car ahead; if badly stuck, pick a fresh axis.
function stepTrafficCar(car, dt) {
  const speedTarget = car.cruise;
  let desired = car.angle;
  if (car.routeAxis === 'v') {
    const rx = nearestVerticalRoad(car.x);
    car.x += (rx + (Math.sin(car.angle) > 0 ? -22 : 22) - car.x) * Math.min(1, dt * 2);
    desired = Math.sin(car.angle) > 0 ? Math.PI / 2 : -Math.PI / 2;
    const nh = nearestHorizontalRoad(car.y);
    if (Math.abs(car.y - nh) < 26 && Math.random() < 0.006) {
      car.routeAxis = 'h';
      desired = Math.random() < 0.5 ? 0 : Math.PI;
    }
  } else {
    const ry = nearestHorizontalRoad(car.y);
    car.y += (ry + (Math.cos(car.angle) > 0 ? 22 : -22) - car.y) * Math.min(1, dt * 2);
    desired = Math.cos(car.angle) > 0 ? 0 : Math.PI;
    const nv = nearestVerticalRoad(car.x);
    if (Math.abs(car.x - nv) < 26 && Math.random() < 0.006) {
      car.routeAxis = 'v';
      desired = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  let angDiff = desired - car.angle;
  while (angDiff > Math.PI) angDiff -= Math.PI * 2;
  while (angDiff < -Math.PI) angDiff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, angDiff * 3 * dt + angDiff * dt));

  // Simple car-following: brake if something is right ahead.
  let blocked = false;
  const aheadX = car.x + Math.cos(car.angle) * 74;
  const aheadY = car.y + Math.sin(car.angle) * 74;
  for (const other of [...state.traffic, ...state.police]) {
    if (other === car) continue;
    if (Math.hypot(other.x - aheadX, other.y - aheadY) < 40) { blocked = true; break; }
  }
  if (state.player.car && Math.hypot(state.player.car.x - aheadX, state.player.car.y - aheadY) < 44) blocked = true;

  const target = blocked ? 0 : speedTarget;
  car.speed += (target - car.speed) * Math.min(1, dt * (blocked ? 5 : 1.2));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (resolveBuildingCollision(city.buildings, car, car.wid * 0.7)) {
    car.speed = 0;
    car.stuckTime += dt;
    if (car.stuckTime > 1.2) {
      car.routeAxis = car.routeAxis === 'v' ? 'h' : 'v';
      car.angle += Math.PI;
      car.stuckTime = 0;
    }
  } else car.stuckTime = Math.max(0, car.stuckTime - dt);
  clampToIsland(car, 26);
  collideCarWithWorld(car, false);
}

// Police AI: chase the player's position, aim to ram; when close and the
// player is slow/on foot, the bust meter fills.
function stepPoliceCar(car, dt) {
  const p = state.player;
  const dx = p.x - car.x;
  const dy = p.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const desired = Math.atan2(dy, dx);
  let angDiff = desired - car.angle;
  while (angDiff > Math.PI) angDiff -= Math.PI * 2;
  while (angDiff < -Math.PI) angDiff += Math.PI * 2;
  car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, angDiff * 2.6 * dt + angDiff * dt * 0.6));
  const target = dist > 300 ? car.topSpeed : Math.min(car.topSpeed, 120 + dist * 0.55);
  car.speed += (target - car.speed) * Math.min(1, dt * 1.6);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.steerVisual = Math.max(-0.4, Math.min(0.4, angDiff));
  resolveBuildingCollision(city.buildings, car, car.wid * 0.7);
  clampToIsland(car, 26);
  collideCarWithWorld(car, false);
  if (dist < car.len * 0.62 && Math.abs(car.speed) > 120) {
    // Ram impact.
    if (p.car) { p.car.health -= 5; p.car.speed *= 0.6; }
    state.player.health -= 2.2;
    car.speed *= 0.4;
    sound.blip('thud');
  }
  return dist;
}

function stepPed(ped, dt) {
  if (ped.downT > 0) { ped.downT -= dt; ped.moving = false; return; }
  ped.wanderT -= dt;
  // Flee from nearby fast cars / recent violence.
  const p = state.player;
  const dangerD = Math.hypot(ped.x - p.x, ped.y - p.y);
  if (ped.fleeT > 0) {
    ped.fleeT -= dt;
    ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
    ped.x += Math.cos(ped.angle) * 120 * dt;
    ped.y += Math.sin(ped.angle) * 120 * dt;
    ped.moving = true;
    resolveBuildingCollision(city.buildings, ped, 9);
    clampToIsland(ped, 10);
    return;
  }
  if (dangerD < 60 && p.car && Math.abs(p.car.speed) > 120) ped.fleeT = 1.4;
  if (ped.wanderT <= 0) {
    ped.wanderT = 2 + Math.random() * 3.5;
    // Walk along the sidewalk: keep the dominant axis.
    if (Math.random() < 0.5) ped.angle = Math.random() < 0.5 ? 0 : Math.PI;
    else ped.angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  }
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  ped.moving = true;
  ped.phase += dt * 8;
  if (resolveBuildingCollision(city.buildings, ped, 9)) {
    ped.angle += Math.PI / 2;
  }
  clampToIsland(ped, 10);
}

// ---------------------------------------------------------------------------
// The fixed-step simulation.
// ---------------------------------------------------------------------------
function simulate(dt) {
  state.time += dt;
  state.crimeCooldown = Math.max(0, state.crimeCooldown - dt);
  const p = state.player;

  stepPlayer(dt);
  for (const car of state.traffic) stepTrafficCar(car, dt);
  for (const ped of state.peds) stepPed(ped, dt);

  // Wanted / police management.
  state.policeSpawnT -= dt;
  const wantCount = wantedTargetPolice();
  if (state.wanted > 0 && state.police.length < wantCount && state.policeSpawnT <= 0) {
    spawnPolice();
    state.policeSpawnT = 1.6;
  }
  let anyPoliceNear = false;
  let bustPressure = 0;
  for (const car of [...state.police]) {
    const dist = stepPoliceCar(car, dt);
    if (dist < 700) anyPoliceNear = true;
    if (dist < 130 && (!p.car || Math.abs(p.car.speed) < 26)) bustPressure += dt;
  }
  if (state.wanted === 0 && state.police.length) {
    // Police give up and leave when heat is gone.
    state.police = state.police.filter((car) => Math.hypot(car.x - p.x, car.y - p.y) < 1500);
    if (Math.random() < dt * 0.4 && state.police.length) state.police.pop();
  }
  if (anyPoliceNear) state.hiddenTime = 0;
  else if (state.wanted > 0) {
    state.hiddenTime += dt;
    if (state.hiddenTime > 7) {
      state.hiddenTime = 0;
      state.wanted -= 1;
      state.lastWantedChange = state.time;
      if (state.wanted === 0) showDialog('EKPD DISPATCH', 'Suspect lost. Units, stand down.', 3);
    }
  }
  state.bustMeter = Math.max(0, (state.bustMeter || 0) + bustPressure - (bustPressure ? 0 : dt * 0.7));
  if (state.bustMeter > 2.4 && state.wanted > 0) endRun('busted');

  // Health / wasted.
  if (p.car) p.car.health = Math.max(0, p.car.health);
  if (p.health <= 0) endRun('wasted');
  if (!p.car) p.health = Math.min(100, p.health + dt * 1.1); // slow recovery on foot

  // District tracking.
  const d = districtAt(p.x, p.y);
  if (d.id !== state.district.id) {
    state.district = d;
    state.districtSince = state.time;
  }

  // Ticker rotation.
  state.tickerT -= dt;
  if (state.tickerT <= 0) {
    state.tickerT = 9;
    state.ticker = ISLAND_LINES[Math.floor(Math.random() * ISLAND_LINES.length)];
  }

  // Mission wiring.
  if (!state.mission && state.screen === 'play') {
    const marker = currentMarker(null);
    state.marker = marker;
    // The composed chase scene carries its own objective line.
    if (shotMode !== 'chase') state.objectiveText = freeRoamObjective();
    if (Math.hypot(p.x - marker.x, p.y - marker.y) < 95 && state.missionsDone < MISSIONS.length) {
      beginMission(state.missionsDone);
    }
  }
  if (state.mission) {
    const ms = state.mission;
    const marker = currentMarker(ms);
    state.marker = marker;
    const distToMarker = marker ? Math.hypot(p.x - marker.x, p.y - marker.y) : null;
    const res = updateMission(ms, {
      dt,
      distToMarker,
      wanted: state.wanted,
      heatTimerDone: state.wanted === 0,
    });
    if (res.note && (res.stageDone || res.missionDone || res.failed)) {
      showDialog(FIXER_NAME, res.note.replace(/^Mara: /, ''), 5);
    }
    if (res.failed) {
      state.mission = null;
      state.crimeCooldown = 1;
    } else if (res.missionDone) {
      state.cash += ms.def.reward;
      state.totalEarned += ms.def.reward;
      state.missionsDone += 1;
      state.mission = null;
      sound.blip('cash');
      writeSave();
    } else if (res.stageDone) {
      sound.blip('pickup');
    }
    state.objectiveText = state.mission ? currentObjectiveText(state.mission) : freeRoamObjective();
  }

  // Camera follows the player (lead slightly toward travel direction).
  const lead = p.car ? 0.32 : 0.12;
  const tx = p.x + (p.car ? p.car.vx * lead : 0);
  const ty = p.y + (p.car ? p.car.vy * lead : 0);
  state.cam.x += (tx - state.cam.x) * Math.min(1, dt * 4.5);
  state.cam.y += (ty - state.cam.y) * Math.min(1, dt * 4.5);
  state.cam.zoom += (((p.car && Math.abs(p.car.speed) > 190) ? 0.82 : 1) - state.cam.zoom) * Math.min(1, dt * 2);

  // Sound follow-up.
  const speedNorm = p.car ? Math.abs(p.car.speed) / p.car.topSpeed : 0;
  sound.update(dt, speedNorm, state.police.length > 0 && state.wanted > 0, state.time);

  // Rank name cache for the HUD.
  state.rankName = rankFor(state.totalEarned).rank.name;
}

function endRun(kind) {
  if (state.screen !== 'play') return;
  state.screen = kind;
  state.endKind = kind;
  state.endT = state.time;
  state.bailCost = kind === 'busted' ? 60 + state.wanted * 45 : 80;
  state.cash = Math.max(0, state.cash - state.bailCost);
  state.wanted = 0;
  state.police = [];
  state.bustMeter = 0;
  writeSave();
}

function revive() {
  state.player.health = 100;
  if (state.player.car) { state.player.car.occupied = false; state.player.car = null; }
  state.player.x = 1500;
  state.player.y = 1470;
  state.screen = 'play';
}

function startNewGame() {
  state.cash = 250;
  state.totalEarned = 0;
  state.missionsDone = 0;
  state.wanted = 0;
  state.police = [];
  state.mission = null;
  resetPlayer();
  populateWorld();
  state.screen = 'play';
  showDialog(FIXER_NAME, 'Welcome to Ember Isle. Gold marker, Old Market — come earn your first key.', 6);
  writeSave();
}

function continueGame() {
  const save = loadSave();
  if (save) {
    state.cash = save.cash;
    state.totalEarned = save.totalEarned || 0;
    state.missionsDone = save.missionsDone || 0;
    if (save.muted) sound.setMuted(true);
  }
  state.screen = 'play';
  showDialog(FIXER_NAME, 'Back on the island. The gold marker is Mara — she always has work.', 5);
}

// ---------------------------------------------------------------------------
// Deterministic screenshot scenes. Each composes a rich frozen moment with
// the seeded RNG, runs a few warm-up steps so traffic is mid-motion, then
// flags readiness for the capture tool (window.__emberReady).
// ---------------------------------------------------------------------------
function composeShotScene(mode) {
  const rng = mulberry32(SEED ^ 0x51ab);
  resetPlayer();
  state.cash = 640;
  state.totalEarned = 780;
  state.missionsDone = 2;
  state.rankName = rankFor(state.totalEarned).rank.name;
  state.districtSince = -9; // no district banner over the composed scenes

  if (mode === 'cover') {
    // Hero vista: player on foot beside a hero coupe at a Glass Mile
    // intersection, traffic around, mission marker glowing down the road.
    const hero = makeCar(2352, 1580, -0.5, '#e8641e', 0, 'civilian');
    hero.modelName = 'Ember Coupe';
    state.parked.push(hero);
    state.player.x = 2290; state.player.y = 1645; state.player.angle = -0.7;
    state.cam.x = 2330; state.cam.y = 1560;
    beginMission(0);
    state.dialog = null;
    for (let i = 0; i < 40; i++) stepTrafficOnly(1 / 30);
  } else if (mode === 'chase') {
    // Active pursuit: player driving, three EKPD cars closing in, 3 stars.
    const car = makeCar(2320, 2260, Math.PI / 2, '#c8452c', 0, 'civilian');
    car.speed = 210;
    car.occupied = true;
    state.player.car = car;
    state.player.x = car.x; state.player.y = car.y; state.player.angle = car.angle;
    state.wanted = 3;
    state.lastWantedChange = state.time;
    const spots = [
      [2190, 1980, Math.PI / 2], [2470, 2050, Math.PI / 2], [2300, 2620, -Math.PI / 2],
    ];
    for (const [x, y, a] of spots) {
      const cop = makeCar(x, y, a, '#dfe5ea', 1, 'police');
      cop.color = '#dfe5ea';
      cop.speed = 195;
      state.police.push(cop);
    }
    state.cam.x = car.x; state.cam.y = car.y + 60;
    state.objectiveText = 'Escape the EKPD — break line of sight until the stars fade!';
    state.marker = { x: 1500, y: 1400 };
    showDialog('EKPD DISPATCH', 'All units — red coupe, Glass Mile bridge road. Box it in!', 30);
    for (let i = 0; i < 24; i++) stepTrafficOnly(1 / 30);
  } else if (mode === 'mission') {
    // Mid-mission delivery: carrying the ash parcel, marker ahead, traffic.
    const car = makeCar(2790, 1530, Math.PI, '#2c6ec8', 1, 'civilian');
    car.speed = 120;
    car.occupied = true;
    state.player.car = car;
    state.player.x = car.x; state.player.y = car.y; state.player.angle = car.angle;
    state.mission = startMissionState(1);
    state.mission.stageIndex = 1;
    state.mission.stage = state.mission.def.stages[1];
    state.mission.carrying = 'Ash parcel';
    state.objectiveText = currentObjectiveText(state.mission);
    state.marker = currentMarker(state.mission);
    state.cam.x = car.x - 40; state.cam.y = car.y - 30;
    showDialog(FIXER_NAME, 'Parcel is in the trunk. Glass Mile tower — and keep the paint pretty.', 30);
    for (let i = 0; i < 30; i++) stepTrafficOnly(1 / 30);
  } else if (mode === 'menu') {
    // Menu over a live city backdrop.
    state.player.x = 2352; state.player.y = 1580;
    state.cam.x = 2330; state.cam.y = 1540;
    state.hasSave = !!loadSave();
    for (let i = 0; i < 30; i++) stepTrafficOnly(1 / 30);
  }
  state.district = districtAt(state.player.x, state.player.y);
  state.objectiveText = state.objectiveText || freeRoamObjective();
  if (!state.marker && mode !== 'menu') state.marker = currentMarker(state.mission);
  state.shotReady = true;
  window.__emberReady = true;
  window.__emberState = state;
}

function stepTrafficOnly(dt) {
  state.time += dt;
  for (const car of state.traffic) stepTrafficCar(car, dt);
  for (const ped of state.peds) stepPed(ped, dt);
  for (const cop of state.police) { cop.x += Math.cos(cop.angle) * cop.speed * dt * 0.25; cop.y += Math.sin(cop.angle) * cop.speed * dt * 0.25; }
}

// ---------------------------------------------------------------------------
// Rendering.
// ---------------------------------------------------------------------------
function render() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#274b63';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(state.cam.zoom, state.cam.zoom);
  ctx.translate(-state.cam.x, -state.cam.y);

  drawWorld(ctx, state.cam, city, state.time);
  drawDistrictLabels(ctx, state.cam);

  // Mission marker beacon under the entities.
  if (state.marker && state.screen !== 'menu') {
    drawMarker(ctx, state.marker.x, state.marker.y, state.time, state.mission ? state.mission.def.title : 'MARA — FIXER');
  }

  for (const car of state.parked) drawCar(ctx, car, state.time);
  for (const car of state.traffic) drawCar(ctx, car, state.time);
  for (const car of state.police) drawCar(ctx, car, state.time);
  if (state.player.car) drawCar(ctx, state.player.car, state.time);
  for (const ped of state.peds) {
    if (ped.downT > 0) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.shirt;
      ctx.fillRect(-9, -4, 18, 8);
      ctx.fillStyle = ped.skin;
      ctx.beginPath(); ctx.arc(12, 0, 4.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      drawPerson(ctx, ped, state.time, false);
    }
  }
  if (!state.player.car) drawPerson(ctx, state.player, state.time, true);
  drawHitFx(ctx, state.hitFx, state.time);
  ctx.restore();

  // Bust meter ring near the player when pressure builds.
  if ((state.bustMeter || 0) > 0.15 && state.screen === 'play') {
    ctx.strokeStyle = '#7da7ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2 - 60, 20, -Math.PI / 2, -Math.PI / 2 + (state.bustMeter / 2.4) * Math.PI * 2);
    ctx.stroke();
  }

  if (state.screen === 'menu') {
    drawMenu(ctx, state, state.time);
  } else {
    drawHud(ctx, state, state.time);
    drawMinimap(ctx, state, state.time);
    drawDialog(ctx, state, state.time);
    if (state.screen === 'pause') drawPause(ctx);
    if (state.screen === 'busted') drawBusted(ctx, state, 'busted');
    if (state.screen === 'wasted') drawBusted(ctx, state, 'wasted');
  }

  // Enter-car prompt.
  if (state.screen === 'play' && !state.player.car) {
    const near = nearestCarTo(state.player.x, state.player.y, 62);
    if (near) {
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10,12,16,0.7)';
      const label = 'E — TAKE THE ' + near.modelName.toUpperCase();
      const w = ctx.measureText(label).width + 22;
      ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, H - 120, w, 30, 8); ctx.fill();
      ctx.fillStyle = '#ffd95e';
      ctx.fillText(label, W / 2, H - 100);
    }
  }
}

// ---------------------------------------------------------------------------
// Main loop: fixed-step simulation (120 Hz substeps of the 60 Hz frame) so
// physics is stable and screenshot scenes are reproducible.
// ---------------------------------------------------------------------------
let lastTs = 0;
let accumulator = 0;
const STEP = 1 / 60;

function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastTs) lastTs = ts;
  let elapsed = Math.min(0.1, (ts - lastTs) / 1000);
  lastTs = ts;
  accumulator += elapsed;

  if (enterPressed) {
    enterPressed = false;
    if (state.screen === 'menu') {
      sound.ensureStarted();
      if (state.hasSave) continueGame(); else startNewGame();
    } else if (state.screen === 'busted' || state.screen === 'wasted') {
      revive();
    }
  }

  while (accumulator >= STEP) {
    accumulator -= STEP;
    if (state.screen === 'play') simulate(STEP);
    else if (state.screen === 'menu') {
      state.time += STEP;
      for (const car of state.traffic) stepTrafficCar(car, STEP);
    } else {
      state.time += STEP;
    }
  }
  render();
}

// ---------------------------------------------------------------------------
// Boot sequence: restore save presence, compose shot scenes if requested,
// expose a tiny debug hook for automated playability checks.
// ---------------------------------------------------------------------------
state.hasSave = !!loadSave();
state.rankName = rankFor(state.totalEarned).rank.name;
if (shotMode) {
  composeShotScene(shotMode);
} else {
  state.screen = 'menu';
}

window.__ember = {
  state,
  startNewGame,
  continueGame,
  keys,
  press(code, down) { keys[code] = down; },
  tap(code) {
    if (code === 'KeyE') tryEnterExit();
    if (code === 'Space') doCombatAction();
  },
};

requestAnimationFrame(frame);
