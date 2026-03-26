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
    /** 是否忽略透明像素（默认：true） */
    ignoreTransparency?: boolean;
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
 * 主函数：从图片中提取主要颜色
 * @param img - 图片元素
 * @param options - 配置选项
 * @returns RGB 颜色数组
 */
export declare function getMainColors(img: HTMLImageElement, options?: ColorExtractionOptions): RGB[];
/**
 * RGB 转 HSV
 */
export declare function rgbToHsv([r, g, b]: RGB): HSV;
/**
 * HSV 转 RGB
 */
export declare function hsvToRgb([h, s, v]: HSV): RGB;
/**
 * RGB 转 Hex
 */
export declare function rgbToHex([r, g, b]: RGB): string;
/**
 * Hex 转 RGB
 */
export declare function hexToRgb(hex: string): RGB;
//# sourceMappingURL=main.d.ts.map