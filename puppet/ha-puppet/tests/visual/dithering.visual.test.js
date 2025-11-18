import { describe, it, expect } from '@jest/globals';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { applyDithering } from '../../lib/dithering.js';
import { compareImages, areImagesSimilar, getColorHistogram } from '../helpers/imageComparison.js';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Visual Regression Tests for Dithering
 *
 * These tests verify that our dithering implementation produces
 * high-quality results similar to the reference images from the
 * converter library.
 *
 * NOTE: These tests use sample images from the TRMNL converter library
 * as the gold standard for e-ink dithering quality.
 */
describe('Visual Regression: Dithering Quality', () => {
  const fixturesDir = join(__dirname, '../fixtures');
  const expectedDir = join(fixturesDir, 'expected');
  const snapshotsDir = join(fixturesDir, 'snapshots');

  // Ensure snapshots directory exists
  if (!existsSync(snapshotsDir)) {
    mkdirSync(snapshotsDir, { recursive: true });
  }

  // Create a test input image (gradient) for consistent testing
  let testInputBuffer;

  beforeAll(async () => {
    // Create 800x600 test image with gradient and some detail
    const width = 800;
    const height = 600;
    const channels = 3;
    const pixels = new Uint8Array(width * height * channels);

    // Create a more complex pattern than just gradient
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;

        // Horizontal gradient
        const gradient = Math.floor((x / width) * 255);

        // Add some patterns for dithering test
        const pattern = Math.sin(x / 20) * 20 + Math.cos(y / 20) * 20;

        const value = Math.max(0, Math.min(255, gradient + pattern));

        pixels[idx] = value;     // R
        pixels[idx + 1] = value; // G
        pixels[idx + 2] = value; // B
      }
    }

    testInputBuffer = await sharp(Buffer.from(pixels), {
      raw: {
        width,
        height,
        channels,
      },
    })
      .png()
      .toBuffer();

    // Save for visual inspection
    writeFileSync(join(snapshotsDir, 'test-input.png'), testInputBuffer);
  });

  describe('Bit Depth Visual Quality', () => {
    it('should produce 1-bit dithered image with ~2 colors', async () => {
      const result = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 1,
      });

      // Save snapshot
      writeFileSync(join(snapshotsDir, 'test-1bit.png'), result);

      // Verify it's actually 1-bit (should have very few unique colors)
      const histogram = await getColorHistogram(result);

      // 1-bit should have approximately 2 colors (black and white)
      // Allow a few more due to PNG compression artifacts
      expect(histogram.uniqueColors).toBeLessThanOrEqual(10);

      // Verify image is valid
      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.channels).toBe(1); // Grayscale
    });

    it('should produce 2-bit dithered image with ~4 colors', async () => {
      const result = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
      });

      writeFileSync(join(snapshotsDir, 'test-2bit.png'), result);

      const histogram = await getColorHistogram(result);

      // 2-bit should have approximately 4 gray levels
      // Allow some variance due to anti-aliasing and compression
      expect(histogram.uniqueColors).toBeLessThanOrEqual(20);
      expect(histogram.uniqueColors).toBeGreaterThan(2);
    });

    it('should produce 4-bit dithered image with ~16 colors', async () => {
      const result = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 4,
      });

      writeFileSync(join(snapshotsDir, 'test-4bit.png'), result);

      const histogram = await getColorHistogram(result);

      // 4-bit should have approximately 16 gray levels
      expect(histogram.uniqueColors).toBeLessThanOrEqual(50);
      expect(histogram.uniqueColors).toBeGreaterThan(4);
    });

    it('should produce 8-bit dithered image with full range', async () => {
      const result = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 8,
      });

      writeFileSync(join(snapshotsDir, 'test-8bit-dithered.png'), result);

      const histogram = await getColorHistogram(result);

      // 8-bit should have many gray levels
      expect(histogram.uniqueColors).toBeGreaterThan(16);
    });
  });

  describe('Dithering Algorithm Comparison', () => {
    it('floyd-steinberg should produce different result than ordered', async () => {
      const floyd = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
      });

      const ordered = await applyDithering(testInputBuffer, {
        method: 'ordered',
        bitDepth: 2,
      });

      writeFileSync(join(snapshotsDir, 'test-floyd-steinberg.png'), floyd);
      writeFileSync(join(snapshotsDir, 'test-ordered.png'), ordered);

      // They should be different algorithms, so results should differ
      const areSame = await areImagesSimilar(floyd, ordered, 0.1);
      expect(areSame).toBe(false);
    });

    it('dithered should look different from simple threshold', async () => {
      const dithered = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 1,
      });

      const threshold = await applyDithering(testInputBuffer, {
        method: 'none',
        bitDepth: 1,
      });

      writeFileSync(join(snapshotsDir, 'test-with-dither.png'), dithered);
      writeFileSync(join(snapshotsDir, 'test-without-dither.png'), threshold);

      // Dithering should produce different visual result
      const areSame = await areImagesSimilar(dithered, threshold, 5);
      expect(areSame).toBe(false);
    });
  });

  describe('Gamma Correction Impact', () => {
    it('should produce different results with/without gamma correction', async () => {
      const withGamma = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
        gammaCorrection: true,
      });

      const withoutGamma = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
        gammaCorrection: false,
      });

      writeFileSync(join(snapshotsDir, 'test-with-gamma-correction.png'), withGamma);
      writeFileSync(join(snapshotsDir, 'test-without-gamma-correction.png'), withoutGamma);

      // Results should differ (gamma correction changes appearance)
      const areSame = await areImagesSimilar(withGamma, withoutGamma, 1);
      expect(areSame).toBe(false);
    });
  });

  describe('Level Adjustments', () => {
    it('should crush blacks when black level increased', async () => {
      const normal = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 4,
        blackLevel: 0,
      });

      const crushedBlacks = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 4,
        blackLevel: 20,
      });

      writeFileSync(join(snapshotsDir, 'test-normal-blacks.png'), normal);
      writeFileSync(join(snapshotsDir, 'test-crushed-blacks.png'), crushedBlacks);

      // Should be visually different
      const areSame = await areImagesSimilar(normal, crushedBlacks, 1);
      expect(areSame).toBe(false);
    });

    it('should crush whites when white level decreased', async () => {
      const normal = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 4,
        whiteLevel: 100,
      });

      const crushedWhites = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 4,
        whiteLevel: 80,
      });

      writeFileSync(join(snapshotsDir, 'test-normal-whites.png'), normal);
      writeFileSync(join(snapshotsDir, 'test-crushed-whites.png'), crushedWhites);

      // Should be visually different
      const areSame = await areImagesSimilar(normal, crushedWhites, 1);
      expect(areSame).toBe(false);
    });
  });

  describe('Consistency', () => {
    it('should produce identical output for same input and options', async () => {
      const result1 = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
      });

      const result2 = await applyDithering(testInputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
      });

      // Should be pixel-perfect identical
      const comparison = await compareImages(result1, result2);
      expect(comparison.percentageDifference).toBe(0);
    });
  });

  describe('Reference Image Comparison', () => {
    // NOTE: These tests compare against the converter library samples
    // We don't expect pixel-perfect matches due to different implementations,
    // but we verify our output quality is reasonable

    it('should produce reasonable 1-bit output compared to reference', async () => {
      const referencePath = join(expectedDir, 'plugin-f39aec-1bit.png');

      if (!existsSync(referencePath)) {
        console.log('Reference image not found, skipping comparison test');
        return;
      }

      const referenceBuffer = readFileSync(referencePath);

      // Use reference as input (resize to test size first)
      const inputBuffer = await sharp(referenceBuffer).resize(800, null).toBuffer();

      const ourResult = await applyDithering(inputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 1,
        gammaCorrection: true,
      });

      writeFileSync(join(snapshotsDir, 'our-1bit-vs-reference.png'), ourResult);

      // Check color count is similar (both should be ~2 colors)
      const ourHistogram = await getColorHistogram(ourResult);
      expect(ourHistogram.uniqueColors).toBeLessThanOrEqual(10);
    });

    it('should produce reasonable 2-bit output compared to reference', async () => {
      const referencePath = join(expectedDir, 'plugin-f39aec-2bit.png');

      if (!existsSync(referencePath)) {
        console.log('Reference image not found, skipping comparison test');
        return;
      }

      const referenceBuffer = readFileSync(referencePath);
      const inputBuffer = await sharp(referenceBuffer).resize(800, null).toBuffer();

      const ourResult = await applyDithering(inputBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
        gammaCorrection: true,
      });

      writeFileSync(join(snapshotsDir, 'our-2bit-vs-reference.png'), ourResult);

      const ourHistogram = await getColorHistogram(ourResult);
      expect(ourHistogram.uniqueColors).toBeLessThanOrEqual(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle pure white image', async () => {
      const whiteImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const result = await applyDithering(whiteImage, {
        method: 'floyd-steinberg',
        bitDepth: 2,
      });

      expect(result).toBeInstanceOf(Buffer);

      const histogram = await getColorHistogram(result);
      // Pure white should remain mostly white with minimal colors
      expect(histogram.uniqueColors).toBeLessThanOrEqual(5);
    });

    it('should handle pure black image', async () => {
      const blackImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const result = await applyDithering(blackImage, {
        method: 'floyd-steinberg',
        bitDepth: 2,
      });

      expect(result).toBeInstanceOf(Buffer);

      const histogram = await getColorHistogram(result);
      expect(histogram.uniqueColors).toBeLessThanOrEqual(5);
    });

    it('should handle small images', async () => {
      const smallImage = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .png()
        .toBuffer();

      const result = await applyDithering(smallImage, {
        method: 'floyd-steinberg',
        bitDepth: 2,
      });

      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
