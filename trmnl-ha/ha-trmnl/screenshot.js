/**
 * Browser automation for capturing Home Assistant screenshots
 * @module screenshot
 */

import puppeteer from "puppeteer";
import sharp from "sharp";
import { BMPEncoder } from "./bmp.js";
import {
  debug,
  isAddOn,
  chromiumExecutable,
  HEADER_HEIGHT,
  DEFAULT_WAIT_TIME,
  COLD_START_EXTRA_WAIT
} from "./const.js";
import { CannotOpenPageError } from "./error.js";
import { applyDithering } from "./lib/dithering.js";

// =============================================================================
// BROWSER CONFIGURATION
// =============================================================================

/**
 * Default localStorage values for Home Assistant UI
 * Values are JSON stringified as they would appear in storage
 */
const HASS_LOCAL_STORAGE_DEFAULTS = {
  dockedSidebar: `"always_hidden"`,
  selectedTheme: `{"dark": false}`
};

/**
 * Puppeteer launch arguments optimized for headless screenshot capture
 * Based on: https://www.bannerbear.com/blog/ways-to-speed-up-puppeteer-screenshots/
 */
const PUPPETEER_ARGS = [
  // Disable unnecessary background processes
  "--autoplay-policy=user-gesture-required",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-hang-monitor",
  "--disable-renderer-backgrounding",

  // Disable security features (safe in headless context)
  "--disable-client-side-phishing-detection",
  "--disable-setuid-sandbox",
  "--no-sandbox",
  "--no-zygote",

  // Disable unneeded features
  "--disable-dev-shm-usage",
  "--disable-domain-reliability",
  "--disable-features=AudioServiceOutOfProcess",
  "--disable-ipc-flooding-protection",
  "--disable-notifications",
  "--disable-offer-store-unmasked-wallet-cards",
  "--disable-popup-blocking",
  "--disable-print-preview",
  "--disable-prompt-on-repost",
  "--disable-speech-api",
  "--disable-sync",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-default-browser-check",
  "--no-first-run",
  "--no-pings",

  // UI optimizations
  "--hide-scrollbars",
  "--ignore-gpu-blacklist",
  "--use-gl=swiftshader",

  // Credential handling
  "--password-store=basic",
  "--use-mock-keychain",

  // Add low-end device mode for resource-constrained environments
  ...(isAddOn ? ["--enable-low-end-device-mode"] : [])
];

// =============================================================================
// BROWSER CLASS
// =============================================================================

/**
 * Manages Puppeteer browser instance for Home Assistant screenshots
 * Handles browser lifecycle, page navigation, authentication, and image capture
 * @class
 */
export class Browser {
  /**
   * @param {string} homeAssistantUrl - Base URL of Home Assistant instance
   * @param {string} token - Long-lived access token for authentication
   */
  constructor(homeAssistantUrl, token) {
    this.homeAssistantUrl = homeAssistantUrl;
    this.token = token;

    /** @type {import('puppeteer').Browser|undefined} */
    this.browser = undefined;

    /** @type {import('puppeteer').Page|undefined} */
    this.page = undefined;

    /** @type {boolean} Whether browser is currently processing */
    this.busy = false;

    // Cache last requested values to avoid unnecessary page updates
    // NOTE: We store path instead of using page.url() because panels can redirect (e.g., / -> /lovelace/0)
    this.lastRequestedPath = undefined;
    this.lastRequestedLang = undefined;
    this.lastRequestedTheme = undefined;
    this.lastRequestedDarkMode = undefined;
  }

  // ===========================================================================
  // BROWSER LIFECYCLE
  // ===========================================================================

  /**
   * Cleans up browser and page resources
   * Resets all cached state for fresh start
   */
  async cleanup() {
    const { browser, page } = this;

    if (!browser && !page) return;

    // Reset all state
    this.page = undefined;
    this.browser = undefined;
    this.lastRequestedPath = undefined;
    this.lastRequestedLang = undefined;
    this.lastRequestedTheme = undefined;
    this.lastRequestedDarkMode = undefined;

    // Close page first, then browser
    try {
      if (page) await page.close();
    } catch (err) {
      console.error("Error closing page during cleanup:", err);
    }

    try {
      if (browser) await browser.close();
    } catch (err) {
      console.error("Error closing browser during cleanup:", err);
    }

    console.log("Closed browser");
  }

  /**
   * Gets or creates a Puppeteer page instance
   * Launches browser on first call and sets up event logging
   * @returns {Promise<import('puppeteer').Page>} The page instance
   */
  async getPage() {
    if (this.page) return this.page;

    console.log("Starting browser");

    // Launch browser - errors here are unrecoverable
    const browser = await puppeteer.launch({
      headless: "shell",
      executablePath: chromiumExecutable,
      args: PUPPETEER_ARGS
    });

    const page = await browser.newPage();

    // Set up event logging for debugging
    this.setupPageLogging(page);

    this.browser = browser;
    this.page = page;
    return this.page;
  }

  /**
   * Configures page event handlers for logging
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   * @private
   */
  setupPageLogging(page) {
    page
      .on("framenavigated", (frame) =>
        console.log("Frame navigated", frame.url())
      )
      .on("console", (message) =>
        console.log(`CONSOLE ${message.type().slice(0, 3).toUpperCase()} ${message.text()}`)
      )
      .on("error", (err) => console.error("ERROR", err))
      .on("pageerror", ({ message }) => console.log("PAGE ERROR", message))
      .on("requestfailed", (request) =>
        console.log(`REQUEST-FAILED ${request.failure().errorText} ${request.url()}`)
      );

    // Verbose response logging in debug mode
    if (debug) {
      page.on("response", (response) =>
        console.log(`RESPONSE ${response.status()} ${response.url()} (cache: ${response.fromCache()})`)
      );
    }
  }

  // ===========================================================================
  // NAVIGATION HELPERS
  // ===========================================================================

  /**
   * Builds auth token localStorage object for Home Assistant
   * @returns {Object} localStorage entries to inject
   * @private
   */
  buildAuthStorage() {
    const clientId = new URL("/", this.homeAssistantUrl).toString();
    const hassUrl = clientId.slice(0, -1); // Remove trailing slash

    return {
      ...HASS_LOCAL_STORAGE_DEFAULTS,
      hassTokens: JSON.stringify({
        access_token: this.token,
        token_type: "Bearer",
        expires_in: 1800,
        hassUrl,
        clientId,
        expires: 9999999999999, // Far future expiry
        refresh_token: ""
      })
    };
  }

  /**
   * Waits for Home Assistant page to finish loading
   * Checks for home-assistant element and panel resolver
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   * @private
   */
  async waitForPageLoad(page) {
    try {
      await page.waitForFunction(
        () => {
          const haEl = document.querySelector("home-assistant");
          if (!haEl) return false;

          const mainEl = haEl.shadowRoot?.querySelector("home-assistant-main");
          if (!mainEl) return false;

          const panelResolver = mainEl.shadowRoot?.querySelector("partial-panel-resolver");
          if (!panelResolver || panelResolver._loading) return false;

          const panel = panelResolver.children[0];
          if (!panel) return false;

          return !("_loading" in panel) || !panel._loading;
        },
        { timeout: 10000, polling: 100 }
      );
    } catch (err) {
      console.log("Timeout waiting for HA to finish loading");
    }
  }

  /**
   * Dismisses any visible toast notifications and sets zoom level
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   * @param {number} zoom - Zoom level to apply
   * @returns {Promise<boolean>} Whether a toast was dismissed
   * @private
   */
  async dismissToastsAndSetZoom(page, zoom) {
    return page.evaluate((zoomLevel) => {
      document.body.style.zoom = zoomLevel;

      // Try to find and dismiss toast notification
      const haEl = document.querySelector("home-assistant");
      if (!haEl) return false;

      const notifyEl = haEl.shadowRoot?.querySelector("notification-manager");
      if (!notifyEl) return false;

      const actionEl = notifyEl.shadowRoot.querySelector("ha-toast *[slot=action]");
      if (!actionEl) return false;

      actionEl.click();
      return true;
    }, zoom);
  }

  /**
   * Updates language setting in Home Assistant
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   * @param {string|undefined} lang - Language code or undefined for default
   * @private
   */
  async updateLanguage(page, lang) {
    await page.evaluate((newLang) => {
      document.querySelector("home-assistant")._selectLanguage(newLang, false);
    }, lang || "en");
  }

  /**
   * Updates theme and dark mode settings
   * @param {import('puppeteer').Page} page - Puppeteer page instance
   * @param {string|undefined} theme - Theme name
   * @param {boolean} dark - Whether to enable dark mode
   * @private
   */
  async updateTheme(page, theme, dark) {
    await page.evaluate(
      ({ theme, dark }) => {
        document.querySelector("home-assistant").dispatchEvent(
          new CustomEvent("settheme", {
            detail: { theme, dark }
          })
        );
      },
      { theme: theme || "", dark }
    );
  }

  // ===========================================================================
  // IMAGE PROCESSING HELPERS
  // ===========================================================================

  /**
   * Converts Sharp instance to requested output format
   * @param {import('sharp').Sharp} sharpInstance - Sharp image instance
   * @param {string} format - Output format (png, jpeg, webp, bmp)
   * @param {Object} options - Additional options
   * @param {number} [options.bitsPerPixel] - Bits per pixel for BMP
   * @param {number} [options.width] - Image width for BMP
   * @param {number} [options.height] - Image height for BMP
   * @param {number} [options.einkColors] - E-ink color count for PNG
   * @returns {Promise<Buffer>} Encoded image buffer
   * @private
   */
  async convertToFormat(sharpInstance, format, options = {}) {
    if (format === "jpeg") {
      return sharpInstance.jpeg().toBuffer();
    }

    if (format === "webp") {
      return sharpInstance.webp().toBuffer();
    }

    if (format === "bmp") {
      const { data, info } = await sharpInstance.raw().toBuffer({ resolveWithObject: true });
      const bitsPerPixel = options.bitsPerPixel || 24;
      const bmpEncoder = new BMPEncoder(info.width, info.height, bitsPerPixel);
      return bmpEncoder.encode(data);
    }

    // PNG with optional color reduction
    if (options.einkColors) {
      return sharpInstance.png({ colours: options.einkColors }).toBuffer();
    }

    return sharpInstance.png().toBuffer();
  }

  /**
   * Maps e-ink color count to bits per pixel for BMP encoding
   * @param {number} einkColors - Number of colors
   * @returns {number} Bits per pixel
   * @private
   */
  einkColorsToBpp(einkColors) {
    if (einkColors === 2) return 1;
    if (einkColors === 4) return 2;
    if (einkColors === 16) return 4;
    return 8;
  }

  // ===========================================================================
  // MAIN PUBLIC METHODS
  // ===========================================================================

  /**
   * Navigates to a Home Assistant page and applies settings
   * @param {Object} params - Navigation parameters
   * @param {string} params.pagePath - Page path to navigate to
   * @param {Object} params.viewport - Viewport dimensions {width, height}
   * @param {number} [params.extraWait] - Additional wait time in ms
   * @param {number} [params.zoom=1] - Zoom level
   * @param {string} [params.lang] - Language code
   * @param {string} [params.theme] - Theme name
   * @param {boolean} [params.dark=false] - Enable dark mode
   * @returns {Promise<{time: number}>} Navigation timing result
   * @throws {Error} If browser is busy
   * @throws {CannotOpenPageError} If page fails to load
   */
  async navigatePage({ pagePath, viewport, extraWait, zoom = 1, lang, theme, dark }) {
    if (this.busy) throw new Error("Browser is busy");

    const start = Date.now();
    this.busy = true;
    const headerHeight = Math.round(HEADER_HEIGHT * zoom);

    try {
      const page = await this.getPage();

      // Add header height to viewport (will be clipped in screenshot)
      viewport.height += headerHeight;

      // Update viewport if changed
      const curViewport = page.viewport();
      if (!curViewport || curViewport.width !== viewport.width || curViewport.height !== viewport.height) {
        await page.setViewport(viewport);
      }

      let waitTime = DEFAULT_WAIT_TIME;
      let isFirstNavigation = false;

      // Handle navigation based on current state
      if (this.lastRequestedPath === undefined) {
        // First navigation - inject auth and open page
        isFirstNavigation = true;

        const browserLocalStorage = this.buildAuthStorage();
        const evaluateId = await page.evaluateOnNewDocument(
          (storage) => {
            for (const [key, value] of Object.entries(storage)) {
              localStorage.setItem(key, value);
            }
          },
          browserLocalStorage
        );

        const pageUrl = new URL(pagePath, this.homeAssistantUrl).toString();
        const response = await page.goto(pageUrl);

        if (!response.ok()) {
          throw new CannotOpenPageError(response.status(), pageUrl);
        }

        page.removeScriptToEvaluateOnNewDocument(evaluateId.identifier);

        // Add extra wait for cold start (loading icons, images, etc.)
        if (isAddOn) waitTime += COLD_START_EXTRA_WAIT;

      } else if (this.lastRequestedPath !== pagePath) {
        // Navigate without full reload using HA's internal navigation
        await page.evaluate((path) => {
          history.replaceState(
            history.state?.root ? { root: true } : null,
            "",
            path
          );
          const event = new Event("location-changed");
          event.detail = { replace: true };
          window.dispatchEvent(event);
        }, pagePath);

      } else {
        // Already on correct page - minimal wait
        waitTime = 0;
      }

      this.lastRequestedPath = pagePath;

      // Dismiss toasts and set zoom (only if not first navigation)
      if (!isFirstNavigation) {
        const dismissedToast = await this.dismissToastsAndSetZoom(page, zoom);
        if (dismissedToast) waitTime += 1000;
      } else {
        await page.evaluate((zoomLevel) => {
          document.body.style.zoom = zoomLevel;
        }, zoom);
      }

      // Wait for page to fully load
      await this.waitForPageLoad(page);

      // Update language if changed
      if (lang !== this.lastRequestedLang) {
        await this.updateLanguage(page, lang);
        this.lastRequestedLang = lang;
        waitTime += 1000;
      }

      // Update theme if changed
      if (theme !== this.lastRequestedTheme || dark !== this.lastRequestedDarkMode) {
        await this.updateTheme(page, theme, dark);
        this.lastRequestedTheme = theme;
        this.lastRequestedDarkMode = dark;
        waitTime += 500;
      }

      // Apply wait time
      const finalWait = extraWait !== undefined ? extraWait : waitTime;
      if (finalWait > 0) {
        await new Promise((resolve) => setTimeout(resolve, finalWait));
      }

      return { time: Date.now() - start };

    } finally {
      this.busy = false;
    }
  }

  /**
   * Captures a screenshot of the current page with optional processing
   * @param {Object} params - Screenshot parameters
   * @param {Object} params.viewport - Viewport dimensions {width, height}
   * @param {number} [params.einkColors] - E-ink color reduction (2, 4, 7, 16)
   * @param {boolean} [params.invert=false] - Invert colors
   * @param {number} [params.zoom=1] - Zoom level
   * @param {string} [params.format='png'] - Output format
   * @param {number} [params.rotate] - Rotation angle (90, 180, 270)
   * @param {Object} [params.dithering] - Dithering configuration
   * @returns {Promise<{image: Buffer, time: number}>} Screenshot result
   * @throws {Error} If browser is busy
   */
  async screenshotPage({ viewport, einkColors, invert, zoom = 1, format = "png", rotate, dithering }) {
    if (this.busy) throw new Error("Browser is busy");

    const start = Date.now();
    this.busy = true;
    const headerHeight = Math.round(HEADER_HEIGHT * zoom);

    try {
      const page = await this.getPage();

      // Determine if we need PNG for processing
      const needsProcessing = einkColors || dithering?.enabled || format === "bmp";
      const screenshotType = needsProcessing ? "png" : format;

      // Capture screenshot (clipping header)
      let image = await page.screenshot({
        type: screenshotType,
        clip: {
          x: 0,
          y: headerHeight,
          width: viewport.width,
          height: viewport.height - headerHeight
        }
      });

      let sharpInstance = sharp(image);

      // Apply rotation
      if (rotate) {
        sharpInstance = sharpInstance.rotate(rotate);
      }

      // Process with advanced dithering
      if (dithering?.enabled) {
        image = await this.applyAdvancedDithering(sharpInstance, format, dithering);
        return { image, time: Date.now() - start };
      }

      // Process with legacy e-ink mode
      if (einkColors) {
        image = await this.applyLegacyEink(sharpInstance, format, einkColors, invert);
        return { image, time: Date.now() - start };
      }

      // Standard format conversion
      image = await this.convertToFormat(sharpInstance, format);
      return { image, time: Date.now() - start };

    } catch (err) {
      // Reset navigation state on error to force fresh load
      this.lastRequestedPath = undefined;
      throw err;

    } finally {
      this.busy = false;
    }
  }

  /**
   * Applies advanced dithering processing to image
   * @param {import('sharp').Sharp} sharpInstance - Sharp image instance
   * @param {string} format - Output format
   * @param {Object} dithering - Dithering configuration
   * @returns {Promise<Buffer>} Processed image buffer
   * @private
   */
  async applyAdvancedDithering(sharpInstance, format, dithering) {
    // Convert to PNG for dithering
    let image = await sharpInstance.png().toBuffer();

    const startDither = Date.now();
    image = await applyDithering(image, {
      method: dithering.method || "floyd-steinberg",
      bitDepth: dithering.bitDepth || 2,
      gammaCorrection: dithering.gammaCorrection !== false,
      blackLevel: dithering.blackLevel || 0,
      whiteLevel: dithering.whiteLevel || 100
    });
    console.debug(`Advanced dithering took ${Date.now() - startDither}ms`);

    // Convert to final format
    const newSharp = sharp(image);
    const bitsPerPixel = dithering.bitDepth || 2;

    return this.convertToFormat(newSharp, format, { bitsPerPixel });
  }

  /**
   * Applies legacy e-ink color reduction processing
   * @param {import('sharp').Sharp} sharpInstance - Sharp image instance
   * @param {string} format - Output format
   * @param {number} einkColors - Number of colors (2, 4, 7, 16)
   * @param {boolean} invert - Whether to invert colors
   * @returns {Promise<Buffer>} Processed image buffer
   * @private
   */
  async applyLegacyEink(sharpInstance, format, einkColors, invert) {
    // Apply threshold for 2-color e-ink
    if (einkColors === 2) {
      sharpInstance = sharpInstance.threshold(220, { greyscale: true });
      if (invert) {
        sharpInstance = sharpInstance.negate({ alpha: false });
      }
      sharpInstance = sharpInstance.toColourspace("b-w");
    }

    const bitsPerPixel = this.einkColorsToBpp(einkColors);

    return this.convertToFormat(sharpInstance, format, {
      bitsPerPixel,
      einkColors
    });
  }
}
