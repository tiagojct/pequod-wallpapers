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

  // Defs for filters used by colour-field feathering.
  const defs = document.createElementNS(NS, "defs");
  const feather = document.createElementNS(NS, "filter");
  feather.setAttribute("id", "feather");
  feather.setAttribute("x", "-5%");
  feather.setAttribute("y", "-5%");
  feather.setAttribute("width", "110%");
  feather.setAttribute("height", "110%");
  const blur = document.createElementNS(NS, "feGaussianBlur");
  blur.setAttribute("stdDeviation", "4");
  feather.appendChild(blur);
  defs.appendChild(feather);
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
