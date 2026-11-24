// Ember Keys — Isle of Smoke
// missions.js — the fixer mission chain: story data, stage logic and the
// fixer-rank ladder. Missions are data-driven: each mission is a list of
// stages, and each stage is one objective the game state machine walks.
//
// Stage kinds:
//   goto     — reach the marker (on foot or in a car)
//   pickup   — reach the marker; a package is collected on arrival
//   deliver  — carry the package to the marker before the timer ends
//   escape   — lose the wanted level (drop to zero stars) to finish
//   timerun  — reach the marker before the countdown expires
//
// Written from scratch for this build.

// Fixer ranks: cash-earned thresholds that promote the player. The rank is
// shown in the HUD and saved, so progress survives between sessions.
export const RANKS = [
  { name: 'Nobody', need: 0 },
  { name: 'Runner', need: 150 },
  { name: 'Wheelman', need: 450 },
  { name: 'Fixer’s Right Hand', need: 900 },
  { name: 'Smoke Broker', need: 1500 },
  { name: 'Keyholder of Ember Isle', need: 2400 },
];

export function rankFor(totalEarned) {
  let rank = RANKS[0];
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (totalEarned >= RANKS[i].need) { rank = RANKS[i]; index = i; }
  }
  const next = RANKS[index + 1] || null;
  return { rank, index, next };
}

// The fixer: Mara Voss, who runs jobs out of the Old Market. Her lines open
// and close every mission so the chain reads as one small story.
export const FIXER_NAME = 'Mara Voss';

export const MISSIONS = [
  {
    id: 'first-keys',
    title: 'First Keys',
    brief: 'Mara: “New face, old island. Prove you can drive — bring my coupe back from Emberport.”',
    reward: 120,
    stages: [
      { kind: 'goto', x: 700, y: 3100, label: 'Reach Mara’s coupe in Emberport', radius: 90 },
      { kind: 'deliver', x: 1500, y: 1400, label: 'Deliver the coupe to the Old Market garage', radius: 90, carry: 'Mara’s coupe' },
    ],
    outro: 'Mara: “Not a scratch worth mentioning. You might last here.”',
  },
  {
    id: 'ash-parcel',
    title: 'Ash Parcel',
    brief: 'Mara: “A parcel in Smokestack Row needs to reach Glass Mile. No questions, no stops.”',
    reward: 200,
    stages: [
      { kind: 'pickup', x: 3300, y: 3000, label: 'Pick up the ash parcel in Smokestack Row', radius: 80 },
      { kind: 'deliver', x: 2500, y: 1400, label: 'Deliver the parcel to the Glass Mile tower', radius: 90, carry: 'Ash parcel' },
    ],
    outro: 'Mara: “Clean hands, full envelope. The Row owes you one.”',
  },
  {
    id: 'hot-lantern',
    title: 'Hot Lantern',
    brief: 'Mara: “You lifted the wrong lantern — EKPD is lit up. Lose them, then come home.”',
    reward: 260,
    heat: 3,
    stages: [
      { kind: 'goto', x: 3900, y: 500, label: 'Reach the King’s Row lantern cache', radius: 90 },
      { kind: 'escape', label: 'Lose the EKPD — break line of sight until the stars fade' },
      { kind: 'goto', x: 1500, y: 1400, label: 'Return to Mara in the Old Market', radius: 90 },
    ],
    outro: 'Mara: “Smoke swallows everyone eventually. You just made it swallow faster.”',
  },
  {
    id: 'cinder-clock',
    title: 'Cinder Clock',
    brief: 'Mara: “A buyer in Cinder Heights pays by the second. Beat the clock across the island.”',
    reward: 340,
    stages: [
      { kind: 'pickup', x: 900, y: 600, label: 'Collect the cinder clock in Northgate', radius: 80 },
      { kind: 'timerun', x: 4200, y: 1500, label: 'Beat the clock to Cinder Heights', radius: 95, time: 75, carry: 'Cinder clock' },
    ],
    outro: 'Mara: “Early. The buyer tipped extra — I almost smiled.”',
  },
  {
    id: 'kings-toll',
    title: 'King’s Toll',
    brief: 'Mara: “King’s Row wants its toll paid in kind. Take the toll van, run the bridges, shake the heat.”',
    reward: 520,
    heat: 2,
    stages: [
      { kind: 'pickup', x: 3600, y: 700, label: 'Take the toll strongbox in King’s Row', radius: 85 },
      { kind: 'deliver', x: 2320, y: 3450, label: 'Run the strongbox to the south bridge drop', radius: 100, carry: 'Toll strongbox' },
      { kind: 'escape', label: 'Shake the EKPD before you celebrate' },
    ],
    outro: 'Mara: “The Row pays its tolls now. Broker work, that was.”',
  },
  {
    id: 'isle-of-smoke',
    title: 'Isle of Smoke',
    brief: 'Mara: “Last key on the ring. Every district, one run — show the island who holds Ember Keys.”',
    reward: 900,
    stages: [
      { kind: 'goto', x: 700, y: 3100, label: 'Emberport checkpoint', radius: 95 },
      { kind: 'goto', x: 3900, y: 3000, label: 'Smokestack Row checkpoint', radius: 95 },
      { kind: 'timerun', x: 2600, y: 1300, label: 'Glass Mile checkpoint — on the clock', radius: 95, time: 60 },
      { kind: 'goto', x: 900, y: 500, label: 'Northgate checkpoint', radius: 95 },
      { kind: 'deliver', x: 1500, y: 1400, label: 'Finish at Mara’s garage, Old Market', radius: 100, carry: 'The Ember Keys' },
    ],
    outro: 'Mara: “Every key turns for you now. The Isle of Smoke is yours, Keyholder.”',
  },
];

// Ambient world chatter: short lines pedestrians and the radio ticker use
// to make the island feel lived-in. Pure flavour, rotated by the HUD.
export const ISLAND_LINES = [
  'EKPD reminds drivers: the bridges close at curfew.',
  'Emberport ferry delayed by ash drift, again.',
  'Glass Mile neon auction opens at dusk.',
  'Smokestack Row foundry reports a record pour.',
  'Old Market lantern festival — expect crowds.',
  'King’s Row casino denies everything, politely.',
  'Cinder Heights lookout: smoke on the water tonight.',
  'Northgate council debates the toll bridges.',
];

export function missionByIndex(i) {
  return MISSIONS[Math.max(0, Math.min(MISSIONS.length - 1, i))];
}

// Create the runtime state for one mission run.
export function startMissionState(index) {
  const def = missionByIndex(index);
  return {
    index,
    def,
    stageIndex: 0,
    stage: def.stages[0],
    stageTimeLeft: def.stages[0].time || 0,
    carrying: null,
    active: true,
    message: def.brief,
    messageUntil: 0,
  };
}

// Advance the mission state machine. Called by the game loop with a small
// event object describing what just happened this tick. Returns a result
// describing transitions so the game can play sounds, pay rewards and set
// wanted heat without missions.js touching game state directly.
export function updateMission(ms, ev) {
  const out = { stageDone: false, missionDone: false, failed: false, note: '' };
  if (!ms || !ms.active) return out;
  const stage = ms.stage;

  if (stage.time) {
    ms.stageTimeLeft -= ev.dt;
    if (ms.stageTimeLeft <= 0) {
      out.failed = true;
      out.note = 'Out of time — Mara cancels the run.';
      ms.active = false;
      return out;
    }
  }

  let done = false;
  if (stage.kind === 'goto' || stage.kind === 'pickup' || stage.kind === 'deliver' || stage.kind === 'timerun') {
    if (ev.distToMarker !== null && ev.distToMarker <= stage.radius) done = true;
  } else if (stage.kind === 'escape') {
    if (ev.wanted === 0 && ev.heatTimerDone) done = true;
  }

  if (!done) return out;

  out.stageDone = true;
  if (stage.kind === 'pickup' || stage.kind === 'deliver') {
    ms.carrying = stage.carry || ms.carrying;
    if (stage.kind === 'deliver') ms.carrying = null;
    out.note = stage.kind === 'pickup' ? 'Picked up: ' + (stage.carry || 'package') : 'Delivered.';
  }

  ms.stageIndex += 1;
  if (ms.stageIndex >= ms.def.stages.length) {
    out.missionDone = true;
    ms.active = false;
    out.note = ms.def.outro;
    return out;
  }
  ms.stage = ms.def.stages[ms.stageIndex];
  ms.stageTimeLeft = ms.stage.time || 0;
  if (ms.stage.kind === 'pickup') ms.carrying = null;
  if (ms.stage.carry && ms.stage.kind !== 'pickup') ms.carrying = ms.stage.carry;
  return out;
}

export function currentObjectiveText(ms) {
  if (!ms || !ms.active) return 'Free roam — visit Mara in the Old Market (gold marker) for work.';
  const stage = ms.stage;
  let text = ms.def.title + ': ' + stage.label;
  if (ms.carrying) text += '  •  Carrying: ' + ms.carrying;
  if (stage.time) text += '  •  ' + Math.max(0, Math.ceil(ms.stageTimeLeft)) + 's';
  return text;
}

export function currentMarker(ms) {
  if (!ms || !ms.active) return { x: 1500, y: 1400 }; // Mara's garage
  const stage = ms.stage;
  if (stage.kind === 'escape') return null;
  return { x: stage.x, y: stage.y };
}
