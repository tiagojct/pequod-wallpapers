// Builds an SVG element from a composition descriptor. Layered in
// strict order so each composition reads as one image, not a stack of
// flats:
//
//   1. base surface fill (in case shapes do not cover everything)
//   2. <defs>: filters (grain, soft-blur, feather) and
//      gradients declared by the composition
//   3. shape group: composition.shapes (gradients-as-fills, blends,
//      blurs, feathered bands)
//   4. paper-grain wash (turbulence noise, multiply blend, low alpha)
//   5. vignette (radial gradient overlay, very subtle)

import { rgba, cyrb53OrZero } from "./palette.js";

// Long axis = 1000, short axis scaled to aspect.
export function viewportFor(aspectW, aspectH) {
  if (aspectW >= aspectH) {
    return { w: 1000, h: (1000 * aspectH) / aspectW };
  }
  return { w: (1000 * aspectW) / aspectH, h: 1000 };
}

export function buildSVG(composition, options) {
  const { aspectW, aspectH, watermark, seed } = options;
  const NS = "http://www.w3.org/2000/svg";
  const { w: vbW, h: vbH } = viewportFor(aspectW, aspectH);

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("xmlns", NS);
  svg.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const defs = document.createElementNS(NS, "defs");

  // Feather: a strong gaussian for Rothko-style band edges. The blur
  // amount scales with the viewport so the look is consistent across
  // aspects.
  const featherStd = Math.max(8, Math.min(vbW, vbH) * 0.024);
  defs.appendChild(makeFilter(NS, "feather", -0.15, 1.3, [
    feGaussianBlur(NS, featherStd),
  ]));

  // Soft-blur: a gentle blur for shapes that should feel like ink
  // stains rather than vector primitives.
  defs.appendChild(makeFilter(NS, "soft-blur", -0.25, 1.5, [
    feGaussianBlur(NS, Math.max(4, Math.min(vbW, vbH) * 0.012)),
  ]));

  // Per-shape blur: each shape that requests its own blur radius gets
  // a unique filter so blurs do not interact.

  // Grain: a turbulence-based noise wash. Seed is derived from the
  // composition seed so the texture varies between regenerations but
  // is stable for a given seed.
  const noiseSeed = (cyrb53OrZero(seed || "") % 1000) >>> 0;
  const grainConfig = composition.grain || { intensity: 0.1, freq: 0.95 };
  defs.appendChild(buildGrainFilter(NS, "grain", noiseSeed, grainConfig.freq));

  // Per-shape blur filters and gradients declared by the composition.
  let blurCounter = 0;
  for (const s of composition.shapes || []) {
    if (s.blur) {
      s.__blurId = `b-${blurCounter++}`;
      defs.appendChild(makeFilter(NS, s.__blurId, -0.4, 1.8, [
        feGaussianBlur(NS, s.blur),
      ]));
    }
  }

  for (const g of composition.gradients || []) {
    defs.appendChild(buildGradientNode(g, NS));
  }

  // Vignette: a radial gradient that is transparent in the centre and
  // dark at the corners. Built per render so the radius matches the
  // viewport.
  const vignetteIntensity = composition.vignette?.intensity ?? 0.14;
  defs.appendChild(buildVignetteGradient(NS, vbW, vbH, vignetteIntensity));

  svg.appendChild(defs);

  // 1. Surface base.
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(vbW));
  bg.setAttribute("height", String(vbH));
  bg.setAttribute("fill", composition.surface.hex);
  svg.appendChild(bg);

  // 3. Shape group.
  const shapeGroup = document.createElementNS(NS, "g");
  for (const s of composition.shapes || []) {
    appendShape(shapeGroup, s, NS);
  }
  svg.appendChild(shapeGroup);

  // 4. Paper-grain wash. Multiply blend so the noise modulates without
  // washing out the colour beneath.
  const grainRect = document.createElementNS(NS, "rect");
  grainRect.setAttribute("x", "0");
  grainRect.setAttribute("y", "0");
  grainRect.setAttribute("width", String(vbW));
  grainRect.setAttribute("height", String(vbH));
  grainRect.setAttribute("filter", "url(#grain)");
  grainRect.setAttribute("opacity", String(grainConfig.intensity));
  grainRect.setAttribute("style", "mix-blend-mode: multiply");
  svg.appendChild(grainRect);

  // 5. Vignette overlay.
  const vignetteRect = document.createElementNS(NS, "rect");
  vignetteRect.setAttribute("x", "0");
  vignetteRect.setAttribute("y", "0");
  vignetteRect.setAttribute("width", String(vbW));
  vignetteRect.setAttribute("height", String(vbH));
  vignetteRect.setAttribute("fill", "url(#g-vignette)");
  vignetteRect.setAttribute("style", "mix-blend-mode: multiply");
  svg.appendChild(vignetteRect);

  // Watermark stays on top of everything.
  if (watermark) {
    const wmText = document.createElementNS(NS, "text");
    wmText.textContent = `pequod-wallpapers . ${seed}`;
    const isLightSurface = isLight(composition.surface.step);
    wmText.setAttribute("fill", rgba(isLightSurface ? "#0D2F42" : "#EAE1D7", 0.5));
    wmText.setAttribute(
      "font-family",
      "JetBrains Mono, ui-monospace, Menlo, monospace",
    );
    const fontSize = Math.max(10, vbW * 0.012);
    wmText.setAttribute("font-size", String(fontSize));
    wmText.setAttribute("text-anchor", "end");
    wmText.setAttribute("x", String(vbW - 14));
    wmText.setAttribute("y", String(vbH - 14));
    svg.appendChild(wmText);
  }

  return { svg, vbW, vbH };
}

function makeFilter(NS, id, padNeg, padFull, children) {
  const filter = document.createElementNS(NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("x", `${padNeg * 100}%`);
  filter.setAttribute("y", `${padNeg * 100}%`);
  filter.setAttribute("width", `${padFull * 100}%`);
  filter.setAttribute("height", `${padFull * 100}%`);
  for (const c of children) filter.appendChild(c);
  return filter;
}

function feGaussianBlur(NS, std) {
  const blur = document.createElementNS(NS, "feGaussianBlur");
  blur.setAttribute("stdDeviation", String(std));
  return blur;
}

function buildGrainFilter(NS, id, seed, freq) {
  const filter = document.createElementNS(NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("x", "0%");
  filter.setAttribute("y", "0%");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");

  const turb = document.createElementNS(NS, "feTurbulence");
  turb.setAttribute("type", "fractalNoise");
  turb.setAttribute("baseFrequency", String(freq));
  turb.setAttribute("numOctaves", "2");
  turb.setAttribute("seed", String(seed));
  turb.setAttribute("stitchTiles", "stitch");
  filter.appendChild(turb);

  // Tint the noise to a warm grey so it reads as paper, not screen
  // static, then desaturate slightly.
  const cm = document.createElementNS(NS, "feColorMatrix");
  cm.setAttribute("type", "matrix");
  // R G B A
  // Push everything toward a warm grey, low overall intensity. The
  // shape-rendering rect carries the opacity and blend mode so this
  // colour matrix only needs to set the tone, not the strength.
  cm.setAttribute("values", [
    "0 0 0 0 0.55",
    "0 0 0 0 0.50",
    "0 0 0 0 0.46",
    "0 0 0 1 0",
  ].join(" "));
  filter.appendChild(cm);

  return filter;
}

function buildVignetteGradient(NS, vbW, vbH, intensity) {
  const grad = document.createElementNS(NS, "radialGradient");
  grad.setAttribute("id", "g-vignette");
  grad.setAttribute("cx", String(vbW / 2));
  grad.setAttribute("cy", String(vbH / 2));
  grad.setAttribute("r", String(Math.max(vbW, vbH) * 0.7));
  grad.setAttribute("gradientUnits", "userSpaceOnUse");
  // Transparent in the centre, multiplied with a soft warm dark at the
  // corners.
  const s1 = document.createElementNS(NS, "stop");
  s1.setAttribute("offset", "0");
  s1.setAttribute("stop-color", "#ffffff");
  s1.setAttribute("stop-opacity", "1");
  grad.appendChild(s1);
  const s2 = document.createElementNS(NS, "stop");
  s2.setAttribute("offset", "0.55");
  s2.setAttribute("stop-color", "#ffffff");
  s2.setAttribute("stop-opacity", "0.95");
  grad.appendChild(s2);
  const s3 = document.createElementNS(NS, "stop");
  s3.setAttribute("offset", "1");
  // Dark warm tone for vignette. Mapping intensity 0..1 to alpha.
  const alpha = clamp(intensity, 0, 0.4);
  s3.setAttribute("stop-color", "#0d1f2a");
  s3.setAttribute("stop-opacity", String(1 - alpha * 1.2));
  grad.appendChild(s3);
  return grad;
}

function buildGradientNode(g, NS) {
  let el;
  if (g.type === "radial") {
    el = document.createElementNS(NS, "radialGradient");
    el.setAttribute("id", g.id);
    el.setAttribute("cx", String(g.cx));
    el.setAttribute("cy", String(g.cy));
    el.setAttribute("r", String(g.r));
    el.setAttribute("gradientUnits", "userSpaceOnUse");
  } else {
    el = document.createElementNS(NS, "linearGradient");
    el.setAttribute("id", g.id);
    el.setAttribute("x1", String(g.x1));
    el.setAttribute("y1", String(g.y1));
    el.setAttribute("x2", String(g.x2));
    el.setAttribute("y2", String(g.y2));
    el.setAttribute("gradientUnits", "userSpaceOnUse");
  }
  for (const s of g.stops) {
    const stop = document.createElementNS(NS, "stop");
    stop.setAttribute("offset", String(s.offset));
    stop.setAttribute("stop-color", s.color);
    if (s.opacity !== undefined) stop.setAttribute("stop-opacity", String(s.opacity));
    el.appendChild(stop);
  }
  return el;
}

function appendShape(parent, s, NS) {
  let el;
  if (s.type === "circle") {
    el = document.createElementNS(NS, "circle");
    el.setAttribute("cx", s.cx);
    el.setAttribute("cy", s.cy);
    el.setAttribute("r", s.r);
    el.setAttribute("fill", s.fill);
  } else if (s.type === "ring") {
    el = document.createElementNS(NS, "circle");
    el.setAttribute("cx", s.cx);
    el.setAttribute("cy", s.cy);
    el.setAttribute("r", s.r);
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", s.stroke);
    el.setAttribute("stroke-width", String(s.strokeWidth));
    if (s.strokeOpacity !== undefined) {
      el.setAttribute("stroke-opacity", String(s.strokeOpacity));
    }
  } else if (s.type === "rect") {
    el = document.createElementNS(NS, "rect");
    el.setAttribute("x", s.x);
    el.setAttribute("y", s.y);
    el.setAttribute("width", s.w);
    el.setAttribute("height", s.h);
    el.setAttribute("fill", s.fill);
    if (s.rx) el.setAttribute("rx", s.rx);
    if (s.feather) el.setAttribute("filter", "url(#feather)");
  } else if (s.type === "polygon") {
    el = document.createElementNS(NS, "polygon");
    el.setAttribute("points", s.points.map((p) => p.join(",")).join(" "));
    el.setAttribute("fill", s.fill);
  } else if (s.type === "line") {
    el = document.createElementNS(NS, "line");
    el.setAttribute("x1", s.x1);
    el.setAttribute("y1", s.y1);
    el.setAttribute("x2", s.x2);
    el.setAttribute("y2", s.y2);
    el.setAttribute("stroke", s.stroke);
    el.setAttribute("stroke-width", s.strokeWidth);
    el.setAttribute("stroke-linecap", "round");
  } else if (s.type === "path") {
    el = document.createElementNS(NS, "path");
    el.setAttribute("d", s.d);
    if (s.fill === "none") {
      el.setAttribute("fill", "none");
    } else if (s.fill !== undefined) {
      el.setAttribute("fill", s.fill);
    }
    if (s.stroke) {
      el.setAttribute("stroke", s.stroke);
      el.setAttribute("stroke-width", String(s.strokeWidth || 1));
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("stroke-linejoin", "round");
    }
    if (s.fillRule) el.setAttribute("fill-rule", s.fillRule);
  } else {
    return;
  }
  if (s.fillOpacity !== undefined) el.setAttribute("fill-opacity", String(s.fillOpacity));
  if (s.__blurId) el.setAttribute("filter", `url(#${s.__blurId})`);
  if (s.blend) el.setAttribute("style", `mix-blend-mode: ${s.blend}`);
  parent.appendChild(el);
}

function isLight(step) {
  const n = parseInt(step, 10);
  return n <= 500;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
