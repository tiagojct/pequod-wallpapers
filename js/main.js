// Entry point. Wires controls, regenerate loop, export, gallery, URL state.

import { makeRng, newSeed, isValidSeed } from "./prng.js";
import { loadPalette } from "./palette.js";
import { loadAllMotifs } from "./motifs.js";
import { composeAbstract } from "./compose-abstract.js";
import { composeMaritime } from "./compose-maritime.js";
import { buildSVG, viewportFor } from "./render.js";
import { exportPNG, exportSVG, makeFilename, thumbnailDataURL } from "./export.js";
import { saveEntry, listEntries, deleteEntry, exportGalleryJSON } from "./gallery.js";
import {
  readStateFromURL,
  writeStateToURL,
  shareableURL,
  DEFAULT_STATE,
} from "./url-state.js";

const ASPECT_PRESETS = {
  "16x10": [16, 10],
  "16x9": [16, 9],
  "21x9": [21, 9],
  "4x3": [4, 3],
  "19x9": [19.5, 9],
  "9x19": [9, 19.5],
  "1x1": [1, 1],
};

const ALL_ACCENTS = [
  "ahab",
  "starbuck",
  "queequeg",
  "pip",
  "ishmael",
  "stubb",
  "tashtego",
  "daggoo",
];

const PNG_LONG_SIDE = 2880;

let palette = null;
let motifsCache = null;
let state = { ...DEFAULT_STATE };
let lastSVG = null;
let lastComposition = null;

async function init() {
  palette = await loadPalette();
  motifsCache = await loadAllMotifs();

  const fromURL = readStateFromURL();
  state = { ...DEFAULT_STATE, ...fromURL };
  if (!state.seed) state.seed = newSeed();

  // Honour prefers-color-scheme on first load if URL did not specify.
  const params = new URLSearchParams(window.location.search);
  if (!params.has("theme")) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    state.theme = prefersDark ? "dark" : "light";
  }

  buildAccentLockUI();
  attachControls();
  syncControlsFromState();
  applyAppTheme();
  regenerate({ keepSeed: true, replaceURL: true });

  window.addEventListener("popstate", () => {
    state = { ...DEFAULT_STATE, ...readStateFromURL() };
    syncControlsFromState();
    applyAppTheme();
    regenerate({ keepSeed: true, replaceURL: true });
  });
}

function buildAccentLockUI() {
  const container = document.getElementById("accent-lock");
  container.innerHTML = "";
  for (const name of ALL_ACCENTS) {
    const id = `lock-${name}`;
    const a = palette.accents[name];
    const wrap = document.createElement("label");
    wrap.className = "accent-chip";
    wrap.htmlFor = id;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = id;
    cb.value = name;
    cb.addEventListener("change", () => {
      const checked = Array.from(
        container.querySelectorAll("input:checked"),
      ).map((el) => el.value);
      state.accents = checked;
    });
    // Half-and-half swatch showing both the light and dark variants.
    const dot = document.createElement("span");
    dot.className = "accent-dot";
    dot.style.background = `linear-gradient(90deg, ${a.light} 0 50%, ${a.dark} 50% 100%)`;
    dot.title = `${name}: ${a.light} (light), ${a.dark} (dark)`;
    const span = document.createElement("span");
    span.textContent = name;
    wrap.appendChild(cb);
    wrap.appendChild(dot);
    wrap.appendChild(span);
    container.appendChild(wrap);
  }
}

function attachControls() {
  document.getElementById("regenerate").addEventListener("click", () => {
    regenerate({});
  });
  document.getElementById("mode").addEventListener("change", (e) => {
    state.mode = e.target.value;
    regenerate({});
  });
  document.getElementById("theme").addEventListener("change", (e) => {
    state.theme = e.target.value;
    applyAppTheme();
    regenerate({});
  });
  document.getElementById("aspect").addEventListener("change", (e) => {
    const v = e.target.value;
    if (v === "custom") {
      document.getElementById("custom-aspect").hidden = false;
      return;
    }
    document.getElementById("custom-aspect").hidden = true;
    const [w, h] = ASPECT_PRESETS[v];
    state.aspectW = w;
    state.aspectH = h;
    regenerate({ keepSeed: true });
  });
  document.getElementById("custom-w").addEventListener("change", (e) => {
    const n = parseInt(e.target.value, 10);
    if (n > 0) state.aspectW = n;
    regenerate({ keepSeed: true });
  });
  document.getElementById("custom-h").addEventListener("change", (e) => {
    const n = parseInt(e.target.value, 10);
    if (n > 0) state.aspectH = n;
    regenerate({ keepSeed: true });
  });
  document.getElementById("density").addEventListener("change", (e) => {
    state.density = e.target.value;
    regenerate({});
  });
  document.getElementById("count").addEventListener("change", (e) => {
    state.accentCount = parseInt(e.target.value, 10);
    regenerate({});
  });
  document.getElementById("seed").addEventListener("change", (e) => {
    const v = e.target.value.trim().toUpperCase();
    if (isValidSeed(v)) {
      state.seed = v;
      regenerate({ keepSeed: true });
    } else {
      e.target.value = state.seed;
    }
  });
  document.getElementById("watermark").addEventListener("change", (e) => {
    state.watermark = e.target.checked;
    rerender();
    writeStateToURL(state, true);
  });

  document.getElementById("more-toggle").addEventListener("click", () => {
    const adv = document.getElementById("advanced");
    const isHidden = adv.hidden;
    adv.hidden = !isHidden;
    document.getElementById("more-toggle").textContent = isHidden
      ? "less"
      : "more";
  });

  document.getElementById("copy-seed").addEventListener("click", async () => {
    await navigator.clipboard.writeText(state.seed);
    flashStatus("seed copied");
  });
  document.getElementById("copy-url").addEventListener("click", async () => {
    await navigator.clipboard.writeText(shareableURL(state));
    flashStatus("share URL copied");
  });
  document.getElementById("export-png").addEventListener("click", async () => {
    if (!lastSVG) return;
    const [width, height] = pixelSize(state, PNG_LONG_SIDE);
    const filename = makeFilename(state, "png");
    flashStatus("rendering png...");
    await exportPNG(lastSVG, width, height, filename);
    flashStatus("png saved");
  });
  document.getElementById("export-svg").addEventListener("click", () => {
    if (!lastSVG) return;
    exportSVG(lastSVG, makeFilename(state, "svg"));
    flashStatus("svg saved");
  });
  document.getElementById("save").addEventListener("click", async () => {
    if (!lastSVG) return;
    const thumb = await thumbnailDataURL(lastSVG, 256);
    await saveEntry({
      seed: state.seed,
      mode: state.mode,
      theme: state.theme,
      aspectW: state.aspectW,
      aspectH: state.aspectH,
      density: state.density,
      accentCount: state.accentCount,
      accents: state.accents,
      watermark: state.watermark,
      substyle: lastComposition?.substyle,
      thumbnail: thumb,
    });
    flashStatus("saved to gallery");
  });
  document.getElementById("gallery").addEventListener("click", openGallery);
  document.getElementById("close-gallery").addEventListener("click", closeGallery);
  document.getElementById("export-gallery").addEventListener("click", async () => {
    const json = await exportGalleryJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pequod-gallery.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
}

function syncControlsFromState() {
  document.getElementById("mode").value = state.mode;
  document.getElementById("theme").value = state.theme;
  const presetKey = matchAspect(state.aspectW, state.aspectH);
  if (presetKey) {
    document.getElementById("aspect").value = presetKey;
    document.getElementById("custom-aspect").hidden = true;
  } else {
    document.getElementById("aspect").value = "custom";
    document.getElementById("custom-aspect").hidden = false;
    document.getElementById("custom-w").value = state.aspectW;
    document.getElementById("custom-h").value = state.aspectH;
  }
  document.getElementById("density").value = state.density;
  document.getElementById("count").value = String(state.accentCount);
  document.getElementById("seed").value = state.seed;
  document.getElementById("watermark").checked = !!state.watermark;
  // Accent lock checkboxes
  for (const name of ALL_ACCENTS) {
    const cb = document.getElementById(`lock-${name}`);
    if (cb) cb.checked = state.accents.includes(name);
  }
}

function matchAspect(w, h) {
  for (const [key, [pw, ph]] of Object.entries(ASPECT_PRESETS)) {
    if (Math.abs(pw / ph - w / h) < 0.001 && pw === w && ph === h) {
      return key;
    }
  }
  // Encoded edge cases for the 19.5 phone aspects.
  if (w === 19.5 && h === 9) return "19x9";
  if (w === 9 && h === 19.5) return "9x19";
  return null;
}

function regenerate({ keepSeed = false, replaceURL = false } = {}) {
  if (!keepSeed) state.seed = newSeed();
  const rng = makeRng(state.seed);
  const vp = viewportFor(state.aspectW, state.aspectH);
  const composition =
    state.mode === "abstract"
      ? composeAbstract(palette, rng, state, vp)
      : composeMaritime(palette, rng, state, vp);
  lastComposition = composition;
  rerender();
  document.getElementById("seed").value = state.seed;
  writeStateToURL(state, replaceURL);
}

function rerender() {
  if (!lastComposition) return;
  const { svg } = buildSVG(lastComposition, {
    aspectW: state.aspectW,
    aspectH: state.aspectH,
    watermark: state.watermark,
    seed: state.seed,
    motifsCache,
  });
  const stage = document.getElementById("stage");
  stage.innerHTML = "";
  stage.appendChild(svg);
  // Make the SVG fill the stage while preserving aspect.
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  lastSVG = svg;
}

function pixelSize(state, longSide) {
  if (state.aspectW >= state.aspectH) {
    return [longSide, Math.round((longSide * state.aspectH) / state.aspectW)];
  }
  return [Math.round((longSide * state.aspectW) / state.aspectH), longSide];
}

function applyAppTheme() {
  document.body.dataset.theme = state.theme;
}

function flashStatus(message) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = message;
  clearTimeout(flashStatus._t);
  flashStatus._t = setTimeout(() => {
    if (el.textContent === message) el.textContent = "";
  }, 2200);
}

async function openGallery() {
  const drawer = document.getElementById("gallery-drawer");
  const grid = document.getElementById("gallery-grid");
  grid.innerHTML = "";
  const entries = await listEntries();
  document.getElementById("gallery-count").textContent = `${entries.length} saved`;
  if (entries.length === 0) {
    grid.innerHTML = "<p class=\"muted\">no saved wallpapers yet.</p>";
  }
  for (const e of entries) {
    const fig = document.createElement("figure");
    fig.className = "gallery-item";
    const img = document.createElement("img");
    img.src = e.thumbnail;
    img.alt = `pequod wallpaper ${e.seed}`;
    img.addEventListener("click", () => {
      restoreEntry(e);
      closeGallery();
    });
    const cap = document.createElement("figcaption");
    cap.textContent = `${e.seed} . ${e.mode} . ${e.theme}`;
    const del = document.createElement("button");
    del.className = "icon-btn";
    del.setAttribute("aria-label", "delete");
    del.textContent = "x";
    del.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await deleteEntry(e.id);
      openGallery();
    });
    fig.appendChild(img);
    fig.appendChild(cap);
    fig.appendChild(del);
    grid.appendChild(fig);
  }
  drawer.hidden = false;
}

function closeGallery() {
  document.getElementById("gallery-drawer").hidden = true;
}

function restoreEntry(e) {
  state = {
    ...DEFAULT_STATE,
    mode: e.mode,
    theme: e.theme,
    aspectW: e.aspectW,
    aspectH: e.aspectH,
    density: e.density,
    accentCount: e.accentCount,
    accents: e.accents || [],
    seed: e.seed,
    watermark: !!e.watermark,
  };
  syncControlsFromState();
  applyAppTheme();
  regenerate({ keepSeed: true });
}

init().catch((err) => {
  console.error(err);
  document.getElementById("stage").textContent =
    "could not start the app. open the console for details.";
});
