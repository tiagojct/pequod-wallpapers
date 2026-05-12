// Optional Moby-Dick chapter epigraph. Picks one chapter title by a
// seed-derived RNG and returns a text shape to be drawn on top of the
// composition. The picker uses a separate RNG so toggling the
// epigraph on or off does not disturb the visual composition.

import { makeRng } from "./prng.js";

let cache = null;

export async function loadChapters() {
  if (cache) return cache;
  const res = await fetch("./chapters.json");
  if (!res.ok) throw new Error("could not load chapters.json");
  cache = await res.json();
  return cache;
}

export function pickChapter(chapters, seed) {
  const rng = makeRng(seed + ":epigraph");
  const list = chapters.chapters;
  return list[Math.floor(rng.next() * list.length)];
}

// Convert a chapter entry to its display string. Front-matter entries
// (Etymology = 0, Extracts = -1, Epilogue = 136) have no Roman numeral.
export function formatChapter(ch) {
  if (ch.n <= 0 || ch.n >= 136) return ch.title;
  return `${toRoman(ch.n)}. ${ch.title}`;
}

export function buildEpigraphShape(ch, vp, chord, theme) {
  const text = formatChapter(ch);
  const longSide = Math.max(vp.w, vp.h);
  const fontSize = longSide * 0.018;
  const inkHex = theme === "light" ? "#0D2F42" : "#EAE1D7";
  return {
    type: "text",
    x: vp.w * 0.04,
    y: vp.h - vp.h * 0.04,
    content: text,
    family: "Georgia, 'Crimson Pro', Cambria, 'Times New Roman', Times, serif",
    size: fontSize,
    weight: 400,
    style: "italic",
    anchor: "start",
    fill: inkHex,
    fillOpacity: 0.78,
  };
}

function toRoman(n) {
  const map = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let v = n;
  for (const [num, sym] of map) {
    while (v >= num) {
      out += sym;
      v -= num;
    }
  }
  return out;
}
