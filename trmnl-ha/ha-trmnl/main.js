/**
 * Main Entry Point
 *
 * Starts both the HTTP server and the scheduler
 */

import http from "node:http";
import { Browser } from "./screenshot.js";
import { isAddOn, hassUrl, hassToken, keepBrowserOpen } from "./const.js";
import { CannotOpenPageError } from "./error.js";
import { handleUIRequest } from "./ui.js";
import {
  loadSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "./lib/scheduleStore.js";
import { Scheduler } from "./scheduler.js";

// Maximum number of next requests to keep in memory
const MAX_NEXT_REQUESTS = 100;
const BROWSER_TIMEOUT = 30_000;

class RequestHandler {
  constructor(browser) {
    this.browser = browser;
    this.busy = false;
    this.pending = [];
    this.requestCount = 0;
    this.nextRequests = [];
    this.navigationTime = 0;
    this.lastAccess = new Date();
  }

  _runBrowserCleanupCheck = async () => {
    if (this.busy) {
      return;
    }

    const idleTime = Date.now() - this.lastAccess.getTime();

    if (idleTime < BROWSER_TIMEOUT) {
      const remainingTime = BROWSER_TIMEOUT - idleTime;
      this.browserCleanupTimer = setTimeout(
        this._runBrowserCleanupCheck,
        remainingTime + 100,
      );
      return;
    }

    await this.browser.cleanup();
  };

  _markBrowserAccessed() {
    clearTimeout(this.browserCleanupTimer);
    this.lastAccess = new Date();
    if (keepBrowserOpen) {
      return;
    }
    this.browserCleanupTimer = setTimeout(
      this._runBrowserCleanupCheck,
      BROWSER_TIMEOUT + 100,
    );
  }

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
        response.writeHead(400);
        response.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    response.writeHead(405);
    response.end(JSON.stringify({ error: "Method not allowed" }));
  }

  async handleScheduleAPI(request, response, requestUrl) {
    response.setHeader("Content-Type", "application/json");

    const id = requestUrl.pathname.split("/").pop();

    if (request.method === "PUT") {
      try {
        const body = await this.readRequestBody(request);
        const updates = JSON.parse(body);
        const updated = updateSchedule(id, updates);
        if (!updated) {
          response.writeHead(404);
          response.end(JSON.stringify({ error: "Schedule not found" }));
          return;
        }
        response.writeHead(200);
        response.end(JSON.stringify(updated));
      } catch (err) {
        response.writeHead(400);
        response.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (request.method === "DELETE") {
      const deleted = deleteSchedule(id);
      if (!deleted) {
        response.writeHead(404);
        response.end(JSON.stringify({ error: "Schedule not found" }));
        return;
      }
      response.writeHead(200);
      response.end(JSON.stringify({ success: true }));
      return;
    }

    response.writeHead(405);
    response.end(JSON.stringify({ error: "Method not allowed" }));
  }

  readRequestBody(request) {
    return new Promise((resolve, reject) => {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk.toString();
      });
      request.on("end", () => {
        resolve(body);
      });
      request.on("error", reject);
    });
  }

  async handleRequest(request, response) {
    const requestUrl = new URL(request.url, "http://localhost");

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

    const requestId = ++this.requestCount;
    console.debug(requestId, "Request", request.url);

    const start = new Date();
    if (this.busy) {
      console.log(requestId, "Busy, waiting in queue");
      await new Promise((resolve) => this.pending.push(resolve));
      const end = Date.now();
      console.log(requestId, `Wait time: ${end - start} ms`);
    }
    this.busy = true;

    try {
      console.debug(requestId, "Handling", request.url);

      let extraWait = parseInt(requestUrl.searchParams.get("wait"));
      if (isNaN(extraWait)) {
        extraWait = undefined;
      }
      const viewportParams = (requestUrl.searchParams.get("viewport") || "")
        .split("x")
        .map((n) => parseInt(n));
      if (
        viewportParams.length != 2 ||
        !viewportParams.every((x) => !isNaN(x))
      ) {
        response.statusCode = 400;
        response.end();
        return;
      }

      let einkColors = parseInt(requestUrl.searchParams.get("eink"));
      if (isNaN(einkColors) || einkColors < 2) {
        einkColors = undefined;
      }

      let zoom = parseFloat(requestUrl.searchParams.get("zoom"));
      if (isNaN(zoom) || zoom <= 0) {
        zoom = 1;
      }

      const invert = requestUrl.searchParams.has("invert");

      let format = requestUrl.searchParams.get("format") || "png";
      if (!["png", "jpeg", "webp", "bmp"].includes(format)) {
        format = "png";
      }

      let rotate = parseInt(requestUrl.searchParams.get("rotate"));
      if (isNaN(rotate) || ![90, 180, 270].includes(rotate)) {
        rotate = undefined;
      }

      const lang = requestUrl.searchParams.get("lang") || undefined;
      const theme = requestUrl.searchParams.get("theme") || undefined;
      const dark = requestUrl.searchParams.has("dark");

      const ditheringEnabled = requestUrl.searchParams.has("dithering");
      const ditherMethod = requestUrl.searchParams.get("dither_method") || "floyd-steinberg";
      let bitDepth = parseInt(requestUrl.searchParams.get("bit_depth"));
      if (isNaN(bitDepth) || ![1, 2, 4, 8].includes(bitDepth)) {
        bitDepth = 2;
      }
      const gammaCorrection = !requestUrl.searchParams.has("no_gamma");
      let blackLevel = parseInt(requestUrl.searchParams.get("black_level"));
      if (isNaN(blackLevel) || blackLevel < 0 || blackLevel > 100) {
        blackLevel = 0;
      }
      let whiteLevel = parseInt(requestUrl.searchParams.get("white_level"));
      if (isNaN(whiteLevel) || whiteLevel < 0 || whiteLevel > 100) {
        whiteLevel = 100;
      }

      const dithering = ditheringEnabled ? {
        enabled: true,
        method: ditherMethod,
        bitDepth,
        gammaCorrection,
        blackLevel,
        whiteLevel,
      } : undefined;

      const requestParams = {
        pagePath: requestUrl.pathname,
        viewport: { width: viewportParams[0], height: viewportParams[1] },
        extraWait,
        einkColors,
        invert,
        zoom,
        format,
        rotate,
        lang,
        theme,
        dark,
        dithering,
      };

      const nextParam = requestUrl.searchParams.get("next");
      let next = parseInt(nextParam);
      if (isNaN(next) || next < 0) {
        next = undefined;
      }

      let image;
      let navigateResult = null;
      try {
        navigateResult = await this.browser.navigatePage(requestParams);
      } catch (err) {
        if (err instanceof CannotOpenPageError) {
          console.error(requestId, `Cannot open page: ${err.message}`);
          response.statusCode = 404;
          response.end(`Cannot open page: ${err.message}`);
          return;
        }
        throw err;
      }
      console.debug(requestId, `Navigated in ${navigateResult.time} ms`);
      this.navigationTime = Math.max(this.navigationTime, navigateResult.time);
      const screenshotResult = await this.browser.screenshotPage(requestParams);
      console.debug(requestId, `Screenshot in ${screenshotResult.time} ms`);
      image = screenshotResult.image;

      const responseFormat = format;
      let contentType;
      if (responseFormat === "jpeg") {
        contentType = "image/jpeg";
      } else if (responseFormat === "webp") {
        contentType = "image/webp";
      } else if (responseFormat === "bmp") {
        contentType = "image/bmp";
      } else {
        contentType = "image/png";
      }

      response.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": image.length,
      });
      response.write(image);
      response.end();

      if (!next) {
        return;
      }

      const end = new Date();
      const requestTime = end.getTime() - start.getTime();
      const nextWaitTime =
        next * 1000 -
        requestTime -
        this.navigationTime -
        1000;

      if (nextWaitTime < 0) {
        return;
      }
      console.debug(requestId, `Next request in ${nextWaitTime} ms`);
      this.nextRequests.push(
        setTimeout(
          () => this.prepareNextRequest(requestId, requestParams),
          nextWaitTime,
        ),
      );
      if (this.nextRequests.length > MAX_NEXT_REQUESTS) {
        clearTimeout(this.nextRequests.shift());
      }
    } finally {
      this.busy = false;
      const resolve = this.pending.shift();
      if (resolve) {
        resolve();
      }
      this._markBrowserAccessed();
    }
  }

  async prepareNextRequest(requestId, requestParams) {
    if (this.busy) {
      console.log("Busy, skipping next request");
      return;
    }
    requestId = `${requestId}-next`;
    this.busy = true;
    console.log(requestId, "Preparing next request");
    try {
      const navigateResult = await this.browser.navigatePage({
        ...requestParams,
        extraWait: 0,
      });
      console.debug(requestId, `Navigated in ${navigateResult.time} ms`);
    } catch (err) {
      console.error(requestId, "Error preparing next request", err);
    } finally {
      this.busy = false;
      const resolve = this.pending.shift();
      if (resolve) {
        resolve();
      }
      this._markBrowserAccessed();
    }
  }

  // Function for scheduler to take screenshots
  async takeScreenshot(params) {
    const start = new Date();

    if (this.busy) {
      await new Promise((resolve) => this.pending.push(resolve));
    }
    this.busy = true;

    try {
      await this.browser.navigatePage(params);
      const result = await this.browser.screenshotPage(params);
      return result.image;
    } finally {
      this.busy = false;
      const resolve = this.pending.shift();
      if (resolve) {
        resolve();
      }
      this._markBrowserAccessed();
    }
  }
}

// Initialize and start
const browser = new Browser(hassUrl, hassToken);
const requestHandler = new RequestHandler(browser);

// Create scheduler with screenshot function
const scheduler = new Scheduler((params) => requestHandler.takeScreenshot(params));

const port = 10000;
const server = http.createServer((request, response) =>
  requestHandler.handleRequest(request, response),
);
server.listen(port);

// Start the scheduler
scheduler.start();

const now = new Date();
const serverUrl = isAddOn
  ? `http://homeassistant.local:${port}`
  : `http://localhost:${port}`;
console.log(`[${now.toLocaleTimeString()}] Visit server at ${serverUrl}`);
console.log(`[${now.toLocaleTimeString()}] Scheduler is running`);
