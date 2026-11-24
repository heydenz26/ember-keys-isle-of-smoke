// Ember Keys — Isle of Smoke
// city.js — world definition: seeded RNG, island layout, road network,
// seven districts, buildings, props, parked cars and collision helpers.
// Written from scratch for this build. No external libraries.

// ---------------------------------------------------------------------------
// Seeded random number generator (mulberry32). The whole island is derived
// from one seed so composed screenshot scenes are perfectly reproducible.
// ---------------------------------------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeedFromString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// World constants. The island is a rectangle of land surrounded by water.
// Roads form a regular grid; city blocks sit between the roads and hold the
// buildings. Two bridges leave the island to the north and south edges so
// the shoreline reads clearly in the cover shot.
// ---------------------------------------------------------------------------
export const WORLD = {
  width: 4800,
  height: 3600,
  waterMargin: 420, // water band around the land mass
  roadHalf: 46, // half width of a road surface
  sidewalk: 14, // sidewalk band on each side of a road
};

export const V_ROADS = [520, 1120, 1720, 2320, 2920, 3520, 4120];
export const H_ROADS = [460, 1060, 1660, 2260, 2860];

// District definitions: name, tint, flavour line, and the rectangle (in
// world coordinates) the district occupies. Seven districts, each with its
// own ground tint and building palette so the minimap reads at a glance.
export const DISTRICTS = [
  {
    id: 'emberport',
    name: 'Emberport',
    tag: 'Docks & cranes',
    x: 0, y: 2260, w: 2320, h: 1340,
    ground: '#5d6b5a', roofA: '#8a5a44', roofB: '#6e4634',
  },
  {
    id: 'smokestack',
    name: 'Smokestack Row',
    tag: 'Foundries & ash',
    x: 2320, y: 2260, w: 2480, h: 1340,
    ground: '#6b6257', roofA: '#7d4b3a', roofB: '#5c3a2e',
  },
  {
    id: 'oldmarket',
    name: 'Old Market',
    tag: 'Stalls & alleys',
    x: 0, y: 1060, w: 1720, h: 1200,
    ground: '#6f6a55', roofA: '#9c6b4f', roofB: '#7a5138',
  },
  {
    id: 'glassmile',
    name: 'Glass Mile',
    tag: 'Towers & neon',
    x: 1720, y: 1060, w: 1800, h: 1200,
    ground: '#5f6d72', roofA: '#4f7d8c', roofB: '#3a5f6b',
  },
  {
    id: 'cinderheights',
    name: 'Cinder Heights',
    tag: 'Hillside homes',
    x: 3520, y: 1060, w: 1280, h: 1200,
    ground: '#66755e', roofA: '#8f7a52', roofB: '#6f5c3a',
  },
  {
    id: 'northgate',
    name: 'Northgate',
    tag: 'Civic quarter',
    x: 0, y: 0, w: 2320, h: 1060,
    ground: '#636e63', roofA: '#7c6a8a', roofB: '#5d4f6e',
  },
  {
    id: 'kingsrow',
    name: "King's Row",
    tag: 'Casinos & clubs',
    x: 2320, y: 0, w: 2480, h: 1060,
    ground: '#6d6152', roofA: '#a05a6e', roofB: '#7d4356',
  },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

// ---------------------------------------------------------------------------
// Road helpers. A point is "on a road" when it is within roadHalf of any
// grid line and inside the island bounds (with a small apron at the edges).
// ---------------------------------------------------------------------------
export function nearestVerticalRoad(x) {
  let best = V_ROADS[0];
  let bestDist = Infinity;
  for (const rx of V_ROADS) {
    const d = Math.abs(x - rx);
    if (d < bestDist) { bestDist = d; best = rx; }
  }
  return best;
}

export function nearestHorizontalRoad(y) {
  let best = H_ROADS[0];
  let bestDist = Infinity;
  for (const ry of H_ROADS) {
    const d = Math.abs(y - ry);
    if (d < bestDist) { bestDist = d; best = ry; }
  }
  return best;
}

export function isOnRoad(x, y) {
  if (x < -80 || y < -80 || x > WORLD.width + 80 || y > WORLD.height + 80) return false;
  for (const rx of V_ROADS) if (Math.abs(x - rx) <= WORLD.roadHalf) return true;
  for (const ry of H_ROADS) if (Math.abs(y - ry) <= WORLD.roadHalf) return true;
  return false;
}

export function isOnSidewalk(x, y) {
  const band = WORLD.roadHalf + WORLD.sidewalk;
  for (const rx of V_ROADS) {
    const d = Math.abs(x - rx);
    if (d > WORLD.roadHalf && d <= band) return true;
  }
  for (const ry of H_ROADS) {
    const d = Math.abs(y - ry);
    if (d > WORLD.roadHalf && d <= band) return true;
  }
  return false;
}

export function isWater(x, y) {
  return x < 0 || y < 0 || x > WORLD.width || y > WORLD.height;
}

// Intersections of the grid — traffic cars pick routes through these.
export function intersections() {
  const list = [];
  for (const rx of V_ROADS) {
    for (const ry of H_ROADS) list.push({ x: rx, y: ry });
  }
  return list;
}

// ---------------------------------------------------------------------------
// Building generation. Each city block (the rectangle between neighbouring
// roads) gets a small cluster of buildings with a gap for an alley. Every
// building stores its footprint, height tier, roof colour and a few window
// rows so the renderer can shade it without extra random calls per frame.
// ---------------------------------------------------------------------------
export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const props = [];
  const parkedSpots = [];

  const xEdges = [-40, ...V_ROADS, WORLD.width + 40];
  const yEdges = [-40, ...H_ROADS, WORLD.height + 40];

  for (let bi = 0; bi < xEdges.length - 1; bi++) {
    for (let bj = 0; bj < yEdges.length - 1; bj++) {
      const blockX0 = xEdges[bi] + WORLD.roadHalf + WORLD.sidewalk + 10;
      const blockX1 = xEdges[bi + 1] - WORLD.roadHalf - WORLD.sidewalk - 10;
      const blockY0 = yEdges[bj] + WORLD.roadHalf + WORLD.sidewalk + 10;
      const blockY1 = yEdges[bj + 1] - WORLD.roadHalf - WORLD.sidewalk - 10;
      const bw = blockX1 - blockX0;
      const bh = blockY1 - blockY0;
      if (bw < 120 || bh < 120) continue;

      const district = districtAt((blockX0 + blockX1) / 2, (blockY0 + blockY1) / 2);
      const cols = bw > 420 ? 2 : 1;
      const rows = bh > 420 ? 2 : 1;
      const cellW = bw / cols;
      const cellH = bh / rows;

      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (rng() < 0.12) continue; // empty lot / small plaza
          const pad = 16 + rng() * 14;
          const w = cellW - pad * 2;
          const h = cellH - pad * 2;
          if (w < 60 || h < 60) continue;
          const tier = rng();
          const heightTier = tier < 0.45 ? 1 : tier < 0.8 ? 2 : 3;
          buildings.push({
            x: blockX0 + cx * cellW + pad,
            y: blockY0 + cy * cellH + pad,
            w, h,
            heightTier,
            roof: rng() < 0.5 ? district.roofA : district.roofB,
            wall: shadeWall(district.roofA, rng()),
            district: district.id,
            windowsAcross: Math.max(2, Math.floor(w / 34)),
            windowsDown: Math.max(2, Math.floor(h / 34)),
            seed: Math.floor(rng() * 1e9),
          });
        }
      }

      // Street props: lamps and crates near block corners.
      const propCount = 2 + Math.floor(rng() * 3);
      for (let p = 0; p < propCount; p++) {
        props.push({
          x: blockX0 + rng() * bw,
          y: blockY0 + (rng() < 0.5 ? -6 : bh + 6),
          kind: rng() < 0.6 ? 'lamp' : 'crate',
        });
      }

      // Parked car spots hug the block edges, nose along the road.
      if (rng() < 0.85) {
        const side = Math.floor(rng() * 4);
        let spot;
        if (side === 0) spot = { x: blockX0 + bw * (0.3 + rng() * 0.4), y: blockY0 - 26, angle: Math.PI / 2 };
        else if (side === 1) spot = { x: blockX0 + bw * (0.3 + rng() * 0.4), y: blockY1 + 26, angle: Math.PI / 2 };
        else if (side === 2) spot = { x: blockX0 - 26, y: blockY0 + bh * (0.3 + rng() * 0.4), angle: 0 };
        else spot = { x: blockX1 + 26, y: blockY0 + bh * (0.3 + rng() * 0.4), angle: 0 };
        parkedSpots.push(spot);
      }
    }
  }

  // Palm-like ember trees scattered on the grass verges.
  for (let i = 0; i < 90; i++) {
    const x = rng() * WORLD.width;
    const y = rng() * WORLD.height;
    if (!isOnRoad(x, y) && !isOnSidewalk(x, y)) {
      props.push({ x, y, kind: 'tree', seed: Math.floor(rng() * 1e9) });
    }
  }

  // Bridges: causeways crossing the water at the middle vertical road,
  // north and south, drawn as decks over the water band.
  const bridges = [
    { x: 2320 - 70, y: -WORLD.waterMargin, w: 140, h: WORLD.waterMargin },
    { x: 2320 - 70, y: WORLD.height, w: 140, h: WORLD.waterMargin },
    { x: -WORLD.waterMargin, y: 1660 - 70, w: WORLD.waterMargin, h: 140 },
    { x: WORLD.width, y: 1660 - 70, w: WORLD.waterMargin, h: 140 },
  ];

  return { buildings, props, parkedSpots, bridges };
}

function shadeWall(roofHex, t) {
  // Derive a wall tone from the roof colour by darkening it a touch.
  const n = parseInt(roofHex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) - 26 - Math.floor(t * 18)));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) - 26 - Math.floor(t * 18)));
  const b = Math.max(0, Math.min(255, (n & 255) - 22 - Math.floor(t * 14)));
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// Collision: axis-aligned building rectangles. Entities test a point (with
// a radius) against every building; the city is small enough that a linear
// scan with an early-out is fine and keeps the code easy to audit.
// ---------------------------------------------------------------------------
export function collideBuildings(buildings, x, y, radius) {
  for (const b of buildings) {
    if (
      x + radius > b.x && x - radius < b.x + b.w &&
      y + radius > b.y && y - radius < b.y + b.h
    ) {
      return b;
    }
  }
  return null;
}

export function resolveBuildingCollision(buildings, ent, radius) {
  const hit = collideBuildings(buildings, ent.x, ent.y, radius);
  if (!hit) return false;
  // Push out along the smallest penetration axis.
  const left = ent.x + radius - hit.x;
  const right = hit.x + hit.w - (ent.x - radius);
  const top = ent.y + radius - hit.y;
  const bottom = hit.y + hit.h - (ent.y - radius);
  const min = Math.min(left, right, top, bottom);
  if (min === left) ent.x = hit.x - radius;
  else if (min === right) ent.x = hit.x + hit.w + radius;
  else if (min === top) ent.y = hit.y - radius;
  else ent.y = hit.y + hit.h + radius;
  return true;
}

// Clamp an entity inside the playable shoreline (bridges allow a little
// overshoot so the player can drive to the island edge and look out).
export function clampToIsland(ent, margin) {
  const m = margin ?? 24;
  ent.x = Math.max(-WORLD.waterMargin + 60, Math.min(WORLD.width + WORLD.waterMargin - 60, ent.x));
  ent.y = Math.max(-WORLD.waterMargin + 60, Math.min(WORLD.height + WORLD.waterMargin - 60, ent.y));
  if (ent.x < -m || ent.x > WORLD.width + m || ent.y < -m || ent.y > WORLD.height + m) {
    // Off the bridges and into the water: push back to the shoreline.
    ent.x = Math.max(0, Math.min(WORLD.width, ent.x));
    ent.y = Math.max(0, Math.min(WORLD.height, ent.y));
    return true;
  }
  return false;
}

// Palette of civilian car paint jobs used across traffic and parked cars.
export const CAR_PAINTS = [
  '#c8452c', '#2c6ec8', '#e0a51f', '#3fae6a', '#e8e4da', '#30343c',
  '#7a3fa0', '#c86a9a', '#4a90a4', '#8c8f96', '#b3541e', '#274e13',
];

export const CAR_MODELS = [
  { name: 'Ember Coupe', len: 52, wid: 26, topSpeed: 300 },
  { name: 'Harbour Sedan', len: 58, wid: 28, topSpeed: 265 },
  { name: 'Dune Buggy', len: 46, wid: 27, topSpeed: 285 },
  { name: 'Cargo Van', len: 64, wid: 30, topSpeed: 220 },
  { name: 'Row Taxi', len: 56, wid: 28, topSpeed: 255 },
];
