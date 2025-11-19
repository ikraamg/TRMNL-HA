/**
 * Configuration constants for the TRMNL HA add-on
 * @module const
 */

import { readFileSync, existsSync } from "fs";

// =============================================================================
// OPTIONS FILE LOADING
// =============================================================================

/**
 * Searches for and loads the first available options file
 * Priority: local dev file first, then add-on data path
 */
const optionsFile = ["./options-dev.json", "/data/options.json"].find(existsSync);

if (!optionsFile) {
  console.error(
    "No options file found. Please copy options-dev.json.sample to options-dev.json"
  );
  process.exit(1);
}

const options = JSON.parse(readFileSync(optionsFile));

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

/**
 * Whether running as Home Assistant add-on (true) or local development (false)
 * @type {boolean}
 */
export const isAddOn = optionsFile === "/data/options.json";

// =============================================================================
// HOME ASSISTANT CONNECTION
// =============================================================================

/**
 * Home Assistant base URL
 * @type {string}
 */
export const hassUrl = isAddOn
  ? (options.home_assistant_url || "http://homeassistant:8123")
  : (options.home_assistant_url || "http://localhost:8123");

/**
 * Long-lived access token for Home Assistant authentication
 * @type {string|undefined}
 */
export const hassToken = options.access_token;

if (!hassToken) {
  console.warn("No access token configured. UI will show configuration instructions.");
}

// =============================================================================
// BROWSER CONFIGURATION
// =============================================================================

/**
 * Path to Chromium/Chrome executable
 * @type {string}
 */
export const chromiumExecutable = isAddOn
  ? "/usr/bin/chromium"
  : (options.chromium_executable || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");

/**
 * Keep browser instance open between requests for performance
 * @type {boolean}
 */
export const keepBrowserOpen = options.keep_browser_open || false;

/**
 * Enable debug logging
 * @type {boolean}
 */
export const debug = false;

// =============================================================================
// SERVER CONFIGURATION
// =============================================================================

/**
 * HTTP server port
 * @type {number}
 */
export const SERVER_PORT = 10000;

/**
 * Browser idle timeout before cleanup (milliseconds)
 * @type {number}
 */
export const BROWSER_TIMEOUT = 30_000;

/**
 * Maximum queued "next" requests to prevent runaway loops
 * @type {number}
 */
export const MAX_NEXT_REQUESTS = 100;

// =============================================================================
// SCREENSHOT CONFIGURATION
// =============================================================================

/**
 * Home Assistant header height in pixels (clipped from screenshots)
 * @type {number}
 */
export const HEADER_HEIGHT = 56;

/**
 * Valid output image formats
 * @type {string[]}
 */
export const VALID_FORMATS = ["png", "jpeg", "webp", "bmp"];

/**
 * Valid rotation angles in degrees
 * @type {number[]}
 */
export const VALID_ROTATIONS = [90, 180, 270];

/**
 * Valid bits per pixel for BMP encoding
 * @type {number[]}
 */
export const VALID_BIT_DEPTHS = [1, 2, 4, 8];

/**
 * Valid e-ink color palette sizes
 * @type {number[]}
 */
export const VALID_EINK_COLORS = [2, 4, 7, 16, 256];

/**
 * Default wait time after page load (milliseconds)
 * Add-on uses longer time due to slower environment
 * @type {number}
 */
export const DEFAULT_WAIT_TIME = isAddOn ? 750 : 500;

/**
 * Extra wait time on cold start for icons/images to load (milliseconds)
 * @type {number}
 */
export const COLD_START_EXTRA_WAIT = 2500;

/**
 * Content-Type headers for each output format
 * @type {Object.<string, string>}
 */
export const CONTENT_TYPES = {
  jpeg: "image/jpeg",
  webp: "image/webp",
  bmp: "image/bmp",
  png: "image/png"
};
