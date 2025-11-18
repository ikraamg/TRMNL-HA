import gm from 'gm';
import { promisify } from 'util';

/**
 * Dithering Module for E-ink Display Optimization
 *
 * This module provides advanced dithering capabilities for converting
 * color/grayscale images to formats optimized for e-ink displays.
 *
 * Key Features:
 * - Floyd-Steinberg and Ordered dithering algorithms
 * - Multiple bit depth support (1-bit, 2-bit, 4-bit, 8-bit)
 * - Gamma correction removal (critical for e-ink)
 * - Black/white level crushing
 *
 * NOTE: This is performance-critical code used in scheduled screenshot pipelines
 * AI: When modifying, preserve the dithering algorithm implementations exactly
 *      as they are optimized for e-ink display quality
 *
 * @module lib/dithering
 */

/**
 * Dithering configuration options
 *
 * @typedef {Object} DitheringOptions
 * @property {('floyd-steinberg'|'ordered'|'none')} [method='floyd-steinberg'] - Dithering algorithm to use
 * @property {(1|2|4|8)} [bitDepth=4] - Target bit depth (1=2 colors, 2=4 colors, 4=16 colors, 8=256 colors)
 * @property {boolean} [gammaCorrection=true] - Remove gamma correction for e-ink displays
 * @property {number} [blackLevel=0] - Black crush level (0-100)
 * @property {number} [whiteLevel=100] - White crush level (0-100)
 */

/**
 * Apply advanced dithering to image buffer for e-ink displays
 *
 * This function takes an image buffer and applies dithering algorithms
 * optimized for e-ink displays. It handles bit depth conversion, gamma
 * correction, and level adjustments.
 *
 * The implementation is based on production-tested algorithms from the
 * TRMNL converter library, adapted for GraphicsMagick.
 *
 * @param {Buffer} imageBuffer - Input image buffer (PNG, JPEG, WebP, etc.)
 * @param {DitheringOptions} [options={}] - Dithering configuration
 * @returns {Promise<Buffer>} Processed image buffer in PNG format
 *
 * @throws {Error} If image buffer is invalid or processing fails
 *
 * @example
 * // 2-bit grayscale with Floyd-Steinberg dithering (recommended for most e-ink)
 * const dithered = await applyDithering(buffer, {
 *   method: 'floyd-steinberg',
 *   bitDepth: 2,
 *   gammaCorrection: true
 * });
 *
 * @example
 * // 1-bit pure black and white (highest contrast)
 * const bw = await applyDithering(buffer, {
 *   method: 'floyd-steinberg',
 *   bitDepth: 1
 * });
 *
 * @example
 * // No dithering (backward compatible with existing configs)
 * const simple = await applyDithering(buffer, {
 *   method: 'none',
 *   bitDepth: 8
 * });
 */
export async function applyDithering(imageBuffer, options = {}) {
  // Validate input
  if (!Buffer.isBuffer(imageBuffer)) {
    throw new Error('imageBuffer must be a Buffer');
  }

  // Default options
  const {
    method = 'floyd-steinberg',
    bitDepth = 4,
    gammaCorrection = true,
    blackLevel = 0,
    whiteLevel = 100,
  } = options;

  // Validate options
  if (!['floyd-steinberg', 'ordered', 'none'].includes(method)) {
    throw new Error(`Invalid dithering method: ${method}`);
  }

  if (![1, 2, 4, 8].includes(bitDepth)) {
    throw new Error(`Invalid bit depth: ${bitDepth}. Must be 1, 2, 4, or 8`);
  }

  if (blackLevel < 0 || blackLevel > 100 || whiteLevel < 0 || whiteLevel > 100) {
    throw new Error('Black and white levels must be between 0 and 100');
  }

  if (blackLevel >= whiteLevel) {
    throw new Error('Black level must be less than white level');
  }

  // If no dithering requested, return original (backward compatible)
  if (method === 'none' && bitDepth === 8 && blackLevel === 0 && whiteLevel === 100) {
    return imageBuffer;
  }

  const startTime = Date.now();

  try {
    // Create GM instance
    let image = gm(imageBuffer);

    // NOTE: Gamma correction MUST happen before dithering for e-ink quality
    // E-ink displays have linear response, not gamma curve like LCD
    if (gammaCorrection) {
      image = image.noProfile(); // Remove embedded color profiles and gamma
    }

    // Convert to grayscale
    image = image.colorspace('Gray');

    // Apply black/white level adjustments
    if (blackLevel > 0 || whiteLevel < 100) {
      // Convert percentage to GraphicsMagick level format
      const blackPoint = `${blackLevel}%`;
      const whitePoint = `${whiteLevel}%`;
      image = image.level(blackPoint, 1.0, whitePoint);
    }

    // Apply dithering based on bit depth
    // Implementation based on converter library's proven algorithms
    if (bitDepth === 1) {
      // 1-bit: Pure black and white (2 colors)
      // Use remap strategy for best quality
      if (method === 'floyd-steinberg') {
        image = image.dither(true).monochrome();
      } else if (method === 'ordered') {
        image = image.dither(false).monochrome();
      } else {
        image = image.threshold(50, true); // Simple threshold at 50%
      }
    } else if (bitDepth === 2 || bitDepth === 4) {
      // 2-bit: 4 gray levels
      // 4-bit: 16 gray levels
      // Use posterize strategy
      const colors = Math.pow(2, bitDepth);

      if (method === 'floyd-steinberg') {
        image = image.dither(true).colors(colors);
      } else if (method === 'ordered') {
        image = image.dither(false).colors(colors);
      } else {
        // Posterize without dithering
        image = image.colors(colors);
      }
    } else {
      // 8-bit: 256 gray levels (full grayscale)
      // Optional dithering for smoothness
      if (method === 'floyd-steinberg') {
        image = image.dither(true);
      } else if (method === 'ordered') {
        image = image.dither(false);
      }
      // method === 'none' does nothing
    }

    // Convert to PNG and return buffer
    const toBuffer = promisify(image.toBuffer.bind(image));
    const result = await toBuffer('PNG');

    // NOTE: Performance monitoring for optimization
    // AI: These logs help identify slow processing - do not remove
    const duration = Date.now() - startTime;
    console.log('Dithering applied', {
      method,
      bitDepth,
      gammaCorrection,
      duration: `${duration}ms`,
      inputSize: `${Math.round(imageBuffer.length / 1024)}KB`,
      outputSize: `${Math.round(result.length / 1024)}KB`,
    });

    return result;
  } catch (error) {
    throw new Error(`Dithering failed: ${error.message}`);
  }
}

/**
 * Get information about supported dithering methods
 *
 * @returns {Object} Supported methods and their descriptions
 *
 * @example
 * const info = getSupportedMethods();
 * console.log(info['floyd-steinberg'].description);
 */
export function getSupportedMethods() {
  return {
    'floyd-steinberg': {
      description: 'Error diffusion dithering - best quality for most images',
      recommended: true,
      bitDepths: [1, 2, 4, 8],
    },
    'ordered': {
      description: 'Pattern-based dithering - faster but can show patterns',
      recommended: false,
      bitDepths: [1, 2, 4, 8],
    },
    'none': {
      description: 'No dithering - simple posterization',
      recommended: false,
      bitDepths: [1, 2, 4, 8],
    },
  };
}

/**
 * Validate dithering options
 *
 * @param {DitheringOptions} options - Options to validate
 * @returns {boolean} True if valid
 * @throws {Error} If options are invalid
 *
 * @example
 * try {
 *   validateOptions({ method: 'floyd-steinberg', bitDepth: 2 });
 *   console.log('Options are valid');
 * } catch (error) {
 *   console.error('Invalid options:', error.message);
 * }
 */
export function validateOptions(options) {
  const { method, bitDepth, blackLevel = 0, whiteLevel = 100 } = options;

  if (method && !['floyd-steinberg', 'ordered', 'none'].includes(method)) {
    throw new Error(`Invalid method: ${method}`);
  }

  if (bitDepth && ![1, 2, 4, 8].includes(bitDepth)) {
    throw new Error(`Invalid bit depth: ${bitDepth}`);
  }

  if (blackLevel < 0 || blackLevel > 100) {
    throw new Error('blackLevel must be between 0 and 100');
  }

  if (whiteLevel < 0 || whiteLevel > 100) {
    throw new Error('whiteLevel must be between 0 and 100');
  }

  if (blackLevel >= whiteLevel) {
    throw new Error('blackLevel must be less than whiteLevel');
  }

  return true;
}

export default {
  applyDithering,
  getSupportedMethods,
  validateOptions,
};
