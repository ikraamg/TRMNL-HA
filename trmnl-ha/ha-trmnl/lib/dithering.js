/**
 * Advanced Dithering Module
 *
 * Provides high-quality grayscale conversion with various dithering algorithms
 * optimized for e-ink displays.
 */

import gm from "gm";

/**
 * Apply advanced dithering to an image buffer
 *
 * @param {Buffer} imageBuffer - PNG image buffer
 * @param {Object} options - Dithering options
 * @param {string} options.method - Dithering method: 'floyd-steinberg', 'ordered', 'none'
 * @param {number} options.bitDepth - Output bit depth: 1, 2, 4, or 8
 * @param {boolean} options.gammaCorrection - Apply gamma correction for e-ink displays
 * @param {number} options.blackLevel - Black level adjustment (0-100)
 * @param {number} options.whiteLevel - White level adjustment (0-100)
 * @returns {Promise<Buffer>} - Processed PNG image buffer
 */
export async function applyDithering(imageBuffer, options = {}) {
  const {
    method = "floyd-steinberg",
    bitDepth = 2,
    gammaCorrection = true,
    blackLevel = 0,
    whiteLevel = 100,
  } = options;

  // Create GM instance from buffer
  let image = gm(imageBuffer);

  // Remove color profile for e-ink (removes gamma curve)
  if (gammaCorrection) {
    image = image.noProfile();
  }

  // Convert to grayscale
  image = image.colorspace("Gray");

  // Apply level adjustments for contrast
  if (blackLevel > 0 || whiteLevel < 100) {
    const blackPoint = `${blackLevel}%`;
    const whitePoint = `${whiteLevel}%`;
    image = image.level(blackPoint, 1.0, whitePoint);
  }

  // Calculate number of colors based on bit depth
  const colors = Math.pow(2, bitDepth);

  // Apply dithering based on method and bit depth
  if (bitDepth === 1) {
    // 1-bit (black & white)
    if (method === "floyd-steinberg") {
      image = image.dither(true).monochrome();
    } else if (method === "ordered") {
      // Ordered dithering for 1-bit
      image = image.dither(false).monochrome();
    } else {
      // No dithering - just threshold
      image = image.threshold("50%");
    }
  } else if (bitDepth === 2 || bitDepth === 4 || bitDepth === 8) {
    // 2-bit (4 colors), 4-bit (16 colors), 8-bit (256 colors)
    if (method === "floyd-steinberg") {
      image = image.dither(true).colors(colors);
    } else if (method === "ordered") {
      // Use dither(false) for ordered/none pattern
      image = image.dither(false).colors(colors);
    } else {
      // No dithering - just posterize
      image = image.colors(colors);
    }
  }

  // Convert to PNG buffer using stream
  return new Promise((resolve, reject) => {
    const chunks = [];

    image.stream("png", (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }

      stdout.on("data", (chunk) => {
        chunks.push(chunk);
      });

      stdout.on("end", () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          reject(new Error("GraphicsMagick produced empty output"));
        } else {
          resolve(buffer);
        }
      });

      stdout.on("error", (err) => {
        reject(err);
      });

      stderr.on("data", (data) => {
        console.error("GM stderr:", data.toString());
      });
    });
  });
}

/**
 * Get supported dithering methods
 * @returns {string[]} Array of method names
 */
export function getSupportedMethods() {
  return ["floyd-steinberg", "ordered", "none"];
}

/**
 * Get supported bit depths
 * @returns {number[]} Array of bit depths
 */
export function getSupportedBitDepths() {
  return [1, 2, 4, 8];
}

/**
 * Validate dithering options
 * @param {Object} options - Options to validate
 * @returns {Object} - Validated options with defaults applied
 */
export function validateOptions(options = {}) {
  const validMethods = getSupportedMethods();
  const validBitDepths = getSupportedBitDepths();

  return {
    method: validMethods.includes(options.method)
      ? options.method
      : "floyd-steinberg",
    bitDepth: validBitDepths.includes(options.bitDepth) ? options.bitDepth : 2,
    gammaCorrection:
      options.gammaCorrection !== undefined ? options.gammaCorrection : true,
    blackLevel: Math.max(0, Math.min(100, options.blackLevel || 0)),
    whiteLevel: Math.max(0, Math.min(100, options.whiteLevel || 100)),
  };
}
