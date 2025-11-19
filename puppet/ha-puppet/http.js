/**
 * HTTP server for handling screenshot and API requests
 * @module http
 */

import http from "node:http";
import { Browser } from "./screenshot.js";
import {
  isAddOn,
  hassUrl,
  hassToken,
  keepBrowserOpen,
  MAX_NEXT_REQUESTS,
  BROWSER_TIMEOUT,
  SERVER_PORT,
  VALID_FORMATS,
  VALID_ROTATIONS,
  VALID_BIT_DEPTHS,
  CONTENT_TYPES
} from "./const.js";
import { CannotOpenPageError } from "./error.js";
import { handleUIRequest } from "./ui.js";
import {
  loadSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "./lib/scheduleStore.js";

// =============================================================================
// REQUEST HANDLER CLASS
// =============================================================================

/**
 * Handles incoming HTTP requests and coordinates browser operations
 * Manages request queuing, browser lifecycle, and scheduled requests
 * @class
 */
class RequestHandler {
  /**
   * @param {Browser} browser - Browser instance for screenshot operations
   */
  constructor(browser) {
    this.browser = browser;

    /** @type {boolean} Whether browser is currently processing a request */
    this.busy = false;

    /** @type {Function[]} Queue of pending request resolvers */
    this.pending = [];

    /** @type {number} Request counter for logging */
    this.requestCount = 0;

    /** @type {number[]} Timeout IDs for scheduled "next" requests */
    this.nextRequests = [];

    /** @type {number} Cached navigation time for scheduling calculations */
    this.navigationTime = 0;

    /** @type {Date} Last browser access time for cleanup scheduling */
    this.lastAccess = new Date();

    /** @type {number|undefined} Browser cleanup timer ID */
    this.browserCleanupTimer = undefined;
  }

  // ===========================================================================
  // BROWSER LIFECYCLE MANAGEMENT
  // ===========================================================================

  /**
   * Checks if browser should be cleaned up due to inactivity
   * Reschedules itself if browser was accessed recently
   * @private
   */
  _runBrowserCleanupCheck = async () => {
    if (this.busy) return;

    const idleTime = Date.now() - this.lastAccess.getTime();

    if (idleTime < BROWSER_TIMEOUT) {
      // Browser was accessed recently, reschedule cleanup check
      const remainingTime = BROWSER_TIMEOUT - idleTime;
      this.browserCleanupTimer = setTimeout(
        this._runBrowserCleanupCheck,
        remainingTime + 100
      );
      return;
    }

    await this.browser.cleanup();
  };

  /**
   * Records browser access and schedules cleanup timer
   * @private
   */
  _markBrowserAccessed() {
    clearTimeout(this.browserCleanupTimer);
    this.lastAccess = new Date();

    // Skip cleanup scheduling if configured to keep browser open
    if (keepBrowserOpen) return;

    this.browserCleanupTimer = setTimeout(
      this._runBrowserCleanupCheck,
      BROWSER_TIMEOUT + 100
    );
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Sends a JSON error response
   * @param {http.ServerResponse} response - HTTP response object
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   */
  sendJsonError(response, statusCode, message) {
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: message }));
  }

  /**
   * Reads and returns the request body as a string
   * @param {http.IncomingMessage} request - HTTP request object
   * @returns {Promise<string>} Request body content
   */
  readRequestBody(request) {
    return new Promise((resolve, reject) => {
      let body = "";
      request.on("data", (chunk) => body += chunk.toString());
      request.on("end", () => resolve(body));
      request.on("error", reject);
    });
  }

  /**
   * Parses viewport dimensions from URL parameter
   * @param {string|null} viewportParam - Viewport string in "WIDTHxHEIGHT" format
   * @returns {{width: number, height: number}|null} Parsed dimensions or null if invalid
   */
  parseViewportParams(viewportParam) {
    if (!viewportParam) return null;

    const parts = viewportParam.split("x").map((n) => parseInt(n, 10));

    if (parts.length !== 2 || parts.some(isNaN)) return null;

    return { width: parts[0], height: parts[1] };
  }

  /**
   * Parses screenshot parameters from URL search params
   * @param {URLSearchParams} searchParams - URL search parameters
   * @returns {Object} Parsed screenshot parameters
   */
  parseScreenshotParams(searchParams) {
    // Parse extra wait time
    let extraWait = parseInt(searchParams.get("wait"), 10);
    if (isNaN(extraWait)) extraWait = undefined;

    // Parse e-ink color reduction
    let einkColors = parseInt(searchParams.get("eink"), 10);
    if (isNaN(einkColors) || einkColors < 2) einkColors = undefined;

    // Parse zoom level (default: 1)
    let zoom = parseFloat(searchParams.get("zoom"));
    if (isNaN(zoom) || zoom <= 0) zoom = 1;

    // Parse output format (default: png)
    let format = searchParams.get("format") || "png";
    if (!VALID_FORMATS.includes(format)) format = "png";

    // Parse rotation angle
    let rotate = parseInt(searchParams.get("rotate"), 10);
    if (isNaN(rotate) || !VALID_ROTATIONS.includes(rotate)) rotate = undefined;

    return {
      extraWait,
      einkColors,
      zoom,
      format,
      rotate,
      invert: searchParams.has("invert"),
      lang: searchParams.get("lang") || undefined,
      theme: searchParams.get("theme") || undefined,
      dark: searchParams.has("dark")
    };
  }

  /**
   * Parses dithering parameters from URL search params
   * @param {URLSearchParams} searchParams - URL search parameters
   * @returns {Object|undefined} Dithering config object or undefined if disabled
   */
  parseDitheringParams(searchParams) {
    if (!searchParams.has("dithering")) return undefined;

    // Parse bit depth with validation
    let bitDepth = parseInt(searchParams.get("bit_depth"), 10);
    if (isNaN(bitDepth) || !VALID_BIT_DEPTHS.includes(bitDepth)) bitDepth = 2;

    // Parse black level (0-100, default: 0)
    let blackLevel = parseInt(searchParams.get("black_level"), 10);
    if (isNaN(blackLevel) || blackLevel < 0 || blackLevel > 100) blackLevel = 0;

    // Parse white level (0-100, default: 100)
    let whiteLevel = parseInt(searchParams.get("white_level"), 10);
    if (isNaN(whiteLevel) || whiteLevel < 0 || whiteLevel > 100) whiteLevel = 100;

    return {
      enabled: true,
      method: searchParams.get("dither_method") || "floyd-steinberg",
      bitDepth,
      gammaCorrection: !searchParams.has("no_gamma"),
      blackLevel,
      whiteLevel
    };
  }

  // ===========================================================================
  // SCHEDULE API HANDLERS
  // ===========================================================================

  /**
   * Handles GET/POST requests to /api/schedules
   * @param {http.IncomingMessage} request - HTTP request
   * @param {http.ServerResponse} response - HTTP response
   */
  async handleSchedulesAPI(request, response) {
    response.setHeader("Content-Type", "application/json");

    if (request.method === "GET") {
      const schedules = loadSchedules();
      response.writeHead(200);
      response.end(JSON.stringify(schedules));
      return;
    }

    if (request.method === "POST") {
      try {
        const body = await this.readRequestBody(request);
        const schedule = JSON.parse(body);
        const created = createSchedule(schedule);
        response.writeHead(201);
        response.end(JSON.stringify(created));
      } catch (err) {
        this.sendJsonError(response, 400, err.message);
      }
      return;
    }

    this.sendJsonError(response, 405, "Method not allowed");
  }

  /**
   * Handles PUT/DELETE requests to /api/schedules/:id
   * @param {http.IncomingMessage} request - HTTP request
   * @param {http.ServerResponse} response - HTTP response
   * @param {URL} requestUrl - Parsed request URL
   */
  async handleScheduleAPI(request, response, requestUrl) {
    response.setHeader("Content-Type", "application/json");
    const id = requestUrl.pathname.split("/").pop();

    if (request.method === "PUT") {
      try {
        const body = await this.readRequestBody(request);
        const updates = JSON.parse(body);
        const updated = updateSchedule(id, updates);

        if (!updated) {
          this.sendJsonError(response, 404, "Schedule not found");
          return;
        }

        response.writeHead(200);
        response.end(JSON.stringify(updated));
      } catch (err) {
        this.sendJsonError(response, 400, err.message);
      }
      return;
    }

    if (request.method === "DELETE") {
      const deleted = deleteSchedule(id);

      if (!deleted) {
        this.sendJsonError(response, 404, "Schedule not found");
        return;
      }

      response.writeHead(200);
      response.end(JSON.stringify({ success: true }));
      return;
    }

    this.sendJsonError(response, 405, "Method not allowed");
  }

  // ===========================================================================
  // MAIN REQUEST HANDLER
  // ===========================================================================

  /**
   * Main entry point for all HTTP requests
   * Routes to appropriate handler or processes screenshot request
   * @param {http.IncomingMessage} request - HTTP request
   * @param {http.ServerResponse} response - HTTP response
   */
  async handleRequest(request, response) {
    const requestUrl = new URL(request.url, "http://localhost");

    // Route special paths
    if (requestUrl.pathname === "/favicon.ico") {
      response.statusCode = 404;
      response.end();
      return;
    }

    if (requestUrl.pathname === "/") {
      await handleUIRequest(response);
      return;
    }

    if (requestUrl.pathname === "/api/schedules") {
      await this.handleSchedulesAPI(request, response);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/schedules/")) {
      await this.handleScheduleAPI(request, response, requestUrl);
      return;
    }

    // Process screenshot request
    await this.handleScreenshotRequest(request, response, requestUrl);
  }

  /**
   * Processes a screenshot request with queuing support
   * @param {http.IncomingMessage} request - HTTP request
   * @param {http.ServerResponse} response - HTTP response
   * @param {URL} requestUrl - Parsed request URL
   */
  async handleScreenshotRequest(request, response, requestUrl) {
    const requestId = ++this.requestCount;
    console.debug(requestId, "Request", request.url);

    const start = new Date();

    // Wait in queue if browser is busy
    if (this.busy) {
      console.log(requestId, "Busy, waiting in queue");
      await new Promise((resolve) => this.pending.push(resolve));
      console.log(requestId, `Wait time: ${Date.now() - start.getTime()} ms`);
    }
    this.busy = true;

    try {
      // Parse and validate viewport (required parameter)
      const viewport = this.parseViewportParams(requestUrl.searchParams.get("viewport"));
      if (!viewport) {
        response.statusCode = 400;
        response.end("Invalid or missing viewport parameter. Format: WIDTHxHEIGHT");
        return;
      }

      // Parse all screenshot parameters
      const screenshotParams = this.parseScreenshotParams(requestUrl.searchParams);
      const dithering = this.parseDitheringParams(requestUrl.searchParams);

      const requestParams = {
        pagePath: requestUrl.pathname,
        viewport,
        ...screenshotParams,
        dithering
      };

      // Navigate to page
      let navigateResult;
      try {
        navigateResult = await this.browser.navigatePage(requestParams);
      } catch (err) {
        if (err instanceof CannotOpenPageError) {
          console.error(requestId, `Cannot open page: ${err.message}`);
          response.statusCode = 404;
          response.end(`Cannot open page: ${err.message}`);
          return;
        }
        throw err; // Re-throw for watchdog recovery
      }

      console.debug(requestId, `Navigated in ${navigateResult.time} ms`);
      this.navigationTime = Math.max(this.navigationTime, navigateResult.time);

      // Capture screenshot
      const screenshotResult = await this.browser.screenshotPage(requestParams);
      console.debug(requestId, `Screenshot in ${screenshotResult.time} ms`);

      // Send response
      const contentType = CONTENT_TYPES[screenshotParams.format] || CONTENT_TYPES.png;
      response.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": screenshotResult.image.length
      });
      response.write(screenshotResult.image);
      response.end();

      // Schedule next request if requested
      this.scheduleNextRequest(requestId, requestParams, requestUrl.searchParams, start);

    } finally {
      this.busy = false;
      const resolve = this.pending.shift();
      if (resolve) resolve();
      this._markBrowserAccessed();
    }
  }

  /**
   * Schedules a preemptive navigation for the next screenshot cycle
   * Adjusts timing to account for request processing time
   * @param {number} requestId - Request identifier for logging
   * @param {Object} requestParams - Screenshot parameters to reuse
   * @param {URLSearchParams} searchParams - URL search parameters
   * @param {Date} start - Request start time
   */
  scheduleNextRequest(requestId, requestParams, searchParams, start) {
    const next = parseInt(searchParams.get("next"), 10);
    if (isNaN(next) || next <= 0) return;

    // Calculate wait time accounting for processing overhead
    const requestTime = Date.now() - start.getTime();
    const nextWaitTime =
      next * 1000 -           // Requested interval
      requestTime -            // Time already spent
      this.navigationTime -    // Expected navigation time
      1000;                    // Buffer for browser warmup

    if (nextWaitTime < 0) return;

    console.debug(requestId, `Next request in ${nextWaitTime} ms`);

    this.nextRequests.push(
      setTimeout(() => this.prepareNextRequest(requestId, requestParams), nextWaitTime)
    );

    // Prevent memory leak from too many scheduled requests
    if (this.nextRequests.length > MAX_NEXT_REQUESTS) {
      clearTimeout(this.nextRequests.shift());
    }
  }

  /**
   * Pre-navigates browser for upcoming scheduled request
   * Reduces latency when the actual request arrives
   * @param {number} requestId - Original request identifier
   * @param {Object} requestParams - Screenshot parameters
   */
  async prepareNextRequest(requestId, requestParams) {
    if (this.busy) {
      console.log("Busy, skipping next request preparation");
      return;
    }

    const nextRequestId = `${requestId}-next`;
    this.busy = true;
    console.log(nextRequestId, "Preparing next request");

    try {
      const navigateResult = await this.browser.navigatePage({
        ...requestParams,
        extraWait: 0 // Skip wait time for warmup
      });
      console.debug(nextRequestId, `Navigated in ${navigateResult.time} ms`);
    } catch (err) {
      console.error(nextRequestId, "Error preparing next request", err);
    } finally {
      this.busy = false;
      const resolve = this.pending.shift();
      if (resolve) resolve();
      this._markBrowserAccessed();
    }
  }
}

// =============================================================================
// SERVER INITIALIZATION
// =============================================================================

const browser = new Browser(hassUrl, hassToken);
const requestHandler = new RequestHandler(browser);

const server = http.createServer((request, response) =>
  requestHandler.handleRequest(request, response)
);

server.listen(SERVER_PORT);

const serverUrl = isAddOn
  ? `http://homeassistant.local:${SERVER_PORT}`
  : `http://localhost:${SERVER_PORT}`;

console.log(`[${new Date().toLocaleTimeString()}] Visit server at ${serverUrl}`);
