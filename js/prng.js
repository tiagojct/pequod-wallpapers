// Mulberry32 PRNG seeded from a 32-bit integer.
// cyrb53 hashes a string to a 53-bit number; we keep the low 32 bits.
// Reference: https://github.com/bryc/code/blob/master/jshash/PRNGs.md

export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Convenience helpers for a seeded random session.
export function makeRng(seedString) {
  const seedInt = cyrb53(seedString) >>> 0;
  const next = mulberry32(seedInt);
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    weighted: (items) => {
      const total = items.reduce((s, it) => s + it.weight, 0);
      let r = next() * total;
      for (const it of items) {
        r -= it.weight;
        if (r <= 0) return it.value;
      }
      return items[items.length - 1].value;
    },
  };
}

// Seed format: PEQUOD- followed by four base36 characters.
export function newSeed() {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return "PEQUOD-" + s.toUpperCase();
}

export function isValidSeed(s) {
  return typeof s === "string" && /^PEQUOD-[0-9A-Z]{4}$/.test(s);
}
