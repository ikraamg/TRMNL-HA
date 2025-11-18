# API Reference

Complete API reference for all public modules and functions in the Puppet add-on.

## Table of Contents

- [Dithering Module](#dithering-module)
- [Image Comparison Helpers](#image-comparison-helpers)
- [Browser Class](#browser-class)
- [Scheduler Class](#scheduler-class)

---

## Dithering Module

**Location:** `lib/dithering.js`

Advanced image dithering for e-ink displays with Floyd-Steinberg and Ordered algorithms.

### applyDithering(imageBuffer, options)

Apply advanced dithering to image buffer for e-ink displays.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `imageBuffer` | `Buffer` | required | Input image buffer (PNG, JPEG, WebP, etc.) |
| `options` | `Object` | `{}` | Dithering configuration |
| `options.method` | `string` | `'floyd-steinberg'` | Dithering method: `'floyd-steinberg'`, `'ordered'`, `'none'` |
| `options.bitDepth` | `number` | `4` | Target bit depth: `1`, `2`, `4`, or `8` |
| `options.gammaCorrection` | `boolean` | `true` | Remove gamma correction for e-ink displays |
| `options.blackLevel` | `number` | `0` | Black crush level (0-100) |
| `options.whiteLevel` | `number` | `100` | White crush level (0-100) |

**Returns:** `Promise<Buffer>` - Dithered image buffer in PNG format

**Throws:** `Error` if:
- `imageBuffer` is not a Buffer
- Invalid dithering method
- Invalid bit depth
- Invalid level values
- Processing fails

**Example:**

```javascript
import { applyDithering } from './lib/dithering.js';

// 2-bit grayscale with Floyd-Steinberg (recommended for most e-ink)
const dithered = await applyDithering(imageBuffer, {
  method: 'floyd-steinberg',
  bitDepth: 2,
  gammaCorrection: true
});

// 1-bit pure black and white (highest contrast)
const bw = await applyDithering(imageBuffer, {
  method: 'floyd-steinberg',
  bitDepth: 1
});

// 4-bit high quality (16 gray levels)
const highQuality = await applyDithering(imageBuffer, {
  method: 'floyd-steinberg',
  bitDepth: 4,
  blackLevel: 10,   // Crush darker grays
  whiteLevel: 90    // Crush lighter grays
});

// No dithering (simple posterization)
const simple = await applyDithering(imageBuffer, {
  method: 'none',
  bitDepth: 8
});
```

**Performance:**
- Small images (100x100): ~100ms
- Medium images (800x600): ~200ms
- Large images (1920x1080): ~500ms

**Notes:**
- Gamma correction is critical for e-ink displays - keep enabled
- Floyd-Steinberg produces best quality for photos/complex images
- Ordered is faster but may show dot patterns
- Output is always PNG format regardless of input

---

### getSupportedMethods()

Get information about supported dithering methods.

**Parameters:** None

**Returns:** `Object` - Supported methods with descriptions

**Example:**

```javascript
import { getSupportedMethods } from './lib/dithering.js';

const methods = getSupportedMethods();

console.log(methods);
// {
//   'floyd-steinberg': {
//     description: 'Error diffusion dithering - best quality for most images',
//     recommended: true,
//     bitDepths: [1, 2, 4, 8]
//   },
//   'ordered': {
//     description: 'Pattern-based dithering - faster but can show patterns',
//     recommended: false,
//     bitDepths: [1, 2, 4, 8]
//   },
//   'none': {
//     description: 'No dithering - simple posterization',
//     recommended: false,
//     bitDepths: [1, 2, 4, 8]
//   }
// }
```

---

### validateOptions(options)

Validate dithering options.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `Object` | Yes | Options to validate |
| `options.method` | `string` | No | Dithering method |
| `options.bitDepth` | `number` | No | Target bit depth |
| `options.blackLevel` | `number` | No | Black level (0-100) |
| `options.whiteLevel` | `number` | No | White level (0-100) |

**Returns:** `boolean` - `true` if valid

**Throws:** `Error` if options are invalid

**Example:**

```javascript
import { validateOptions } from './lib/dithering.js';

try {
  validateOptions({ method: 'floyd-steinberg', bitDepth: 2 });
  console.log('Options are valid');
} catch (error) {
  console.error('Invalid options:', error.message);
}

// Throws: Invalid method
validateOptions({ method: 'invalid' });

// Throws: Invalid bit depth
validateOptions({ bitDepth: 3 });

// Throws: blackLevel must be less than whiteLevel
validateOptions({ blackLevel: 60, whiteLevel: 50 });
```

---

## Image Comparison Helpers

**Location:** `tests/helpers/imageComparison.js`

Utilities for comparing images in visual regression tests.

### compareImages(buffer1, buffer2, options)

Compare two image buffers pixel-by-pixel.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `buffer1` | `Buffer` | required | First image buffer (PNG) |
| `buffer2` | `Buffer` | required | Second image buffer (PNG) |
| `options` | `Object` | `{}` | Comparison options |
| `options.threshold` | `number` | `0.1` | Pixel matching threshold (0-1) |

**Returns:** `Promise<Object>` - Comparison result

**Result Object:**
```javascript
{
  numDiffPixels: 1234,           // Number of different pixels
  totalPixels: 384000,           // Total pixels in image
  percentageDifference: 0.32,    // Percentage different (0-100)
  diffBuffer: <Buffer>,          // Visual diff image (PNG)
  width: 800,                    // Image width
  height: 480                    // Image height
}
```

**Throws:** `Error` if image dimensions don't match

**Example:**

```javascript
import { compareImages } from '../helpers/imageComparison.js';

const diff = await compareImages(actualBuffer, expectedBuffer);

console.log(`Difference: ${diff.percentageDifference}%`);
console.log(`Different pixels: ${diff.numDiffPixels}/${diff.totalPixels}`);

if (diff.percentageDifference < 1) {
  console.log('Images match!');
}

// Save diff image
writeFileSync('diff.png', diff.diffBuffer);
```

---

### areImagesSimilar(buffer1, buffer2, maxDifferencePercent)

Check if two images are visually similar within tolerance.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `buffer1` | `Buffer` | required | First image |
| `buffer2` | `Buffer` | required | Second image |
| `maxDifferencePercent` | `number` | `1` | Maximum allowed difference (%) |

**Returns:** `Promise<boolean>` - `true` if similar, `false` otherwise

**Example:**

```javascript
import { areImagesSimilar } from '../helpers/imageComparison.js';

// Allow up to 1% difference
const areSimilar = await areImagesSimilar(actual, expected, 1);
expect(areSimilar).toBe(true);

// Strict comparison (0.1% tolerance)
const areIdentical = await areImagesSimilar(actual, expected, 0.1);
```

---

### generateComparisonImage(inputBuffer, expectedBuffer, actualBuffer, diffBuffer)

Generate side-by-side comparison image showing Input | Expected | Actual | Diff.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `inputBuffer` | `Buffer` | Original input image |
| `expectedBuffer` | `Buffer` | Expected output |
| `actualBuffer` | `Buffer` | Actual output |
| `diffBuffer` | `Buffer` | Difference image from compareImages |

**Returns:** `Promise<Buffer>` - Composite comparison image

**Example:**

```javascript
import { generateComparisonImage, compareImages } from '../helpers/imageComparison.js';

const diff = await compareImages(actual, expected);
const comparison = await generateComparisonImage(
  input,
  expected,
  actual,
  diff.diffBuffer
);

writeFileSync('comparison.png', comparison);
```

---

### getColorHistogram(buffer)

Analyze color distribution in image.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffer` | `Buffer` | Image buffer |

**Returns:** `Promise<Object>` - Histogram data

**Result Object:**
```javascript
{
  uniqueColors: 16,              // Number of unique colors
  totalPixels: 384000,           // Total pixels
  colors: [                      // Sorted by frequency
    { color: 255, count: 50000 },
    { color: 128, count: 30000 },
    // ...
  ]
}
```

**Example:**

```javascript
import { getColorHistogram } from '../helpers/imageComparison.js';

const histogram = await getColorHistogram(ditheredImage);

console.log(`Unique colors: ${histogram.uniqueColors}`);

// Verify 2-bit image has ~4 colors
expect(histogram.uniqueColors).toBeLessThanOrEqual(20);
```

---

## Browser Class

**Location:** `screenshot.js`

Manages Chromium browser lifecycle and screenshot capture.

### Constructor

```javascript
new Browser(homeAssistantUrl, token)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `homeAssistantUrl` | `string` | Base URL of Home Assistant instance |
| `token` | `string` | Long-lived access token |

**Example:**

```javascript
import { Browser } from './screenshot.js';

const browser = new Browser('http://homeassistant:8123', 'your_token');
```

---

### navigatePage(options)

Navigate to Home Assistant dashboard.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `options.pagePath` | `string` | required | Dashboard path (e.g., `/lovelace/0`) |
| `options.viewport` | `Object` | required | `{width, height}` |
| `options.extraWait` | `number` | auto | Extra wait time (ms) after load |
| `options.zoom` | `number` | `1.0` | Zoom level |
| `options.lang` | `string` | `'en'` | Language code |
| `options.theme` | `string` | | Theme name |
| `options.dark` | `boolean` | `false` | Enable dark mode |

**Returns:** `Promise<Object>` - `{time: milliseconds}`

**Example:**

```javascript
const result = await browser.navigatePage({
  pagePath: '/lovelace/kitchen',
  viewport: { width: 800, height: 480 },
  zoom: 1.2,
  lang: 'de',
  theme: 'midnight',
  dark: true
});

console.log(`Navigated in ${result.time}ms`);
```

---

### screenshotPage(options)

Capture screenshot of current page.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `options.viewport` | `Object` | required | `{width, height}` |
| `options.zoom` | `number` | `1.0` | Zoom level |
| `options.format` | `string` | `'png'` | Output format: `png`, `jpeg`, `webp`, `bmp` |
| `options.rotate` | `number` | `0` | Rotation: `90`, `180`, `270` |
| `options.dithering` | `Object` | | Dithering options (see Dithering Module) |
| `options.dithering.enabled` | `boolean` | `false` | Enable advanced dithering |
| `options.dithering.method` | `string` | | Dithering method |
| `options.dithering.bitDepth` | `number` | | Target bit depth |

**Returns:** `Promise<Object>` - `{image: Buffer, time: milliseconds}`

**Example:**

```javascript
const result = await browser.screenshotPage({
  viewport: { width: 800, height: 480 },
  format: 'png',
  rotate: 90,
  dithering: {
    enabled: true,
    method: 'floyd-steinberg',
    bitDepth: 2,
    gammaCorrection: true
  }
});

console.log(`Screenshot captured in ${result.time}ms`);
writeFileSync('output.png', result.image);
```

---

### cleanup()

Close browser and cleanup resources.

**Returns:** `Promise<void>`

**Example:**

```javascript
// Always cleanup when done
await browser.cleanup();
```

---

## Scheduler Class

**Location:** `scheduler.js`

Manages cron-based scheduled screenshot jobs.

### Constructor

```javascript
new Scheduler()
```

Creates scheduler instance with browser from config.

---

### start()

Start all configured cron jobs.

**Returns:** `void`

**Example:**

```javascript
import { Scheduler } from './scheduler.js';

const scheduler = new Scheduler();
scheduler.start();

console.log('Scheduler started');
```

---

### stop()

Stop all cron jobs and cleanup browser.

**Returns:** `Promise<void>`

**Example:**

```javascript
// Graceful shutdown
await scheduler.stop();
```

---

### parseViewport(viewportString)

Parse viewport string into width/height object.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `viewportString` | `string` | Format: `"WIDTHxHEIGHT"` |

**Returns:** `Object` - `{width: number, height: number}`

**Throws:** `Error` if format is invalid

**Example:**

```javascript
const viewport = scheduler.parseViewport('800x480');
// { width: 800, height: 480 }

// Invalid format throws error
scheduler.parseViewport('800-480');  // Error
```

---

### uploadToWebhook(webhookUrl, imageBuffer, format)

Upload image to webhook via HTTP PUT.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `webhookUrl` | `string` | HTTP endpoint URL |
| `imageBuffer` | `Buffer` | Image data |
| `format` | `string` | Image format: `png`, `jpeg`, `webp`, `bmp` |

**Returns:** `Promise<Response>` - Fetch response object

**Throws:** `Error` if upload fails

**Example:**

```javascript
await scheduler.uploadToWebhook(
  'https://my-server.com/upload',
  imageBuffer,
  'png'
);
```

---

## Type Definitions

### DitheringOptions

```typescript
type DitheringOptions = {
  method?: 'floyd-steinberg' | 'ordered' | 'none';
  bitDepth?: 1 | 2 | 4 | 8;
  gammaCorrection?: boolean;
  blackLevel?: number;  // 0-100
  whiteLevel?: number;  // 0-100
};
```

### Viewport

```typescript
type Viewport = {
  width: number;
  height: number;
};
```

### Schedule

```typescript
type Schedule = {
  name?: string;
  cron: string;
  dashboard_path: string;
  viewport: string;
  webhook_url: string;
  wait?: number;
  format?: 'png' | 'jpeg' | 'webp' | 'bmp';
  rotate?: 90 | 180 | 270;
  zoom?: number;
  lang?: string;
  theme?: string;
  dark?: boolean;
  dithering?: {
    enabled?: boolean;
    method?: 'floyd-steinberg' | 'ordered' | 'none';
    bit_depth?: 1 | 2 | 4 | 8;
    gamma_correction?: boolean;
    black_level?: number;
    white_level?: number;
  };
};
```

---

## Error Handling

### Common Errors

**CannotOpenPageError**
```javascript
class CannotOpenPageError extends Error {
  constructor(status, url)
}
```

Thrown when HTTP request to dashboard fails.

**Example:**
```javascript
try {
  await browser.navigatePage({
    pagePath: '/invalid/path',
    viewport: { width: 800, height: 480 }
  });
} catch (error) {
  if (error instanceof CannotOpenPageError) {
    console.error(`Failed to open page (HTTP ${error.status})`);
  }
}
```

---

## Best Practices

### Performance

```javascript
// ✅ Reuse browser instance
const browser = new Browser(url, token);
await browser.navigatePage(...);
await browser.screenshotPage(...);  // Fast!
await browser.cleanup();

// ❌ Don't create new instance each time
const browser1 = new Browser(url, token);
await browser1.navigatePage(...);
await browser1.cleanup();

const browser2 = new Browser(url, token);  // Slow!
await browser2.navigatePage(...);
await browser2.cleanup();
```

### Error Handling

```javascript
// ✅ Handle errors gracefully
try {
  const result = await applyDithering(buffer, options);
  return result;
} catch (error) {
  console.error('Dithering failed:', error.message);
  // Fallback or retry logic
  return originalBuffer;
}
```

### Resource Cleanup

```javascript
// ✅ Always cleanup
const browser = new Browser(url, token);
try {
  await browser.navigatePage(...);
  const screenshot = await browser.screenshotPage(...);
  return screenshot;
} finally {
  await browser.cleanup();  // Runs even if error
}
```

---

**Need more details?** Check the source code or open a GitHub Discussion.
