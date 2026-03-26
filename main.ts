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
  /** 是否使用随机采样增加稳定性（默认：true） */
  useRandomSample?: boolean;
  /** 随机采样种子（可选，用于复现结果） */
  randomSeed?: number;
  /** 最小采样像素数（默认：1000） */
  minSamplePixels?: number;
  /** 是否应用模糊预处理（默认：true） */
  useBlur?: boolean;
  /** 模糊半径（默认：0.5） */
  blurRadius?: number;
  /** 颜色相似度阈值，用于去重（默认：30，范围0-255） */
  colorDistanceThreshold?: number;
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
  useRandomSample: true,
  randomSeed: 42,
  minSamplePixels: 1000,
  useBlur: true,
  blurRadius: 0.5,
  colorDistanceThreshold: 30,
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
  
  // 应用轻微模糊减少插值噪声（可选）
  if (config.useBlur) {
    ctx.filter = `blur(${config.blurRadius}px)`;
    ctx.drawImage(img, 0, 0, size, size);
    ctx.filter = 'none';
  } else {
    ctx.drawImage(img, 0, 0, size, size);
  }

  const { data } = ctx.getImageData(0, 0, size, size);
  const pixels = samplePixels(data, config);

  if (pixels.length === 0) {
    return [[128, 128, 128]];
  }

  return extractDominantColors(pixels, config);
}

/**
 * 简单的伪随机数生成器（可复现）
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
}

/**
 * 采样像素（使用随机采样增加稳定性）
 */
function samplePixels(data: Uint8ClampedArray, config: Required<ColorExtractionOptions>): RGB[] {
  const { sampleStep, useRandomSample, randomSeed, minSamplePixels } = config;
  const pixels: RGB[] = [];
  const totalPixels = data.length / 4;
  
  if (useRandomSample) {
    // 随机采样模式：确保每次采样的像素数量稳定
    const random = seededRandom(randomSeed);
    const sampleInterval = Math.max(1, Math.floor(sampleStep * (0.8 + random() * 0.4)));
    
    // 计算需要采样的像素索引
    const indices: number[] = [];
    for (let i = 0; i < totalPixels; i += sampleInterval) {
      // 添加小的随机偏移
      const offset = Math.floor((random() - 0.5) * sampleInterval * 0.5);
      const idx = Math.max(0, Math.min(totalPixels - 1, i + offset));
      indices.push(idx);
    }
    
    // 如果采样点太少，降低采样间隔
    if (indices.length < minSamplePixels) {
      const adjustedInterval = Math.max(1, Math.floor(totalPixels / minSamplePixels));
      indices.length = 0;
      for (let i = 0; i < totalPixels; i += adjustedInterval) {
        indices.push(i);
      }
    }
    
    // 收集像素
    for (const i of indices) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a < 128) continue;
      if (isTooDark(r, g, b) || isTooLight(r, g, b)) continue;

      pixels.push([r, g, b]);
    }
  } else {
    // 固定步长采样模式（原始方式）
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

    // 使用软分箱：每个像素同时计入相邻的 bin（权重衰减）
    const hIdx = Math.floor(h * config.hBins);
    const sIdx = Math.floor(s * config.sBins);
    const vIdx = Math.floor(v * config.vBins);

    // 主 bin
    const mainKey = `${hIdx},${sIdx},${vIdx}`;
    addToHistogram(histogram, mainKey, hsv, 1.0);

    // 邻近 bin（软边界处理）- 降低色相权重避免过度扩散
    const neighbors = [
      [hIdx - 1, sIdx, vIdx, 0.15], // 色相相邻：0.15（降低）
      [hIdx + 1, sIdx, vIdx, 0.15],
      [hIdx, sIdx - 1, vIdx, 0.2],  // 饱和度相邻：0.2
      [hIdx, sIdx + 1, vIdx, 0.2],
      [hIdx, sIdx, vIdx - 1, 0.1],  // 明度相邻：0.1（最低）
      [hIdx, sIdx, vIdx + 1, 0.1],
    ];

    for (const [nh, ns, nv, weight] of neighbors) {
      if (nh >= 0 && nh < config.hBins && 
          ns >= 0 && ns < config.sBins && 
          nv >= 0 && nv < config.vBins) {
        addToHistogram(histogram, `${nh},${ns},${nv}`, hsv, weight);
      }
    }
  }

  if (histogram.size === 0) {
    return [getAverageColor(pixels)];
  }

  // 改进排序：结合 count 和颜色紧凑度（方差越小越优先）
  const scoredBins = Array.from(histogram.entries()).map(([key, bin]) => {
    const variance = calculateHSVVariance(bin.pixels);
    // 分数 = count * (1 / (1 + variance))，方差越小分数越高
    const score = bin.count * (1 / (1 + variance));
    return { key, bin, score };
  });
  
  const sortedBins = scoredBins.sort((a, b) => b.score - a.score);

  const result: RGB[] = [];
  
  for (const { bin } of sortedBins) {
    if (result.length >= config.colorCount) break;
    if (bin.pixels.length === 0) continue;
    
    const avgHsv = averageHSV(bin.pixels);
    const color = hsvToRgb(avgHsv);
    
    // 颜色去重：检查是否与已选颜色过于相似
    const isDuplicate = result.some(existingColor => 
      colorDistance(color, existingColor) < config.colorDistanceThreshold
    );
    
    if (!isDuplicate) {
      result.push(color);
    }
  }

  if (result.length === 0) {
    return [getAverageColor(pixels)];
  }

  return result;
}

/**
 * 添加像素到直方图（带权重）
 */
function addToHistogram(
  histogram: Map<string, ColorBin>, 
  key: string, 
  hsv: HSV, 
  weight: number
): void {
  if (!histogram.has(key)) {
    histogram.set(key, { count: 0, pixels: [], originalPixels: [] });
  }
  
  const bin = histogram.get(key)!;
  bin.count += weight;
  bin.pixels.push(hsv);
  bin.originalPixels.push(hsvToRgb(hsv));
}

/**
 * 计算 HSV 方差（衡量颜色紧凑度）
 */
function calculateHSVVariance(hsvPixels: HSV[]): number {
  if (hsvPixels.length < 2) return 0;
  
  // 计算平均值
  const avgH = hsvPixels.reduce((sum, [h]) => sum + h, 0) / hsvPixels.length;
  const avgS = hsvPixels.reduce((sum, [, s]) => sum + s, 0) / hsvPixels.length;
  const avgV = hsvPixels.reduce((sum, [, , v]) => sum + v, 0) / hsvPixels.length;
  
  // 计算方差（色相需要特殊处理环形特性）
  let hVariance = 0;
  for (const [h] of hsvPixels) {
    const diff = Math.abs(h - avgH);
    // 处理色相环绕（0和1是相邻的）
    const wrappedDiff = Math.min(diff, 1 - diff);
    hVariance += wrappedDiff * wrappedDiff;
  }
  hVariance /= hsvPixels.length;
  
  const sVariance = hsvPixels.reduce((sum, [, s]) => sum + (s - avgS) ** 2, 0) / hsvPixels.length;
  const vVariance = hsvPixels.reduce((sum, [, , v]) => sum + (v - avgV) ** 2, 0) / hsvPixels.length;
  
  // 加权组合（色相权重更高，因为人对色相更敏感）
  return hVariance * 2 + sVariance + vVariance;
}

/**
 * 计算两个 RGB 颜色的欧几里得距离
 */
function colorDistance(c1: RGB, c2: RGB): number {
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
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
