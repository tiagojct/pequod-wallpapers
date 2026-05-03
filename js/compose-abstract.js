// Pequod wallpapers: a Miró-by-way-of-Pequod composition engine.
// Six sub-styles, each producing a rich composed image: a soft
// painterly ground, one or two confident primary forms, and a
// supporting cast of small marks (dots, asterisks, snakes, wedges,
// eyes, bars). All compositions use multiple accent colours when
// available and balance forms around the geometric centre with
// gentle asymmetry.
//
//   mist           ground only (most minimal)
//   field          three Rothko bands + one small mark on the focal
//   ripple         centred concentric rings + a few orbital dots
//   constellation  centred biomorphic blob + 5 to 9 marks around it
//   lunar          centred crescent + companion dot + a few stars
//   gesture        large sinuous snake-curve + scattered marks
//   signs          a balanced grid of asterisks + small companions

import {
  pickSurface,
  pickAccents,
  crewHex,
  rgba,
} from "./palette.js";

const SUBSTYLES = [
  "mist",
  "field",
  "ripple",
  "constellation",
  "lunar",
  "gesture",
  "signs",
];

const MARK_TYPES = [
  "dot",
  "asterisk",
  "snake",
  "wedge",
  "eye",
  "smallring",
  "bar",
];

export function composeAbstract(p, rng, state, vp) {
  const substyle = rng.pick(SUBSTYLES);
  const surface = pickSurface(p, rng, state.theme);
  const accents = pickAccents(rng, state.accentCount, state.accents);

  const palette = {
    surface,
    accents: accents.map((name) => ({
      name,
      hex: crewHex(p, name, state.theme),
    })),
    inkHex: state.theme === "light" ? p.log["800"] : p.log["100"],
    paperHex: state.theme === "light" ? p.log["50"] : p.log["950"],
  };

  const layout = renderSubstyle(p, rng, state, substyle, palette, vp);

  return {
    substyle,
    surface,
    palette,
    shapes: layout.shapes || [],
    gradients: layout.gradients || [],
    grain: layout.grain ?? defaultGrain(rng),
    vignette: layout.vignette ?? defaultVignette(state.theme),
  };
}

function renderSubstyle(p, rng, state, substyle, palette, vp) {
  switch (substyle) {
    case "mist":
      return renderMist(p, rng, state, palette, vp);
    case "field":
      return renderField(p, rng, state, palette, vp);
    case "ripple":
      return renderRipple(p, rng, state, palette, vp);
    case "constellation":
      return renderConstellation(p, rng, state, palette, vp);
    case "lunar":
      return renderLunar(p, rng, state, palette, vp);
    case "gesture":
      return renderGesture(p, rng, state, palette, vp);
    case "signs":
      return renderSigns(p, rng, state, palette, vp);
    default:
      return { shapes: [] };
  }
}

// ── mist ────────────────────────────────────────────────────────────
function renderMist(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "radial", weight: 5 },
    { value: "vertical", weight: 2 },
    { value: "diagonal", weight: 1 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  // 30% chance of a single soft accent stain at the centre.
  if (rng.next() > 0.7 && palette.accents.length > 0) {
    const accent = rng.pick(palette.accents);
    const r = rng.range(0.22, 0.4) * Math.min(vp.w, vp.h);
    shapes.push({
      type: "circle",
      cx: vp.w / 2,
      cy: vp.h / 2,
      r,
      fill: rgba(accent.hex, rng.range(0.18, 0.32)),
      blend: "multiply",
      blur: r * 0.5,
    });
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.1) },
  };
}

// ── field ───────────────────────────────────────────────────────────
function renderField(p, rng, state, palette, vp) {
  const swatches = swatchPool(p, palette, state.theme);
  const accentHex = palette.accents[0]?.hex || swatches[0];

  const upperHex = swatches[rng.int(0, swatches.length - 1)];
  const lowerHex = swatches[rng.int(0, swatches.length - 1)];

  const upperH = rng.range(0.26, 0.36) * vp.h;
  const focalH = rng.range(0.14, 0.22) * vp.h;
  const gap1 = rng.range(0.04, 0.08) * vp.h;
  const gap2 = rng.range(0.04, 0.08) * vp.h;

  let cursor = rng.range(0.06, 0.14) * vp.h;
  const shapes = [];
  shapes.push(featherRect(vp, cursor, upperH, upperHex));
  cursor += upperH + gap1;
  const focalY = cursor;
  shapes.push(featherRect(vp, cursor, focalH, accentHex));
  cursor += focalH + gap2;
  const lowerH = Math.max(0.18 * vp.h, vp.h - cursor - 0.05 * vp.h);
  shapes.push(featherRect(vp, cursor, lowerH, lowerHex));

  // A single small mark on the focal band, off-centre to add tension.
  const markX = (rng.next() > 0.5 ? 0.32 : 0.68) * vp.w;
  const markY = focalY + focalH / 2;
  pushMark(shapes, "asterisk", markX, markY, 0.04 * Math.min(vp.w, vp.h), palette.inkHex, rng);

  return {
    shapes,
    grain: { intensity: 0.12, freq: rng.range(0.8, 1.0) },
  };
}

// ── ripple ──────────────────────────────────────────────────────────
function renderRipple(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const baseGrad = buildGradient("g-base", "radial", ramp, vp, rng);
  baseGrad.cx = vp.w / 2;
  baseGrad.cy = vp.h / 2;
  baseGrad.r = Math.max(vp.w, vp.h) * 0.95;

  const shapes = [baseRect(vp, `url(#${baseGrad.id})`)];

  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const accent = palette.accents[0]?.hex;
  const swatches = swatchPool(p, palette, state.theme);
  const minDim = Math.min(vp.w, vp.h);
  const layers = rng.int(7, 12);
  const maxR = rng.range(0.7, 1.05) * minDim;

  for (let i = layers - 1; i >= 0; i--) {
    const t = i / (layers - 1);
    const r = maxR * (0.18 + 0.82 * t);
    const isAccent = i === Math.floor(layers / 2) && accent;
    const hex = isAccent ? accent : swatches[i % swatches.length];
    const op = isAccent ? 0.45 : rng.range(0.16, 0.28);
    shapes.push({
      type: "circle",
      cx,
      cy,
      r,
      fill: rgba(hex, op),
      blend: "multiply",
      blur: r * 0.04,
    });
  }

  // 4-6 small dots on a ring around the centre.
  const orbitR = maxR * rng.range(0.55, 0.7);
  const orbitCount = rng.int(4, 6);
  const accentPool = palette.accents.length > 0
    ? palette.accents.map((a) => a.hex)
    : [palette.inkHex];
  for (let i = 0; i < orbitCount; i++) {
    const angle = (i / orbitCount) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const dx = cx + Math.cos(angle) * orbitR;
    const dy = cy + Math.sin(angle) * orbitR;
    pushMark(shapes, rng.weighted([
      { value: "dot", weight: 4 },
      { value: "asterisk", weight: 2 },
    ]), dx, dy, rng.range(0.018, 0.03) * minDim, rng.pick(accentPool), rng);
  }

  return {
    shapes,
    gradients: [baseGrad],
    grain: { intensity: 0.08, freq: rng.range(0.85, 1.0) },
  };
}

// ── constellation ───────────────────────────────────────────────────
function renderConstellation(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "radial", weight: 4 },
    { value: "vertical", weight: 2 },
    { value: "diagonal", weight: 1 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const cx = vp.w / 2 + rng.range(-0.06, 0.06) * vp.w;
  const cy = vp.h / 2 + rng.range(-0.06, 0.06) * vp.h;
  const minDim = Math.min(vp.w, vp.h);
  const blobR = rng.range(0.22, 0.32) * minDim;

  // Primary blob — usually ink, sometimes accent for boldness.
  const blobHex = rng.next() > 0.7 && palette.accents.length > 0
    ? palette.accents[0].hex
    : palette.inkHex;
  shapes.push({
    type: "path",
    d: buildBlobPath(cx, cy, blobR, rng, rng.int(7, 9)),
    fill: blobHex,
  });

  // Inner highlight: a small lighter shape inside the blob.
  if (rng.next() > 0.4) {
    const innerR = blobR * rng.range(0.18, 0.32);
    const innerCx = cx + rng.range(-0.3, 0.3) * blobR;
    const innerCy = cy + rng.range(-0.3, 0.3) * blobR;
    const innerHex = rng.pick(palette.accents.length > 0
      ? palette.accents.map((a) => a.hex)
      : [palette.paperHex]);
    shapes.push({
      type: "circle",
      cx: innerCx,
      cy: innerCy,
      r: innerR,
      fill: innerHex,
    });
  }

  // 5 to 9 marks of varied types around the blob.
  const markCount = rng.int(5, 9);
  scatterMarks(shapes, rng, palette, markCount, vp, { cx, cy, blobR }, MARK_TYPES);

  // Optional large gesture line crossing through.
  if (rng.next() > 0.55) {
    pushSnake(shapes, vp, rng, palette.inkHex, 1.0, 0.0035 * minDim);
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
  };
}

// ── lunar ───────────────────────────────────────────────────────────
function renderLunar(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const grad = buildGradient("g-base", "radial", ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const minDim = Math.min(vp.w, vp.h);
  const outerR = rng.range(0.2, 0.3) * minDim;
  const innerR = outerR * rng.range(0.85, 0.95);
  const offsetSign = rng.next() > 0.5 ? 1 : -1;
  const offset = outerR * rng.range(0.32, 0.5) * offsetSign;

  const crescentHex = rng.next() > 0.7 && palette.accents.length > 0
    ? palette.accents[0].hex
    : palette.inkHex;
  shapes.push({ type: "circle", cx, cy, r: outerR, fill: crescentHex });
  shapes.push({
    type: "circle",
    cx: cx + offset,
    cy,
    r: innerR,
    fill: palette.paperHex,
  });

  // Companion dot opposite the crescent's open side.
  const companionAngle = offsetSign > 0 ? Math.PI : 0;
  const companionDist = outerR * 1.9;
  const companionR = rng.range(0.022, 0.038) * minDim;
  const companionHex = palette.accents[0]?.hex || crescentHex;
  shapes.push({
    type: "circle",
    cx: cx + Math.cos(companionAngle) * companionDist,
    cy: cy + Math.sin(companionAngle) * companionDist,
    r: companionR,
    fill: companionHex,
  });

  // 3 to 5 stars (asterisks) elsewhere on the canvas.
  const starCount = rng.int(3, 5);
  const accentPool = palette.accents.length > 0
    ? palette.accents.map((a) => a.hex)
    : [palette.inkHex];
  const starPositions = arrangeAround(cx, cy, outerR * 2.6, starCount, rng, vp);
  for (const pos of starPositions) {
    pushMark(
      shapes,
      "asterisk",
      pos.x,
      pos.y,
      rng.range(0.025, 0.045) * minDim,
      rng.pick([palette.inkHex, ...accentPool]),
      rng,
    );
  }

  // Optional small wedge or eye for character.
  if (rng.next() > 0.5) {
    const extra = rng.weighted([
      { value: "wedge", weight: 2 },
      { value: "eye", weight: 1 },
    ]);
    const angle = rng.range(0, Math.PI * 2);
    const dist = outerR * rng.range(2.5, 3.2);
    pushMark(
      shapes,
      extra,
      cx + Math.cos(angle) * dist,
      cy + Math.sin(angle) * dist,
      rng.range(0.04, 0.07) * minDim,
      rng.pick(accentPool),
      rng,
    );
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
    vignette: { intensity: state.theme === "light" ? 0.16 : 0.24 },
  };
}

// ── gesture ─────────────────────────────────────────────────────────
// One large sinuous snake curve crossing the canvas as a hero
// gesture, with 3 to 6 small marks in supporting positions.
function renderGesture(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "vertical", weight: 3 },
    { value: "diagonal", weight: 2 },
    { value: "radial", weight: 1 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const minDim = Math.min(vp.w, vp.h);
  const snakeHex = rng.next() > 0.4 && palette.accents.length > 0
    ? palette.accents[0].hex
    : palette.inkHex;
  pushSnake(shapes, vp, rng, snakeHex, 1.0, 0.012 * minDim);

  // 3 to 6 supporting marks scattered, mostly at margins.
  const markCount = rng.int(3, 6);
  const accentPool = palette.accents.length > 0
    ? palette.accents.map((a) => a.hex)
    : [palette.inkHex];
  const positions = arrangeFreeform(rng, markCount, vp, minDim * 0.18);
  for (const pos of positions) {
    const t = rng.weighted([
      { value: "dot", weight: 3 },
      { value: "asterisk", weight: 3 },
      { value: "wedge", weight: 1 },
      { value: "smallring", weight: 1 },
    ]);
    pushMark(
      shapes,
      t,
      pos.x,
      pos.y,
      rng.range(0.025, 0.05) * minDim,
      rng.pick([palette.inkHex, ...accentPool]),
      rng,
    );
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
  };
}

// ── signs ───────────────────────────────────────────────────────────
function renderSigns(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "vertical", weight: 3 },
    { value: "radial", weight: 2 },
    { value: "diagonal", weight: 1 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const minDim = Math.min(vp.w, vp.h);
  const accentPool = palette.accents.length > 0
    ? palette.accents.map((a) => a.hex)
    : [palette.inkHex];

  // A balanced sign field: a centre asterisk plus four to six in a
  // symmetric arrangement, plus one or two small companion forms
  // (eye, wedge, smallring) for character.
  const positions = [{ cx: 0.5, cy: 0.5, accent: true, primary: true }];
  const layout = rng.weighted([
    { value: "diagonal", weight: 3 },
    { value: "cardinal", weight: 2 },
    { value: "scatter", weight: 2 },
  ]);
  if (layout === "diagonal") {
    positions.push(
      { cx: 0.25, cy: 0.25 },
      { cx: 0.75, cy: 0.25 },
      { cx: 0.25, cy: 0.75 },
      { cx: 0.75, cy: 0.75 },
    );
  } else if (layout === "cardinal") {
    positions.push(
      { cx: 0.5, cy: 0.18 },
      { cx: 0.5, cy: 0.82 },
      { cx: 0.18, cy: 0.5 },
      { cx: 0.82, cy: 0.5 },
    );
  } else {
    positions.push(
      { cx: 1 / 3, cy: 1 / 3 },
      { cx: 2 / 3, cy: 2 / 3 },
      { cx: 1 / 3, cy: 2 / 3 },
      { cx: 2 / 3, cy: 1 / 3 },
    );
  }
  if (rng.next() > 0.5 && positions.length > 3) {
    positions.splice(rng.int(1, positions.length - 1), 1);
  }

  for (const pos of positions) {
    const x = pos.cx * vp.w;
    const y = pos.cy * vp.h;
    const t = pos.primary
      ? "asterisk"
      : rng.weighted([
          { value: "asterisk", weight: 5 },
          { value: "dot", weight: 2 },
          { value: "wedge", weight: 1 },
        ]);
    const size = (pos.primary ? rng.range(0.07, 0.1) : rng.range(0.04, 0.065)) * minDim;
    const hex = pos.accent ? rng.pick(accentPool) : palette.inkHex;
    pushMark(shapes, t, x, y, size, hex, rng);
  }

  // 1 to 2 small extra characters (eye or smallring) for surprise.
  const extras = rng.int(1, 2);
  for (let i = 0; i < extras; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(0.25, 0.4) * Math.min(vp.w, vp.h);
    const x = vp.w / 2 + Math.cos(angle) * dist;
    const y = vp.h / 2 + Math.sin(angle) * dist;
    const t = rng.weighted([
      { value: "eye", weight: 2 },
      { value: "smallring", weight: 2 },
      { value: "bar", weight: 1 },
    ]);
    pushMark(
      shapes,
      t,
      x,
      y,
      rng.range(0.04, 0.07) * minDim,
      rng.pick(accentPool),
      rng,
    );
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
  };
}

// ── mark builder ────────────────────────────────────────────────────

function pushMark(shapes, type, x, y, size, fill, rng) {
  const minStroke = size * 0.08;
  switch (type) {
    case "dot":
      shapes.push({ type: "circle", cx: x, cy: y, r: size * 0.5, fill });
      break;
    case "asterisk": {
      const rays = rng.int(4, 6);
      shapes.push({
        type: "path",
        d: buildAsteriskPath(x, y, size, rays),
        fill: "none",
        stroke: fill,
        strokeWidth: minStroke,
      });
      shapes.push({ type: "circle", cx: x, cy: y, r: size * 0.06, fill });
      break;
    }
    case "snake":
      shapes.push({
        type: "path",
        d: buildSnakePath(x, y, size, rng),
        fill: "none",
        stroke: fill,
        strokeWidth: minStroke,
      });
      break;
    case "wedge": {
      const rot = rng.range(0, Math.PI * 2);
      const half = size * 0.5;
      const points = [
        [x + Math.cos(rot) * half, y + Math.sin(rot) * half],
        [
          x + Math.cos(rot + (2 * Math.PI) / 3) * half,
          y + Math.sin(rot + (2 * Math.PI) / 3) * half,
        ],
        [
          x + Math.cos(rot + (4 * Math.PI) / 3) * half,
          y + Math.sin(rot + (4 * Math.PI) / 3) * half,
        ],
      ];
      shapes.push({ type: "polygon", points, fill });
      break;
    }
    case "eye": {
      const rx = size * 0.5;
      const ry = size * 0.28;
      const rot = rng.next() > 0.5 ? 0 : 90;
      shapes.push({
        type: "path",
        d: buildEllipsePath(x, y, rx, ry, rot),
        fill,
      });
      shapes.push({
        type: "circle",
        cx: x,
        cy: y,
        r: ry * 0.5,
        fill: fill === "#0D2F42" ? "#EAE1D7" : "#0D2F42",
        fillOpacity: 0.85,
      });
      break;
    }
    case "smallring":
      shapes.push({
        type: "ring",
        cx: x,
        cy: y,
        r: size * 0.5,
        stroke: fill,
        strokeWidth: minStroke,
      });
      break;
    case "bar": {
      const angle = rng.range(0, Math.PI);
      const len = size;
      const w = size * 0.18;
      const dx = Math.cos(angle) * len * 0.5;
      const dy = Math.sin(angle) * len * 0.5;
      shapes.push({
        type: "line",
        x1: x - dx,
        y1: y - dy,
        x2: x + dx,
        y2: y + dy,
        stroke: fill,
        strokeWidth: w,
      });
      break;
    }
  }
}

function pushSnake(shapes, vp, rng, hex, lengthFactor, strokeW) {
  shapes.push({
    type: "path",
    d: buildLargeSnakePath(vp, rng, lengthFactor),
    fill: "none",
    stroke: hex,
    strokeWidth: strokeW,
  });
}

// ── path builders ───────────────────────────────────────────────────

function buildBlobPath(cx, cy, baseR, rng, sides = 8) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const r = baseR * (0.7 + rng.next() * 0.5);
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < sides; i++) {
    const p0 = points[(i - 1 + sides) % sides];
    const p1 = points[i];
    const p2 = points[(i + 1) % sides];
    const p3 = points[(i + 2) % sides];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + " Z";
}

function buildAsteriskPath(cx, cy, size, rays) {
  let d = "";
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI;
    const dx = (Math.cos(angle) * size) / 2;
    const dy = (Math.sin(angle) * size) / 2;
    d += `M ${(cx - dx).toFixed(2)} ${(cy - dy).toFixed(2)} L ${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)} `;
  }
  return d.trim();
}

// A small sinuous curve ~size wide, rotated by a random angle. Used
// for "snake" marks in scatter contexts.
function buildSnakePath(cx, cy, size, rng) {
  const half = size * 0.5;
  const angle = rng.range(0, Math.PI * 2);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  // Local: start at -half, end at +half, with sinusoidal wave on y.
  const points = [
    [-half, 0],
    [-half * 0.5, -size * 0.25],
    [0, size * 0.18],
    [half * 0.5, -size * 0.18],
    [half, 0],
  ];
  // Rotate and translate.
  const rotated = points.map(([x, y]) => [cx + x * cosA - y * sinA, cy + x * sinA + y * cosA]);
  // Build a smooth bezier through them.
  let d = `M ${rotated[0][0].toFixed(2)} ${rotated[0][1].toFixed(2)}`;
  for (let i = 0; i < rotated.length - 1; i++) {
    const p0 = rotated[Math.max(0, i - 1)];
    const p1 = rotated[i];
    const p2 = rotated[i + 1];
    const p3 = rotated[Math.min(rotated.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 4;
    const c1y = p1[1] + (p2[1] - p0[1]) / 4;
    const c2x = p2[0] - (p3[0] - p1[0]) / 4;
    const c2y = p2[1] - (p3[1] - p1[1]) / 4;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

// A long sinuous curve crossing the canvas. Used as a hero gesture.
function buildLargeSnakePath(vp, rng, lengthFactor = 1.0) {
  // Pick a primary direction (mostly horizontal or vertical).
  const horizontal = rng.next() > 0.4;
  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const span = (horizontal ? vp.w : vp.h) * lengthFactor;
  const amp = (horizontal ? vp.h : vp.w) * 0.18 * (rng.next() > 0.5 ? 1 : -1);
  const segments = 4;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = (t - 0.5) * span;
    const v = Math.sin(t * Math.PI * 2) * amp;
    if (horizontal) points.push([cx + u, cy + v]);
    else points.push([cx + v, cy + u]);
  }
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 4;
    const c1y = p1[1] + (p2[1] - p0[1]) / 4;
    const c2x = p2[0] - (p3[0] - p1[0]) / 4;
    const c2y = p2[1] - (p3[1] - p1[1]) / 4;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

function buildEllipsePath(cx, cy, rx, ry, rotDeg) {
  const r = (rotDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const x1 = cx - rx * c;
  const y1 = cy - rx * s;
  const x2 = cx + rx * c;
  const y2 = cy + rx * s;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} ${rotDeg} 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} ${rotDeg} 0 0 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

// ── arrangement helpers ────────────────────────────────────────────

function arrangeAround(cx, cy, radius, count, rng, vp) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rng.range(-0.25, 0.25);
    const r = radius * rng.range(0.85, 1.2);
    out.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }
  return out;
}

function scatterMarks(shapes, rng, palette, count, vp, primary, types) {
  const minDim = Math.min(vp.w, vp.h);
  const accentPool = palette.accents.length > 0
    ? palette.accents.map((a) => a.hex)
    : [palette.inkHex];
  const colorPool = [palette.inkHex, ...accentPool];

  const placed = [];
  for (let i = 0; i < count; i++) {
    let tries = 0;
    let pos = null;
    while (tries < 12 && !pos) {
      const angle = rng.range(0, Math.PI * 2);
      const dist = primary.blobR * rng.range(1.5, 2.6);
      const x = primary.cx + Math.cos(angle) * dist;
      const y = primary.cy + Math.sin(angle) * dist;
      const margin = minDim * 0.05;
      if (x < margin || x > vp.w - margin || y < margin || y > vp.h - margin) {
        tries++;
        continue;
      }
      // Avoid clustering with previous marks.
      const tooClose = placed.some(
        (q) => Math.hypot(q.x - x, q.y - y) < minDim * 0.07,
      );
      if (tooClose) {
        tries++;
        continue;
      }
      pos = { x, y };
    }
    if (!pos) continue;
    placed.push(pos);

    const type = rng.pick(types);
    const baseSize = type === "snake" || type === "eye" ? rng.range(0.05, 0.085) : rng.range(0.025, 0.05);
    pushMark(shapes, type, pos.x, pos.y, baseSize * minDim, rng.pick(colorPool), rng);
  }
}

function arrangeFreeform(rng, count, vp, minSpacing) {
  const out = [];
  let tries = 0;
  while (out.length < count && tries < 200) {
    tries++;
    const x = rng.range(0.1, 0.9) * vp.w;
    const y = rng.range(0.1, 0.9) * vp.h;
    const tooClose = out.some((p) => Math.hypot(p.x - x, p.y - y) < minSpacing);
    if (!tooClose) out.push({ x, y });
  }
  return out;
}

// ── ramps and gradients ─────────────────────────────────────────────

export function buildPaperRamp(p, theme, rng) {
  const log = p.log;
  const lightSteps = ["50", "100", "150", "200", "300", "400", "500"];
  const darkSteps = ["950", "900", "800", "700", "600", "500", "400"];
  const steps = theme === "light" ? lightSteps : darkSteps;
  const offsetCurve = [0, 0.14, 0.3, 0.48, 0.66, 0.83, 1.0];
  const stops = steps.map((step, i) => ({
    offset: clamp(offsetCurve[i] + rng.range(-0.02, 0.02), 0, 1),
    color: log[step],
  }));
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].offset <= stops[i - 1].offset) {
      stops[i].offset = Math.min(1, stops[i - 1].offset + 0.005);
    }
  }
  return stops;
}

export function buildGradient(id, direction, stops, vp, rng) {
  if (direction === "radial") {
    return {
      id,
      type: "radial",
      cx: vp.w / 2,
      cy: vp.h / 2,
      r: Math.max(vp.w, vp.h) * rng.range(0.85, 1.15),
      stops,
    };
  }
  let x1 = 0, y1 = 0, x2 = vp.w, y2 = vp.h;
  if (direction === "vertical") {
    x1 = vp.w / 2; y1 = 0; x2 = vp.w / 2; y2 = vp.h;
  } else if (direction === "horizontal") {
    x1 = 0; y1 = vp.h / 2; x2 = vp.w; y2 = vp.h / 2;
  } else {
    const flipX = rng.next() > 0.5;
    const flipY = rng.next() > 0.5;
    x1 = flipX ? vp.w : 0;
    y1 = flipY ? vp.h : 0;
    x2 = flipX ? 0 : vp.w;
    y2 = flipY ? 0 : vp.h;
  }
  return { id, type: "linear", x1, y1, x2, y2, stops };
}

// ── helpers ─────────────────────────────────────────────────────────

function baseRect(vp, fill) {
  return { type: "rect", x: 0, y: 0, w: vp.w, h: vp.h, fill };
}

function featherRect(vp, y, h, fill) {
  return {
    type: "rect",
    x: -0.06 * vp.w,
    y,
    w: 1.12 * vp.w,
    h,
    fill,
    feather: 1,
  };
}

function defaultGrain(rng) {
  return { intensity: 0.1, freq: rng.range(0.8, 1.05) };
}

function defaultVignette(theme) {
  return { intensity: theme === "light" ? 0.12 : 0.18 };
}

function swatchPool(p, palette, theme) {
  const log = p.log;
  const lightFg = ["200", "300", "400", "500"].map((s) => log[s]);
  const darkFg = ["600", "700", "800"].map((s) => log[s]);
  return [
    ...(theme === "light" ? lightFg : darkFg),
    ...palette.accents.map((a) => a.hex),
  ];
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
