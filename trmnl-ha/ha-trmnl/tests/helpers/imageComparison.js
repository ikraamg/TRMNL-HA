import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';

/**
 * Image Comparison Utilities for Visual Regression Testing
 *
 * Provides functions to compare images pixel-by-pixel and generate
 * visual difference reports for testing dithering algorithms.
 *
 * @module tests/helpers/imageComparison
 */

/**
 * Compare two image buffers and return difference metrics
 *
 * @param {Buffer} buffer1 - First image buffer (PNG)
 * @param {Buffer} buffer2 - Second image buffer (PNG)
 * @param {Object} [options={}] - Comparison options
 * @param {number} [options.threshold=0.1] - Pixel matching threshold (0-1)
 * @returns {Promise<Object>} Comparison result with metrics
 *
 * @example
 * const diff = await compareImages(actualBuffer, expectedBuffer);
 * console.log(`Difference: ${diff.percentageDifference}%`);
 * if (diff.percentageDifference < 1) {
 *   console.log('Images match!');
 * }
 */
export async function compareImages(buffer1, buffer2, options = {}) {
  const { threshold = 0.1 } = options;

  // Ensure both images are PNG format
  const png1Buffer = await ensurePNG(buffer1);
  const png2Buffer = await ensurePNG(buffer2);

  // Parse PNG buffers
  const img1 = PNG.sync.read(png1Buffer);
  const img2 = PNG.sync.read(png2Buffer);

  // Check dimensions match
  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(
      `Image dimensions don't match: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`
    );
  }

  // Create diff image
  const diff = new PNG({ width: img1.width, height: img1.height });

  // Compare pixels
  const numDiffPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    img1.width,
    img1.height,
    { threshold }
  );

  const totalPixels = img1.width * img1.height;
  const percentageDifference = (numDiffPixels / totalPixels) * 100;

  return {
    numDiffPixels,
    totalPixels,
    percentageDifference: parseFloat(percentageDifference.toFixed(2)),
    diffBuffer: PNG.sync.write(diff),
    width: img1.width,
    height: img1.height,
  };
}

/**
 * Ensure buffer is in PNG format
 *
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Buffer>} PNG buffer
 */
async function ensurePNG(buffer) {
  const metadata = await sharp(buffer).metadata();

  if (metadata.format === 'png') {
    return buffer;
  }

  // Convert to PNG
  return await sharp(buffer).png().toBuffer();
}

/**
 * Generate a side-by-side comparison image
 *
 * Creates an image showing: Input | Expected | Actual | Diff
 *
 * @param {Buffer} inputBuffer - Original input image
 * @param {Buffer} expectedBuffer - Expected output image
 * @param {Buffer} actualBuffer - Actual output image
 * @param {Buffer} diffBuffer - Difference image from compareImages
 * @returns {Promise<Buffer>} Composite comparison image
 *
 * @example
 * const comparison = await generateComparisonImage(
 *   input, expected, actual, diff.diffBuffer
 * );
 * await fs.writeFile('comparison.png', comparison);
 */
export async function generateComparisonImage(
  inputBuffer,
  expectedBuffer,
  actualBuffer,
  diffBuffer
) {
  // Resize all to same height for comparison
  const targetHeight = 400;

  const [input, expected, actual, diff] = await Promise.all([
    sharp(inputBuffer).resize(null, targetHeight).toBuffer(),
    sharp(expectedBuffer).resize(null, targetHeight).toBuffer(),
    sharp(actualBuffer).resize(null, targetHeight).toBuffer(),
    sharp(diffBuffer).resize(null, targetHeight).toBuffer(),
  ]);

  // Get metadata to calculate widths
  const [inputMeta, expectedMeta, actualMeta, diffMeta] = await Promise.all([
    sharp(input).metadata(),
    sharp(expected).metadata(),
    sharp(actual).metadata(),
    sharp(diff).metadata(),
  ]);

  const totalWidth = inputMeta.width + expectedMeta.width + actualMeta.width + diffMeta.width + 30; // 10px padding between each
  const padding = 10;

  // Create composite image
  const composite = await sharp({
    create: {
      width: totalWidth,
      height: targetHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: input, left: 0, top: 0 },
      { input: expected, left: inputMeta.width + padding, top: 0 },
      { input: actual, left: inputMeta.width + expectedMeta.width + padding * 2, top: 0 },
      {
        input: diff,
        left: inputMeta.width + expectedMeta.width + actualMeta.width + padding * 3,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

  return composite;
}

/**
 * Check if two images are visually similar within tolerance
 *
 * @param {Buffer} buffer1 - First image
 * @param {Buffer} buffer2 - Second image
 * @param {number} [maxDifferencePercent=1] - Maximum allowed difference percentage
 * @returns {Promise<boolean>} True if images are similar
 *
 * @example
 * const areSimilar = await areImagesSimilar(actual, expected, 0.5);
 * expect(areSimilar).toBe(true);
 */
export async function areImagesSimilar(buffer1, buffer2, maxDifferencePercent = 1) {
  try {
    const result = await compareImages(buffer1, buffer2);
    return result.percentageDifference <= maxDifferencePercent;
  } catch (error) {
    console.error('Image comparison failed:', error.message);
    return false;
  }
}

/**
 * Get color histogram from image
 *
 * Useful for verifying bit depth reduction
 *
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} Histogram data
 *
 * @example
 * const histogram = await getColorHistogram(ditheredImage);
 * console.log(`Unique colors: ${histogram.uniqueColors}`);
 */
export async function getColorHistogram(buffer) {
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const colorCounts = {};
  const channels = info.channels;

  for (let i = 0; i < data.length; i += channels) {
    // For grayscale, just use first channel
    const value = data[i];
    colorCounts[value] = (colorCounts[value] || 0) + 1;
  }

  const uniqueColors = Object.keys(colorCounts).length;
  const sortedColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([color, count]) => ({ color: parseInt(color), count }));

  return {
    uniqueColors,
    totalPixels: data.length / channels,
    colors: sortedColors,
  };
}

export default {
  compareImages,
  generateComparisonImage,
  areImagesSimilar,
  getColorHistogram,
};
