// Ember Keys — Isle of Smoke
// render.js — every canvas drawing routine for the world: water, shoreline,
// district ground, roads, bridges, buildings with roofs and shadows, street
// props, pedestrians, the player, and — most importantly — the cars.
//
// Cars are drawn as volumetric bodies: an offset drop shadow, a darker
// lower body, a lighter hood and trunk, a dark tinted-glass cabin, a roof
// panel, and FOUR dark wheels placed at the corners of the body rectangle.
// All car drawing happens in a rotated local frame (translate + rotate to
// the car's heading), so the wheels and cabin stay correct at any angle.
// Police cars add a red/blue light bar that flashes with game time.
//
// Written from scratch for this build.

import { WORLD, V_ROADS, H_ROADS, DISTRICTS, districtAt } from './city.js';

// ---------------------------------------------------------------------------
// Small drawing helpers
// ---------------------------------------------------------------------------
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// Static world layer. The island is rendered once into an offscreen canvas
// at world scale (downscaled) — no: we draw it per frame inside the camera
// transform but cull to the viewport, which keeps edges crisp at any zoom.
// ---------------------------------------------------------------------------
export function drawWorld(ctx, cam, city, time) {
  const viewW = ctx.canvas.width / cam.zoom;
  const viewH = ctx.canvas.height / cam.zoom;
  const x0 = cam.x - viewW / 2 - 80;
  const y0 = cam.y - viewH / 2 - 80;
  const x1 = cam.x + viewW / 2 + 80;
  const y1 = cam.y + viewH / 2 + 80;

  // Water with a slow moving shimmer.
  ctx.fillStyle = '#274b63';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = 'rgba(120,180,210,0.10)';
  const shimmerOff = (time * 12) % 90;
  for (let wx = Math.floor(x0 / 90) * 90; wx < x1; wx += 90) {
    for (let wy = Math.floor(y0 / 90) * 90; wy < y1; wy += 90) {
      if (wx > -40 && wx < WORLD.width + 40 && wy > -40 && wy < WORLD.height + 40) continue;
      ctx.fillRect(wx + shimmerOff - 45, wy + ((wx + wy) % 50), 34, 3);
    }
  }

  // Land mass with a sandy shoreline lip.
  ctx.fillStyle = '#c2b28a';
  ctx.fillRect(-26, -26, WORLD.width + 52, WORLD.height + 52);
  ctx.fillStyle = '#77875f';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // District ground tints.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.globalAlpha = 1;
  }

  // Bridges over the water.
  for (const b of city.bridges) {
    ctx.fillStyle = '#8d8d94';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#f2d13c';
    if (b.w < b.h) ctx.fillRect(b.x + b.w / 2 - 3, b.y, 6, b.h);
    else ctx.fillRect(b.x, b.y + b.h / 2 - 3, b.w, 6);
    ctx.fillStyle = '#5d5d63';
    ctx.fillRect(b.x, b.y, 8, b.h === 140 ? b.h : 8);
  }

  // Roads: asphalt, sidewalks, centre dashes.
  ctx.fillStyle = '#9a968c'; // sidewalk slabs under the asphalt edges
  for (const rx of V_ROADS) ctx.fillRect(rx - WORLD.roadHalf - WORLD.sidewalk, 0, (WORLD.roadHalf + WORLD.sidewalk) * 2, WORLD.height);
  for (const ry of H_ROADS) ctx.fillRect(0, ry - WORLD.roadHalf - WORLD.sidewalk, WORLD.width, (WORLD.roadHalf + WORLD.sidewalk) * 2);
  ctx.fillStyle = '#3c3f45';
  for (const rx of V_ROADS) ctx.fillRect(rx - WORLD.roadHalf, 0, WORLD.roadHalf * 2, WORLD.height);
  for (const ry of H_ROADS) ctx.fillRect(0, ry - WORLD.roadHalf, WORLD.width, WORLD.roadHalf * 2);
  ctx.fillStyle = '#e8e2c8';
  for (const rx of V_ROADS) {
    for (let y = 10; y < WORLD.height; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
  }
  for (const ry of H_ROADS) {
    for (let x = 10; x < WORLD.width; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(240,240,235,0.65)';
  for (const rx of V_ROADS) {
    for (const ry of H_ROADS) {
      for (let s = -36; s <= 36; s += 18) {
        ctx.fillRect(rx + s - 5, ry - WORLD.roadHalf - 8, 10, 6);
        ctx.fillRect(rx + s - 5, ry + WORLD.roadHalf + 2, 10, 6);
      }
    }
  }

  // Buildings: shadow first (offset by height tier), then walls, then roof.
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    const lift = b.heightTier * 9;
    ctx.fillStyle = 'rgba(20,24,20,0.30)';
    ctx.fillRect(b.x + lift, b.y + lift, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    const inset = 5 + b.heightTier * 2;
    ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
    // Roof furniture: a vent block and an edge highlight.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + b.w * 0.62, b.y + b.h * 0.2, b.w * 0.2, b.h * 0.18);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, 3);
    // Windows: small lit/unlit squares seeded per building.
    const stepX = b.w / b.windowsAcross;
    const stepY = b.h / b.windowsDown;
    for (let ix = 0; ix < b.windowsAcross; ix++) {
      for (let iy = 0; iy < b.windowsDown; iy++) {
        const hsh = ((b.seed >> ((ix * 7 + iy * 13) % 24)) & 3);
        ctx.fillStyle = hsh === 0 ? 'rgba(255,214,120,0.75)' : 'rgba(30,40,52,0.45)';
        const ww = Math.max(3, stepX * 0.42);
        const wh = Math.max(3, stepY * 0.42);
        ctx.fillRect(b.x + inset + ix * stepX + (stepX - ww) / 2, b.y + inset + iy * stepY + (stepY - wh) / 2, ww, wh);
      }
    }
  }

  // Props: lamps (pole + glow dot), crates, trees.
  for (const p of city.props) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    if (p.kind === 'lamp') {
      ctx.fillStyle = '#2c2c30';
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.fillStyle = 'rgba(255,220,130,0.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'crate') {
      ctx.fillStyle = '#8a6b42';
      ctx.fillRect(p.x - 7, p.y - 7, 14, 14);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(p.x - 7, p.y - 7, 14, 14);
    } else if (p.kind === 'tree') {
      ctx.fillStyle = 'rgba(20,30,18,0.30)';
      ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 6, 15, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f6d35';
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#548544';
      ctx.beginPath(); ctx.arc(p.x - 4, p.y - 4, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8452c';
      ctx.beginPath(); ctx.arc(p.x + 4, p.y + 3, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// District name painted on the ground at each district heart — reads in
// screenshots and teaches the map without a legend.
export function drawDistrictLabels(ctx, cam) {
  ctx.save();
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) {
    const cx = d.x + d.w / 2;
    const cy = d.y + d.h / 2;
    if (Math.abs(cx - cam.x) > 1500 || Math.abs(cy - cam.y) > 1100) continue;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillText(d.name.toUpperCase(), cx, cy);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillText(d.tag, cx, cy + 30);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// THE CAR. Drawn in a local frame: +x is the car's nose. Layers, back to
// front: ellipse shadow, four wheels, lower body, hood, trunk, glass cabin,
// roof panel, details (lights, grille, mirrors), and for police a light
// bar. Because everything is positioned from len/wid, the drawing is right
// at every heading — the wheels never detach from the corners.
// ---------------------------------------------------------------------------
export function drawCar(ctx, car, time) {
  const len = car.len;
  const wid = car.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Ground shadow: a soft ellipse slightly behind the body.
  ctx.fillStyle = 'rgba(12,14,16,0.38)';
  ctx.beginPath();
  ctx.ellipse(3, 5, len * 0.58, wid * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();

  // Four wheels at the corners — dark tyres with a hub dot. Drawn before
  // the body so the body overlaps their inner halves like real wheel arches.
  const wheelX = len * 0.32;
  const wheelY = wid * 0.5;
  const wheelLen = len * 0.20;
  const wheelWid = 7;
  ctx.fillStyle = '#14161a';
  const steer = car.steerVisual || 0;
  for (const sx of [-wheelX, wheelX]) {
    for (const sy of [-wheelY, wheelY]) {
      ctx.save();
      ctx.translate(sx, sy);
      if (sx > 0) ctx.rotate(steer); // front wheels show the steering angle
      roundRect(ctx, -wheelLen / 2, -wheelWid / 2, wheelLen, wheelWid, 3);
      ctx.fill();
      ctx.fillStyle = '#6d7278';
      ctx.beginPath(); ctx.arc(0, 0, 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#14161a';
      ctx.restore();
    }
  }

  // Lower body: the full silhouette, slightly darker paint.
  ctx.fillStyle = shade(car.color, -28);
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 8);
  ctx.fill();

  // Main body panel in the car's paint.
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2 + 2, -wid / 2 + 2, len - 4, wid - 4, 7);
  ctx.fill();

  // Hood (front third, lighter) and trunk (rear fifth, darker).
  ctx.fillStyle = shade(car.color, 26);
  roundRect(ctx, len * 0.16, -wid / 2 + 4, len * 0.30, wid - 8, 5);
  ctx.fill();
  ctx.fillStyle = shade(car.color, -14);
  roundRect(ctx, -len / 2 + 4, -wid / 2 + 4, len * 0.20, wid - 8, 5);
  ctx.fill();

  // Cabin: dark tinted glass wrapping a roof panel.
  ctx.fillStyle = '#1b2531';
  roundRect(ctx, -len * 0.20, -wid / 2 + 4, len * 0.36, wid - 8, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,200,230,0.35)';
  roundRect(ctx, len * 0.06, -wid / 2 + 5, len * 0.09, wid - 10, 4); // windshield sheen
  ctx.fill();
  ctx.fillStyle = shade(car.color, 8);
  roundRect(ctx, -len * 0.13, -wid / 2 + 7, len * 0.20, wid - 14, 4); // roof
  ctx.fill();

  // Taxi sign / cargo rails for flavour by kind.
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#f2d13c';
    ctx.fillRect(-len * 0.06, -5, len * 0.12, 10);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2.5);
  }
  if (car.kind === 'van') {
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(-len * 0.42, -wid / 2 + 5, len * 0.16, wid - 10);
  }

  // Headlights, tail lights, grille.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 4, 3, 6);
  ctx.fillRect(len / 2 - 3, wid / 2 - 10, 3, 6);
  ctx.fillStyle = '#d23b2e';
  ctx.fillRect(-len / 2, -wid / 2 + 4, 3, 6);
  ctx.fillRect(-len / 2, wid / 2 - 10, 3, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(len / 2 - 5, -6, 2.5, 12);

  // Damage smoke puff when the car is wrecked.
  if (car.health !== undefined && car.health < 35) {
    const puff = 6 + Math.sin(time * 6 + car.x) * 2;
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath(); ctx.arc(len * 0.3, 0, puff, 0, Math.PI * 2); ctx.fill();
  }

  // Police livery + flashing light bar.
  if (car.kind === 'police') {
    ctx.fillStyle = '#eef1f4';
    roundRect(ctx, -len * 0.18, -wid / 2 + 2, len * 0.34, wid - 4, 5);
    ctx.fill();
    ctx.fillStyle = '#20304a';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EKPD', -len * 0.01, 3);
    const flash = Math.floor(time * 5 + (car.flashPhase || 0)) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#5a1610';
    roundRect(ctx, -len * 0.10, -wid / 2 + 3, len * 0.09, 6, 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#274bff' : '#101f5a';
    roundRect(ctx, len * 0.01, -wid / 2 + 3, len * 0.09, 6, 2);
    ctx.fill();
    ctx.fillStyle = flash ? 'rgba(255,80,60,0.30)' : 'rgba(70,110,255,0.30)';
    ctx.beginPath(); ctx.arc(0, 0, len * 0.62, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();

  // Driver hint: a tiny head visible when the player is inside.
  if (car.occupied) {
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(car.x, car.y, 4.5, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// People: pedestrians and the player share a body plan — shadow, legs that
// scissor while walking, torso in a coloured top, head. The player gets a
// distinctive ember-orange jacket so screenshots always find the hero.
// ---------------------------------------------------------------------------
export function drawPerson(ctx, p, time, isPlayer) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(12,14,16,0.35)';
  ctx.beginPath(); ctx.ellipse(1, 3, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  const walkPhase = p.moving ? Math.sin(time * 11 + (p.phase || 0)) * 4 : 0;
  ctx.rotate(p.angle + Math.PI / 2);
  ctx.fillStyle = '#2e3138'; // legs
  ctx.fillRect(-4.5 + walkPhase * 0.4, 1, 3.6, 8);
  ctx.fillRect(1 - walkPhase * 0.4, 1, 3.6, 8);
  ctx.fillStyle = isPlayer ? '#e8641e' : p.shirt;
  roundRect(ctx, -6, -6, 12, 10, 4);
  ctx.fill();
  if (isPlayer) {
    ctx.fillStyle = '#ffd23c';
    ctx.fillRect(-6, -1.5, 12, 3); // ember stripe across the jacket
  }
  ctx.fillStyle = p.skin || '#d9a066';
  ctx.beginPath(); ctx.arc(0, -8.5, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.hair || '#2a2118';
  ctx.beginPath(); ctx.arc(0, -10, 4.4, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (isPlayer) {
    // Soft hero ring so the player is findable in busy scenes.
    ctx.strokeStyle = 'rgba(255,210,60,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 15 + Math.sin(time * 3) * 1.5, 0, Math.PI * 2); ctx.stroke();
  }
}

// Objective marker: a pulsing gold beacon with a floating chevron and a
// light column, visible from far away and unmistakable in screenshots.
export function drawMarker(ctx, x, y, time, label) {
  const bob = Math.sin(time * 3.2) * 6;
  ctx.fillStyle = 'rgba(255,205,50,0.16)';
  ctx.fillRect(x - 9, y - 190, 18, 190);
  ctx.strokeStyle = '#ffcd32';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 30 + Math.sin(time * 3.2) * 4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffcd32';
  ctx.beginPath();
  ctx.moveTo(x, y - 58 + bob);
  ctx.lineTo(x - 13, y - 82 + bob);
  ctx.lineTo(x + 13, y - 82 + bob);
  ctx.closePath();
  ctx.fill();
  if (label) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,10,12,0.72)';
    const w = ctx.measureText(label).width + 18;
    roundRect(ctx, x - w / 2, y - 122 + bob, w, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd95e';
    ctx.fillText(label, x, y - 105 + bob);
  }
}

// Combat feedback: a short-lived ring + sparks where a shove/shot landed.
export function drawHitFx(ctx, fx, time) {
  for (const f of fx) {
    const age = time - f.t0;
    if (age < 0 || age > 0.45) continue;
    const k = age / 0.45;
    ctx.strokeStyle = `rgba(255,${Math.floor(190 - 120 * k)},60,${1 - k})`;
    ctx.lineWidth = 3 - 2 * k;
    ctx.beginPath(); ctx.arc(f.x, f.y, 8 + k * 30, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255,230,150,${1 - k})`;
    for (let i = 0; i < 5; i++) {
      const a = f.seed + i * 1.256;
      ctx.fillRect(f.x + Math.cos(a) * (10 + k * 26) - 1.5, f.y + Math.sin(a) * (10 + k * 26) - 1.5, 3, 3);
    }
  }
}

export { roundRect, shade };
