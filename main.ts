/**
 * 取色算法配置选项
 */
export interface ColorExtractionOptions {
  /** 采样步长（默认：4） */
  sampleStep?: number;
  /** 返回的主色数量（默认：5） */
  colorCount?: number;
  /** HSV 直方图分箱数量：色相（默认：24） */
  hBins?: number;
  /** HSV 直方图分箱数量：饱和度（默认：6） */
  sBins?: number;
  /** HSV 直方图分箱数量：明度（默认：6） */
  vBins?: number;
  /** 最小饱和度阈值（默认：0.08） */
  minSaturation?: number;
  /** 最小明度阈值（默认：0.15） */
  minValue?: number;
  /** 最大明度阈值（默认：0.95） */
  maxValue?: number;
  /** 降维后的尺寸（默认：150） */
  resizeSize?: number;
}

/**
 * RGB 颜色类型
 */
export type RGB = [number, number, number];

/**
 * HSV 颜色类型
 */
export type HSV = [number, number, number];

/**
 * 带计数的颜色 bin
 */
interface ColorBin {
  count: number;
  pixels: HSV[];
  originalPixels: RGB[];
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Required<ColorExtractionOptions> = {
  sampleStep: 4,
  colorCount: 5,
  hBins: 24,
  sBins: 6,
  vBins: 6,
  minSaturation: 0.08,
  minValue: 0.15,
  maxValue: 0.95,
  resizeSize: 150,
};

/**
 * 主函数：从图片中提取主要颜色
 * @param img - 图片元素
 * @param options - 配置选项
 * @returns RGB 颜色数组
 */
export function getMainColors(
  img: HTMLImageElement,
  options: ColorExtractionOptions = {}
): RGB[] {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) {
    console.error('Failed to get 2D context');
    return [[128, 128, 128]];
  }

  const size = config.resizeSize;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const pixels = samplePixels(data, config.sampleStep);

  if (pixels.length === 0) {
    return [[128, 128, 128]];
  }

  return extractDominantColors(pixels, config);
}

/**
 * 采样像素（使用随机采样避免周期性偏差）
 */
function samplePixels(data: Uint8ClampedArray, sampleStep: number): RGB[] {
  const pixels: RGB[] = [];
  const totalPixels = data.length / 4;
  
  for (let i = 0; i < totalPixels; i++) {
    if (i % sampleStep !== 0) continue;
    
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    if (a < 128) continue;
    if (isTooDark(r, g, b) || isTooLight(r, g, b)) continue;

    pixels.push([r, g, b]);
  }

  return pixels;
}

/**
 * 提取主导颜色（支持返回多个颜色）
 */
function extractDominantColors(pixels: RGB[], config: Required<ColorExtractionOptions>): RGB[] {
  const histogram = new Map<string, ColorBin>();
  const hsvPixels = pixels.map(rgbToHsv);

  for (const hsv of hsvPixels) {
    const [h, s, v] = hsv;
    
    if (s < config.minSaturation || v < config.minValue || v > config.maxValue) {
      continue;
    }

    const hIdx = Math.min(Math.floor(h * config.hBins), config.hBins - 1);
    const sIdx = Math.min(Math.floor(s * config.sBins), config.sBins - 1);
    const vIdx = Math.min(Math.floor(v * config.vBins), config.vBins - 1);
    const key = `${hIdx},${sIdx},${vIdx}`;

    if (!histogram.has(key)) {
      histogram.set(key, { count: 0, pixels: [], originalPixels: [] });
    }
    
    const bin = histogram.get(key)!;
    bin.count++;
    bin.pixels.push(hsv);
    bin.originalPixels.push(hsvToRgb(hsv));
  }

  if (histogram.size === 0) {
    return [getAverageColor(pixels)];
  }

  const sortedBins = Array.from(histogram.entries())
    .sort((a, b) => b[1].count - a[1].count);

  const result: RGB[] = [];
  
  for (let i = 0; i < Math.min(config.colorCount, sortedBins.length); i++) {
    const bin = sortedBins[i][1];
    
    if (bin.pixels.length === 0) continue;
    
    const avgHsv = averageHSV(bin.pixels);
    result.push(hsvToRgb(avgHsv));
  }

  if (result.length === 0) {
    return [getAverageColor(pixels)];
  }

  return result;
}

/**
 * 计算平均颜色（fallback）
 */
function getAverageColor(pixels: RGB[]): RGB {
  let sumR = 0, sumG = 0, sumB = 0;
  for (const [r, g, b] of pixels) {
    sumR += r;
    sumG += g;
    sumB += b;
  }
  return [
    Math.round(sumR / pixels.length),
    Math.round(sumG / pixels.length),
    Math.round(sumB / pixels.length),
  ];
}

/**
 * 计算 HSV 平均值（处理色相环）
 */
function averageHSV(hsvPixels: HSV[]): HSV {
  if (hsvPixels.length === 0) {
    return [0, 0, 0];
  }

  const sinSum = hsvPixels.reduce((sum, [h]) => sum + Math.sin(h * 2 * Math.PI), 0);
  const cosSum = hsvPixels.reduce((sum, [h]) => sum + Math.cos(h * 2 * Math.PI), 0);
  
  let avgH = Math.atan2(sinSum, cosSum) / (2 * Math.PI);
  if (avgH < 0) avgH += 1;

  const sumS = hsvPixels.reduce((sum, [, s]) => sum + s, 0);
  const sumV = hsvPixels.reduce((sum, [, , v]) => sum + v, 0);

  return [
    avgH,
    sumS / hsvPixels.length,
    sumV / hsvPixels.length,
  ];
}

/**
 * RGB 转 HSV
 */
export function rgbToHsv([r, g, b]: RGB): HSV {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;

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

/**
 * HSV 转 RGB
 */
export function hsvToRgb([h, s, v]: HSV): RGB {
  let r = 0, g = 0, b = 0;

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

/**
 * 计算亮度
 */
function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 判断是否过暗
 */
function isTooDark(r: number, g: number, b: number): boolean {
  return getLuminance(r, g, b) < 15;
}

/**
 * 判断是否过亮
 */
function isTooLight(r: number, g: number, b: number): boolean {
  return getLuminance(r, g, b) > 250;
}

/**
 * RGB 转 Hex
 */
export function rgbToHex([r, g, b]: RGB): string {
  return (
    '#' +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  );
}

/**
 * Hex 转 RGB
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}
