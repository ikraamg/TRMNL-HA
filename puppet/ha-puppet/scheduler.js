import cron from "node-cron";
import { Browser } from "./screenshot.js";
import { hassUrl, hassToken, schedules } from "./const.js";
import { CannotOpenPageError } from "./error.js";

export class Scheduler {
  constructor() {
    this.browser = new Browser(hassUrl, hassToken);
    this.jobs = [];
  }

  parseViewport(viewportString) {
    const parts = viewportString.split("x").map((n) => parseInt(n));
    if (parts.length !== 2 || !parts.every((x) => !isNaN(x))) {
      throw new Error(`Invalid viewport format: ${viewportString}. Expected format: WIDTHxHEIGHT (e.g., "800x480")`);
    }
    return { width: parts[0], height: parts[1] };
  }

  async uploadToWebhook(webhookUrl, imageBuffer, format) {
    const contentTypeMap = {
      png: "image/png",
      jpeg: "image/jpeg",
      webp: "image/webp",
      bmp: "image/bmp",
    };

    const contentType = contentTypeMap[format] || "image/png";

    try {
      const response = await fetch(webhookUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "Content-Length": imageBuffer.length.toString(),
        },
        body: imageBuffer,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (err) {
      throw new Error(`Failed to upload to webhook: ${err.message}`);
    }
  }

  async executeScheduledJob(schedule) {
    const scheduleName = schedule.name || schedule.dashboard_path;
    const jobId = `[${scheduleName}]`;

    console.log(`${jobId} Starting scheduled screenshot`);
    const startTime = Date.now();

    try {
      // Parse viewport
      const viewport = this.parseViewport(schedule.viewport);

      // Prepare screenshot parameters
      const screenshotParams = {
        pagePath: schedule.dashboard_path,
        viewport,
        extraWait: schedule.wait,
        einkColors: schedule.eink_colors,
        invert: schedule.invert || false,
        zoom: schedule.zoom || 1,
        format: schedule.format || "png",
        rotate: schedule.rotate,
        lang: schedule.lang,
        theme: schedule.theme,
        dark: schedule.dark || false,
      };

      // Navigate to the page
      const navigateResult = await this.browser.navigatePage(screenshotParams);
      console.log(`${jobId} Navigated in ${navigateResult.time}ms`);

      // Take screenshot
      const screenshotResult = await this.browser.screenshotPage(screenshotParams);
      console.log(`${jobId} Screenshot captured in ${screenshotResult.time}ms`);

      // Upload to webhook
      const uploadStartTime = Date.now();
      await this.uploadToWebhook(
        schedule.webhook_url,
        screenshotResult.image,
        schedule.format || "png"
      );
      const uploadTime = Date.now() - uploadStartTime;

      const totalTime = Date.now() - startTime;
      console.log(`${jobId} Successfully uploaded to webhook in ${uploadTime}ms (total: ${totalTime}ms)`);
    } catch (err) {
      console.error(`${jobId} Error in scheduled job:`, err.message);
      if (err instanceof CannotOpenPageError) {
        console.error(`${jobId} Failed to open page (HTTP ${err.status})`);
      }
      // Don't propagate the error - let the next scheduled run happen
    }
  }

  start() {
    if (schedules.length === 0) {
      console.log("No schedules configured. Scheduler is idle.");
      return;
    }

    console.log(`Starting scheduler with ${schedules.length} schedule(s)`);

    schedules.forEach((schedule, index) => {
      // Validate required fields
      if (!schedule.cron) {
        console.error(`Schedule ${index}: Missing required field 'cron'`);
        return;
      }
      if (!schedule.dashboard_path) {
        console.error(`Schedule ${index}: Missing required field 'dashboard_path'`);
        return;
      }
      if (!schedule.viewport) {
        console.error(`Schedule ${index}: Missing required field 'viewport'`);
        return;
      }
      if (!schedule.webhook_url) {
        console.error(`Schedule ${index}: Missing required field 'webhook_url'`);
        return;
      }

      // Validate cron expression
      if (!cron.validate(schedule.cron)) {
        console.error(`Schedule ${index}: Invalid cron expression '${schedule.cron}'`);
        return;
      }

      const scheduleName = schedule.name || schedule.dashboard_path;
      const job = cron.schedule(schedule.cron, () => {
        this.executeScheduledJob(schedule);
      });

      this.jobs.push(job);
      console.log(`Scheduled job: "${scheduleName}" with cron "${schedule.cron}"`);
    });

    console.log(`Scheduler started successfully with ${this.jobs.length} active job(s)`);
  }

  async stop() {
    console.log("Stopping scheduler...");

    // Stop all cron jobs
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];

    // Cleanup browser
    await this.browser.cleanup();

    console.log("Scheduler stopped");
  }
}
