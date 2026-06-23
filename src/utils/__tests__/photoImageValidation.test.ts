import { strict as assert } from 'node:assert';
import test from 'node:test';
import { validatePhotoPixelSamples } from '../photoImageValidation';

function makePixels(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [red, green, blue, alpha] = fill(x, y);
      data[offset] = red;
      data[offset + 1] = green;
      data[offset + 2] = blue;
      data[offset + 3] = alpha;
    }
  }
  return data;
}

test('valid photo-like pixel samples pass validation', () => {
  const pixels = makePixels(20, 20, (x, y) => [80 + x * 3, 90 + y * 2, 110, 255]);

  const result = validatePhotoPixelSamples(pixels, 20, 20);

  assert.equal(result.valid, true);
});

test('fully black image is rejected as a placeholder', () => {
  const pixels = makePixels(20, 20, () => [0, 0, 0, 255]);

  const result = validatePhotoPixelSamples(pixels, 20, 20);

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'black_placeholder');
});

test('nearly black flat image is rejected as a placeholder', () => {
  const pixels = makePixels(20, 20, (x, y) => {
    const value = (x + y) % 2 === 0 ? 3 : 6;
    return [value, value, value, 255];
  });

  const result = validatePhotoPixelSamples(pixels, 20, 20);

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'black_placeholder');
});

test('empty or malformed pixel data is rejected', () => {
  const result = validatePhotoPixelSamples(new Uint8ClampedArray(), 20, 20);

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'empty_pixels');
});

test('dark photo with enough variation is not treated as broken', () => {
  const pixels = makePixels(20, 20, (x, y) => {
    const highlight = x === y || x + y === 19;
    return highlight ? [55, 45, 38, 255] : [4 + (x % 3), 5 + (y % 3), 7, 255];
  });

  const result = validatePhotoPixelSamples(pixels, 20, 20);

  assert.equal(result.valid, true);
});
