export type PhotoPixelValidationReason =
  | 'empty_pixels'
  | 'transparent_placeholder'
  | 'black_placeholder';

export type PhotoPixelValidationResult = {
  valid: boolean;
  reason?: PhotoPixelValidationReason;
  sampledPixels: number;
  darkRatio: number;
  transparentRatio: number;
  maxBrightness: number;
  brightnessVariance: number;
};

const DEFAULT_MAX_SAMPLES = 640;
const DARK_BRIGHTNESS_THRESHOLD = 8;
const BLACK_MAX_BRIGHTNESS = 24;
const BLACK_DARK_RATIO = 0.98;
const BLACK_VARIANCE_THRESHOLD = 20;
const TRANSPARENT_ALPHA_THRESHOLD = 8;
const TRANSPARENT_RATIO = 0.98;

export function validatePhotoPixelSamples(
  data: Uint8ClampedArray | number[],
  width: number,
  height: number,
  maxSamples = DEFAULT_MAX_SAMPLES
): PhotoPixelValidationResult {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) {
    return {
      valid: false,
      reason: 'empty_pixels',
      sampledPixels: 0,
      darkRatio: 0,
      transparentRatio: 0,
      maxBrightness: 0,
      brightnessVariance: 0,
    };
  }

  const totalPixels = width * height;
  const stride = Math.max(1, Math.floor(Math.sqrt(totalPixels / maxSamples)));
  let sampledPixels = 0;
  let darkPixels = 0;
  let transparentPixels = 0;
  let maxBrightness = 0;
  let brightnessSum = 0;
  let brightnessSquaredSum = 0;

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const offset = (y * width + x) * 4;
      const red = data[offset] ?? 0;
      const green = data[offset + 1] ?? 0;
      const blue = data[offset + 2] ?? 0;
      const alpha = data[offset + 3] ?? 255;
      const brightness = (red + green + blue) / 3;

      sampledPixels += 1;
      brightnessSum += brightness;
      brightnessSquaredSum += brightness * brightness;
      maxBrightness = Math.max(maxBrightness, brightness);

      if (brightness <= DARK_BRIGHTNESS_THRESHOLD) darkPixels += 1;
      if (alpha <= TRANSPARENT_ALPHA_THRESHOLD) transparentPixels += 1;
    }
  }

  if (sampledPixels === 0) {
    return {
      valid: false,
      reason: 'empty_pixels',
      sampledPixels: 0,
      darkRatio: 0,
      transparentRatio: 0,
      maxBrightness: 0,
      brightnessVariance: 0,
    };
  }

  const darkRatio = darkPixels / sampledPixels;
  const transparentRatio = transparentPixels / sampledPixels;
  const meanBrightness = brightnessSum / sampledPixels;
  const brightnessVariance = Math.max(0, brightnessSquaredSum / sampledPixels - meanBrightness * meanBrightness);

  if (transparentRatio >= TRANSPARENT_RATIO) {
    return {
      valid: false,
      reason: 'transparent_placeholder',
      sampledPixels,
      darkRatio,
      transparentRatio,
      maxBrightness,
      brightnessVariance,
    };
  }

  if (
    darkRatio >= BLACK_DARK_RATIO &&
    maxBrightness <= BLACK_MAX_BRIGHTNESS &&
    brightnessVariance <= BLACK_VARIANCE_THRESHOLD
  ) {
    return {
      valid: false,
      reason: 'black_placeholder',
      sampledPixels,
      darkRatio,
      transparentRatio,
      maxBrightness,
      brightnessVariance,
    };
  }

  return {
    valid: true,
    sampledPixels,
    darkRatio,
    transparentRatio,
    maxBrightness,
    brightnessVariance,
  };
}
