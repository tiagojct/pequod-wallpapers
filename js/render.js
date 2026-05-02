// Builds an SVG element from a composition descriptor. The composition
// uses the viewport dimensions directly (long axis = 1000, short axis
// scaled to aspect), so no letterboxing or cropping is needed.

import { cloneMotif } from "./motifs.js";
import { rgba } from "./palette.js";

export function viewportFor(aspectW, aspectH) {
  // Long axis = 1000; short axis scaled to aspect.
  if (aspectW >= aspectH) {
    return { w: 1000, h: (1000 * aspectH) / aspectW };
  }
  return { w: (1000 * aspectW) / aspectH, h: 1000 };
}

export function buildSVG(composition, options) {
  const { aspectW, aspectH, watermark, seed, motifsCache } = options;
  const NS = "http://www.w3.org/2000/svg";
  const { w: vbW, h: vbH } = viewportFor(aspectW, aspectH);

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("xmlns", NS);
  svg.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  // Surface background.
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("x", 0);
  bg.setAttribute("y", 0);
  bg.setAttribute("width", vbW);
  bg.setAttribute("height", vbH);
  bg.setAttribute("fill", composition.surface.hex);
  svg.appendChild(bg);

  // Defs for filters and gradients.
  const defs = document.createElementNS(NS, "defs");
  // Strong feather filter, used by colour-field bands (Rothko soft edges).
  const feather = document.createElementNS(NS, "filter");
  feather.setAttribute("id", "feather");
  feather.setAttribute("x", "-15%");
  feather.setAttribute("y", "-15%");
  feather.setAttribute("width", "130%");
  feather.setAttribute("height", "130%");
  const blur = document.createElementNS(NS, "feGaussianBlur");
  blur.setAttribute("stdDeviation", String(Math.max(8, Math.min(vbW, vbH) * 0.024)));
  feather.appendChild(blur);
  defs.appendChild(feather);

  // Gradients defined by the composition.
  for (const g of composition.gradients || []) {
    defs.appendChild(buildGradientNode(g, NS));
  }
  svg.appendChild(defs);

  const shapeGroup = document.createElementNS(NS, "g");
  svg.appendChild(shapeGroup);

  for (const s of composition.shapes || []) {
    appendShape(shapeGroup, s, NS);
  }

  for (const m of composition.motifs || []) {
    if (!motifsCache[m.name]) continue;
    const node = cloneMotif(motifsCache[m.name], m.fill);
    // Nested SVG without explicit width/height defaults to 100% of the
    // outer viewport. Lock it to the motif's intrinsic 100x100 box so
    // the surrounding scale() places the motif at the requested size.
    node.setAttribute("width", "100");
    node.setAttribute("height", "100");
    const wrap = document.createElementNS(NS, "g");
    wrap.setAttribute(
      "transform",
      `translate(${m.x}, ${m.y}) scale(${m.size / 100}) ` +
        (m.rotate
          ? `rotate(${m.rotate} 50 50)`
          : ""),
    );
    wrap.appendChild(node);
    shapeGroup.appendChild(wrap);
  }

  // Watermark in the bottom-right corner of the visible area.
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

function buildGradientNode(g, NS) {
  let el;
  if (g.type === "radial") {
    el = document.createElementNS(NS, "radialGradient");
    el.setAttribute("id", g.id);
    el.setAttribute("cx", g.cx);
    el.setAttribute("cy", g.cy);
    el.setAttribute("r", g.r);
    el.setAttribute("gradientUnits", "userSpaceOnUse");
  } else {
    el = document.createElementNS(NS, "linearGradient");
    el.setAttribute("id", g.id);
    el.setAttribute("x1", g.x1);
    el.setAttribute("y1", g.y1);
    el.setAttribute("x2", g.x2);
    el.setAttribute("y2", g.y2);
    el.setAttribute("gradientUnits", "userSpaceOnUse");
  }
  for (const s of g.stops) {
    const stop = document.createElementNS(NS, "stop");
    stop.setAttribute("offset", String(s.offset));
    stop.setAttribute("stop-color", s.color);
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
  } else {
    return;
  }
  if (s.blend) el.setAttribute("style", `mix-blend-mode: ${s.blend}`);
  parent.appendChild(el);
}

function isLight(step) {
  const n = parseInt(step, 10);
  return n <= 500;
}
