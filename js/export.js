// PNG and SVG export for a built wallpaper SVG element.

export function exportSVG(svgElement, filename) {
  // Clone, add xmlns, serialise.
  const clone = svgElement.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  const serializer = new XMLSerializer();
  let xml = serializer.serializeToString(clone);
  if (!xml.startsWith("<?xml")) {
    xml = `<?xml version="1.0" encoding="UTF-8"?>\n` + xml;
  }
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(blob, filename);
}

export async function exportPNG(svgElement, width, height, filename) {
  // Serialise the SVG, draw it onto a Canvas at the requested
  // resolution, then export the canvas as PNG.
  const clone = svgElement.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const svg64 = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = svg64;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  triggerDownload(blob, filename);
}

export async function thumbnailDataURL(svgElement, longSide = 256) {
  const clone = svgElement.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const svg64 = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = svg64;
  });

  // Aspect-aware sizing.
  const ratio = img.width && img.height ? img.width / img.height : 1;
  let w, h;
  if (ratio >= 1) {
    w = longSide;
    h = Math.round(longSide / ratio);
  } else {
    h = longSide;
    w = Math.round(longSide * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function makeFilename(state, ext) {
  const aspect = `${state.aspectW}x${state.aspectH}`;
  return `pequod-wallpaper-${state.seed}-${state.mode}-${state.theme}-${aspect}.${ext}`;
}
