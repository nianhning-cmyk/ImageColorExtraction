function getMainColor(img, sampleStep = 4) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const size = 100;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const pixels = [];

  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue;
    if (isTooDark(r, g, b) || isTooLight(r, g, b)) continue;

    pixels.push([r, g, b]);
  }

  if (!pixels.length) return [128, 128, 128];

  return extractDominantByHistogram(pixels);
}

function rgbToHsv([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  let s = max === 0 ? 0 : diff / max;
  let v = max;

  if (diff !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / diff + 2) / 6;
        break;
      case b:
        h = ((r - g) / diff + 4) / 6;
        break;
    }
  }

  return [h, s, v];
}

function hsvToRgb([h, s, v]) {
  let r, g, b;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function extractDominantByHistogram(pixels) {
  const hBins = 24;
  const sBins = 4;
  const vBins = 4;
  
  const histogram = new Map();
  const hsvPixels = pixels.map(rgbToHsv);
  
  for (const hsv of hsvPixels) {
    const [h, s, v] = hsv;
    if (s < 0.1 || v < 0.2 || v > 0.95) continue;
    
    const hIdx = Math.min(Math.floor(h * hBins), hBins - 1);
    const sIdx = Math.min(Math.floor(s * sBins), sBins - 1);
    const vIdx = Math.min(Math.floor(v * vBins), vBins - 1);
    const key = `${hIdx},${sIdx},${vIdx}`;
    
    if (!histogram.has(key)) {
      histogram.set(key, { count: 0, pixels: [] });
    }
    const bin = histogram.get(key);
    bin.count++;
    bin.pixels.push(hsv);
  }
  
  if (histogram.size === 0) {
    let sumR = 0, sumG = 0, sumB = 0;
    for (const [r, g, b] of pixels) {
      sumR += r; sumG += g; sumB += b;
    }
    return [Math.round(sumR / pixels.length), Math.round(sumG / pixels.length), Math.round(sumB / pixels.length)];
  }
  
  let bestBin = null;
  let bestCount = 0;
  
  for (const [key, bin] of histogram) {
    if (bin.count > bestCount) {
      bestCount = bin.count;
      bestBin = bin;
    }
  }
  
  let sumH = 0, sumS = 0, sumV = 0;
  for (const [h, s, v] of bestBin.pixels) {
    sumH += h;
    sumS += s;
    sumV += v;
  }
  
  const avgHsv = [
    sumH / bestBin.pixels.length,
    sumS / bestBin.pixels.length,
    sumV / bestBin.pixels.length
  ];
  
  return hsvToRgb(avgHsv);
}

function getLuminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isTooDark(r, g, b) {
  return getLuminance(r, g, b) < 20;
}

function isTooLight(r, g, b) {
  return getLuminance(r, g, b) > 245;
}

function rgbToHex([r, g, b]) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b)
    .toString(16)
    .slice(1)
    .toUpperCase();
}
