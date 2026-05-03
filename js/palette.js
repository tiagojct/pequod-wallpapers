// Loads the vendored pequod.json and exposes selection helpers
// that enforce the composition rules from CLAUDE.md.

let palette = null;

export async function loadPalette() {
  if (palette) return palette;
  const res = await fetch("./pequod.json");
  if (!res.ok) throw new Error("could not load pequod.json");
  palette = await res.json();
  return palette;
}

export const WARM_CREW = ["ahab", "pip", "stubb", "daggoo"];
export const COOL_CREW = ["starbuck", "queequeg", "ishmael", "tashtego"];

// Surface candidates per theme.
export const LIGHT_SURFACES = ["50", "100", "150", "200"];
export const DARK_SURFACES = ["800", "900", "950"];

// Foreground Log steps available per theme. The warm-cool hinge falls
// at Log 600 (cool) and Log 500 (warm); we keep light-side foregrounds
// to the warm range and dark-side foregrounds to the cool range.
export const LIGHT_FOREGROUND_LOG = ["300", "400", "500"];
export const DARK_FOREGROUND_LOG = ["600", "700"];

// Map a crew name to its surface-side variant hex.
export function crewHex(p, name, theme) {
  const a = p.accents[name];
  if (!a) throw new Error("unknown crew member: " + name);
  return theme === "light" ? a.light : a.dark;
}

// Pick a surface Log step from the theme's allowed range.
export function pickSurface(p, rng, theme) {
  const candidates = theme === "light" ? LIGHT_SURFACES : DARK_SURFACES;
  const step = rng.pick(candidates);
  return { step, hex: p.log[step] };
}

// Pick foreground Log steps from the same temperature side.
export function pickForegroundLogs(p, rng, theme, n) {
  const candidates = theme === "light" ? LIGHT_FOREGROUND_LOG : DARK_FOREGROUND_LOG;
  const out = [];
  const pool = rng.shuffle(candidates);
  for (let i = 0; i < n && i < pool.length; i++) {
    out.push({ step: pool[i], hex: p.log[pool[i]] });
  }
  return out;
}

// Choose accents respecting:
//   - lock list (if non-empty) constrains the candidate pool
//   - max one warm crew accent
//   - never Ishmael+Tashtego as the only two accents
//   - 1, 2, or 3 accents requested
// Returns an array of crew names of length up to `count`.
export function pickAccents(rng, count, lock = []) {
  const all = [...WARM_CREW, ...COOL_CREW];
  const pool = lock && lock.length > 0
    ? all.filter((n) => lock.includes(n))
    : all;

  if (pool.length === 0) return [];
  if (count <= 0) return [];

  // If the lock is exactly Ishmael + Tashtego with count 2, swap one.
  // Order from rng-shuffled pool to keep determinism.
  let shuffled = rng.shuffle(pool);

  // Enforce max one warm accent.
  const picked = [];
  let warmUsed = false;
  for (const name of shuffled) {
    if (picked.length >= count) break;
    const isWarm = WARM_CREW.includes(name);
    if (isWarm && warmUsed) continue;
    picked.push(name);
    if (isWarm) warmUsed = true;
  }

  // Backfill from cool pool if we couldn't reach count due to warm-cap.
  if (picked.length < count) {
    for (const name of shuffled) {
      if (picked.length >= count) break;
      if (picked.includes(name)) continue;
      // skip extra warm
      if (WARM_CREW.includes(name) && warmUsed) continue;
      picked.push(name);
    }
  }

  // Forbid the Ishmael+Tashtego-only pair.
  if (
    picked.length === 2 &&
    picked.every((n) => n === "ishmael" || n === "tashtego")
  ) {
    // Replace the second pick with the next available cool accent
    // that is not ishmael or tashtego, or with a warm accent if no
    // cool alternative exists in the pool.
    const alts = shuffled.filter(
      (n) => !picked.includes(n) && n !== "ishmael" && n !== "tashtego",
    );
    if (alts.length > 0) {
      picked[1] = alts[0];
    }
  }

  return picked;
}

// Convert a hex string (#RRGGBB) to an rgba() string.
export function rgba(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Lightweight cyrb53-derived integer for non-cryptographic uses (e.g.
// driving the SVG turbulence seed). Returns 0 for an empty string so
// callers can safely depend on it before a seed has been generated.
export function cyrb53OrZero(s) {
  if (!s) return 0;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}
