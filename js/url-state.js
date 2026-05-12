// Encodes and decodes the full generation state in the query string.
// Schema is documented in README.md and CLAUDE.md.

const VALID_MODES = new Set(["abstract", "maritime"]);
const VALID_THEMES = new Set(["light", "dark"]);
const VALID_DENSITIES = new Set(["low", "medium", "high"]);
const VALID_ACCENTS = new Set([
  "ahab",
  "starbuck",
  "queequeg",
  "pip",
  "ishmael",
  "stubb",
  "tashtego",
  "daggoo",
]);

function encodeAspect(w, h) {
  if (w === 19.5 && h === 9) return "19x9";
  if (w === 9 && h === 19.5) return "9x19";
  return `${w}x${h}`;
}

export const DEFAULT_STATE = {
  mode: "abstract",
  theme: "light",
  aspectW: 16,
  aspectH: 10,
  density: "medium",
  accentCount: 2,
  accents: [],
  seed: "",
  watermark: false,
  epigraph: false,
};

export function readStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  const out = { ...DEFAULT_STATE };

  const mode = params.get("mode");
  if (mode && VALID_MODES.has(mode)) out.mode = mode;

  const theme = params.get("theme");
  if (theme && VALID_THEMES.has(theme)) out.theme = theme;

  const aspect = params.get("aspect");
  if (aspect) {
    // Recognise the two encoded phone aspects (where 19 stands for 19.5
    // in the URL slug) before falling back to integer parsing.
    if (aspect === "19x9") {
      out.aspectW = 19.5;
      out.aspectH = 9;
    } else if (aspect === "9x19") {
      out.aspectW = 9;
      out.aspectH = 19.5;
    } else {
      const m = aspect.match(/^(\d+)x(\d+)$/);
      if (m) {
        const w = parseInt(m[1], 10);
        const h = parseInt(m[2], 10);
        if (w > 0 && h > 0 && w <= 16384 && h <= 16384) {
          out.aspectW = w;
          out.aspectH = h;
        }
      }
    }
  }

  const density = params.get("density");
  if (density && VALID_DENSITIES.has(density)) out.density = density;

  const ac = params.get("count");
  if (ac) {
    const n = parseInt(ac, 10);
    if (n >= 1 && n <= 3) out.accentCount = n;
  }

  const accents = params.get("accents");
  if (accents) {
    const list = accents
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => VALID_ACCENTS.has(s));
    out.accents = list;
  }

  const seed = params.get("seed");
  if (seed && /^PEQUOD-[0-9A-Z]{4}$/.test(seed)) out.seed = seed;

  const wm = params.get("wm");
  if (wm === "1") out.watermark = true;

  const epi = params.get("epi");
  if (epi === "1") out.epigraph = true;

  return out;
}

function buildParams(state) {
  const p = new URLSearchParams();
  p.set("mode", state.mode);
  p.set("theme", state.theme);
  p.set("aspect", encodeAspect(state.aspectW, state.aspectH));
  p.set("density", state.density);
  p.set("count", String(state.accentCount));
  if (state.accents && state.accents.length > 0) {
    p.set("accents", state.accents.join(","));
  }
  if (state.seed) p.set("seed", state.seed);
  if (state.watermark) p.set("wm", "1");
  if (state.epigraph) p.set("epi", "1");
  return p;
}

export function writeStateToURL(state, replace = false) {
  const url = `${window.location.pathname}?${buildParams(state).toString()}`;
  if (replace) {
    history.replaceState(null, "", url);
  } else {
    history.pushState(null, "", url);
  }
}

export function shareableURL(state) {
  return `${window.location.origin}${window.location.pathname}?${buildParams(state).toString()}`;
}
