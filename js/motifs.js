// Loads SVG motifs from motifs/, caches them, and returns parsed
// SVGSVGElement instances ready to be cloned and recoloured.

const CACHE = new Map();

export const MOTIF_NAMES = [
  "pequod",
  "sperm-whale",
  "whale-fluke",
  "whaleboat",
  "sun-moon",
  "compass-rose",
];

async function fetchMotif(name) {
  if (CACHE.has(name)) return CACHE.get(name);
  const res = await fetch(`./motifs/${name}.svg`);
  if (!res.ok) throw new Error(`could not load motif ${name}`);
  const text = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  CACHE.set(name, svg);
  return svg;
}

export async function loadAllMotifs() {
  const out = {};
  for (const name of MOTIF_NAMES) {
    out[name] = await fetchMotif(name);
  }
  return out;
}

// Clone a motif and apply a fill colour to every fillable element.
export function cloneMotif(svgElement, fill) {
  const clone = svgElement.cloneNode(true);
  // Apply fill to the root and to descendants that have no inline fill.
  clone.setAttribute("fill", fill);
  const all = clone.querySelectorAll("path, polygon, rect, circle, ellipse");
  all.forEach((el) => {
    el.setAttribute("fill", fill);
    el.removeAttribute("stroke");
  });
  return clone;
}
