import { describe, it, expect, beforeAll } from '@jest/globals';
import { applyDithering, getSupportedMethods, validateOptions } from '../../lib/dithering.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Dithering Module', () => {
  let sampleImageBuffer;

  beforeAll(async () => {
    // Create a simple test image (100x100 grayscale gradient)
    const width = 100;
    const height = 100;
    const channels = 3;
    const pixels = new Uint8Array(width * height * channels);

    // Create gradient
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const value = Math.floor((x / width) * 255);
        pixels[idx] = value;     // R
        pixels[idx + 1] = value; // G
        pixels[idx + 2] = value; // B
      }
    }

    sampleImageBuffer = await sharp(Buffer.from(pixels), {
      raw: {
        width,
        height,
        channels,
      },
    })
      .png()
      .toBuffer();
  });

  describe('applyDithering', () => {
    it('should process a valid image buffer', async () => {
      const result = await applyDithering(sampleImageBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should throw error for invalid input', async () => {
      await expect(applyDithering('not a buffer')).rejects.toThrow('imageBuffer must be a Buffer');
    });

    it('should throw error for invalid dithering method', async () => {
      await expect(
        applyDithering(sampleImageBuffer, { method: 'invalid' })
      ).rejects.toThrow('Invalid dithering method');
    });

    it('should throw error for invalid bit depth', async () => {
      await expect(
        applyDithering(sampleImageBuffer, { bitDepth: 3 })
      ).rejects.toThrow('Invalid bit depth');
    });

    it('should throw error for invalid black level', async () => {
      await expect(
        applyDithering(sampleImageBuffer, { blackLevel: -1 })
      ).rejects.toThrow('Black and white levels must be between 0 and 100');
    });

    it('should throw error for invalid white level', async () => {
      await expect(
        applyDithering(sampleImageBuffer, { whiteLevel: 101 })
      ).rejects.toThrow('Black and white levels must be between 0 and 100');
    });

    it('should throw error when black level >= white level', async () => {
      await expect(
        applyDithering(sampleImageBuffer, { blackLevel: 50, whiteLevel: 40 })
      ).rejects.toThrow('Black level must be less than white level');
    });

    it('should handle 1-bit dithering (pure B&W)', async () => {
      const result = await applyDithering(sampleImageBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 1,
      });

      expect(result).toBeInstanceOf(Buffer);

      // Verify it's actually 1-bit (should have minimal colors)
      const metadata = await sharp(result).metadata();
      expect(metadata.channels).toBe(1); // Grayscale
    });

    it('should handle 2-bit dithering (4 gray levels)', async () => {
      const result = await applyDithering(sampleImageBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
      });

      expect(result).toBeInstanceOf(Buffer);
      const metadata = await sharp(result).metadata();
      expect(metadata.channels).toBe(1);
    });

    it('should handle 4-bit dithering (16 gray levels)', async () => {
      const result = await applyDithering(sampleImageBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 4,
      });

      expect(result).toBeInstanceOf(Buffer);
      const metadata = await sharp(result).metadata();
      expect(metadata.channels).toBe(1);
    });

    it('should handle 8-bit dithering (256 gray levels)', async () => {
      const result = await applyDithering(sampleImageBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 8,
      });

      expect(result).toBeInstanceOf(Buffer);
      const metadata = await sharp(result).metadata();
      expect(metadata.channels).toBe(1);
    });

    it('should handle ordered dithering', async () => {
      const result = await applyDithering(sampleImageBuffer, {
        method: 'ordered',
        bitDepth: 2,
      });

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle no dithering', async () => {
      const result = await applyDithering(sampleImageBuffer, {
        method: 'none',
        bitDepth: 8,
      });

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should return original buffer when no processing needed', async () => {
      const result = await applyDithering(sampleImageBuffer, {
        method: 'none',
        bitDepth: 8,
        blackLevel: 0,
        whiteLevel: 100,
      });

      expect(result).toBe(sampleImageBuffer); // Same reference
    });

    it('should apply gamma correction by default', async () => {
      const result = await applyDithering(sampleImageBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
        gammaCorrection: true,
      });

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should skip gamma correction when disabled', async () => {
      const result = await applyDithering(sampleImageBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
        gammaCorrection: false,
      });

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should apply black/white level adjustments', async () => {
      const result = await applyDithering(sampleImageBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
        blackLevel: 10,
        whiteLevel: 90,
      });

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should use default options when not specified', async () => {
      const result = await applyDithering(sampleImageBuffer);

      expect(result).toBeInstanceOf(Buffer);
      // Default is floyd-steinberg, bitDepth 4
    });

    it('should produce different results for different bit depths', async () => {
      const result1bit = await applyDithering(sampleImageBuffer, { bitDepth: 1 });
      const result2bit = await applyDithering(sampleImageBuffer, { bitDepth: 2 });
      const result4bit = await applyDithering(sampleImageBuffer, { bitDepth: 4 });

      // All should be valid buffers
      expect(result1bit).toBeInstanceOf(Buffer);
      expect(result2bit).toBeInstanceOf(Buffer);
      expect(result4bit).toBeInstanceOf(Buffer);

      // They should be different (different file sizes likely)
      expect(result1bit.length).not.toBe(result4bit.length);
    });
  });

  describe('getSupportedMethods', () => {
    it('should return supported methods', () => {
      const methods = getSupportedMethods();

      expect(methods).toHaveProperty('floyd-steinberg');
      expect(methods).toHaveProperty('ordered');
      expect(methods).toHaveProperty('none');
    });

    it('should include method descriptions', () => {
      const methods = getSupportedMethods();

      expect(methods['floyd-steinberg'].description).toBeDefined();
      expect(methods['ordered'].description).toBeDefined();
      expect(methods['none'].description).toBeDefined();
    });

    it('should indicate recommended method', () => {
      const methods = getSupportedMethods();

      expect(methods['floyd-steinberg'].recommended).toBe(true);
    });

    it('should list supported bit depths', () => {
      const methods = getSupportedMethods();

      expect(methods['floyd-steinberg'].bitDepths).toEqual([1, 2, 4, 8]);
    });
  });

  describe('validateOptions', () => {
    it('should accept valid options', () => {
      expect(() => validateOptions({ method: 'floyd-steinberg', bitDepth: 2 })).not.toThrow();
      expect(() => validateOptions({ method: 'ordered', bitDepth: 4 })).not.toThrow();
      expect(() => validateOptions({ method: 'none', bitDepth: 8 })).not.toThrow();
    });

    it('should reject invalid method', () => {
      expect(() => validateOptions({ method: 'invalid' })).toThrow('Invalid method');
    });

    it('should reject invalid bit depth', () => {
      expect(() => validateOptions({ bitDepth: 3 })).toThrow('Invalid bit depth');
      expect(() => validateOptions({ bitDepth: 5 })).toThrow('Invalid bit depth');
    });

    it('should reject invalid black level', () => {
      expect(() => validateOptions({ blackLevel: -1 })).toThrow('blackLevel must be between 0 and 100');
      expect(() => validateOptions({ blackLevel: 101 })).toThrow('blackLevel must be between 0 and 100');
    });

    it('should reject invalid white level', () => {
      expect(() => validateOptions({ whiteLevel: -1 })).toThrow('whiteLevel must be between 0 and 100');
      expect(() => validateOptions({ whiteLevel: 101 })).toThrow('whiteLevel must be between 0 and 100');
    });

    it('should reject when black >= white', () => {
      expect(() => validateOptions({ blackLevel: 50, whiteLevel: 50 })).toThrow('blackLevel must be less than whiteLevel');
      expect(() => validateOptions({ blackLevel: 60, whiteLevel: 50 })).toThrow('blackLevel must be less than whiteLevel');
    });

    it('should return true for valid options', () => {
      expect(validateOptions({ method: 'floyd-steinberg', bitDepth: 2 })).toBe(true);
    });

    it('should accept empty options object', () => {
      expect(() => validateOptions({})).not.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with minimal options (existing configs)', async () => {
      const result = await applyDithering(sampleImageBuffer, {});

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle undefined options', async () => {
      const result = await applyDithering(sampleImageBuffer);

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('Performance', () => {
    it('should process image in reasonable time (< 2 seconds)', async () => {
      const start = Date.now();
      await applyDithering(sampleImageBuffer, {
        method: 'floyd-steinberg',
        bitDepth: 2,
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
    }, 5000); // 5 second timeout for test
  });
});
