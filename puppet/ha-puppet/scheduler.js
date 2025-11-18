/**
 * Schedule Runner Module
 *
 * Manages cron jobs for automated screenshot capture
 */

import cron from "node-cron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSchedules } from "./lib/scheduleStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Scheduler {
  constructor(screenshotFn) {
    this.screenshotFn = screenshotFn;
    this.jobs = new Map();
    this.outputDir = path.join(__dirname, "output");

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  start() {
    console.log("[Scheduler] Starting scheduler...");
    this.loadAndSchedule();

    // Reload schedules every minute to pick up changes
    this.reloadInterval = setInterval(() => {
      this.loadAndSchedule();
    }, 60000);
  }

  stop() {
    console.log("[Scheduler] Stopping scheduler...");
    clearInterval(this.reloadInterval);
    for (const [id, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
  }

  loadAndSchedule() {
    const schedules = loadSchedules();
    const activeIds = new Set();

    for (const schedule of schedules) {
      if (!schedule.enabled) {
        // Remove job if schedule is disabled
        if (this.jobs.has(schedule.id)) {
          this.jobs.get(schedule.id).stop();
          this.jobs.delete(schedule.id);
          console.log(`[Scheduler] Stopped job: ${schedule.name}`);
        }
        continue;
      }

      activeIds.add(schedule.id);

      // Skip if job already exists with same cron expression
      const existingJob = this.jobs.get(schedule.id);
      if (existingJob && existingJob.cronExpression === schedule.cron) {
        continue;
      }

      // Validate cron expression
      if (!cron.validate(schedule.cron)) {
        console.error(`[Scheduler] Invalid cron expression for ${schedule.name}: ${schedule.cron}`);
        continue;
      }

      // Stop existing job if cron changed
      if (existingJob) {
        existingJob.stop();
      }

      // Create new job
      const job = cron.schedule(schedule.cron, () => {
        this.runSchedule(schedule);
      });

      job.cronExpression = schedule.cron;
      this.jobs.set(schedule.id, job);
      console.log(`[Scheduler] Scheduled: ${schedule.name} (${schedule.cron})`);
    }

    // Remove jobs for deleted schedules
    for (const [id, job] of this.jobs) {
      if (!activeIds.has(id)) {
        job.stop();
        this.jobs.delete(id);
        console.log(`[Scheduler] Removed deleted schedule job: ${id}`);
      }
    }
  }

  async runSchedule(schedule) {
    const startTime = Date.now();
    console.log(`[Scheduler] Running: ${schedule.name}`);

    try {
      // Build request params from schedule
      const params = {
        pagePath: schedule.dashboard_path || "/lovelace/0",
        viewport: schedule.viewport || { width: 758, height: 1024 },
        extraWait: schedule.wait || 0,
        einkColors: schedule.eink,
        invert: schedule.invert || false,
        zoom: schedule.zoom || 1,
        format: schedule.format || "png",
        rotate: schedule.rotate,
        lang: schedule.lang,
        theme: schedule.theme,
        dark: schedule.dark || false,
        dithering: schedule.dithering?.enabled ? schedule.dithering : undefined,
      };

      // Take screenshot
      const imageBuffer = await this.screenshotFn(params);

      // Save to output directory
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${schedule.name.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.${params.format}`;
      const outputPath = path.join(this.outputDir, filename);

      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`[Scheduler] Saved: ${outputPath}`);

      // Upload via webhook if configured
      if (schedule.webhook_url) {
        await this.uploadToWebhook(schedule, imageBuffer, params.format);
      }

      const duration = Date.now() - startTime;
      console.log(`[Scheduler] Completed: ${schedule.name} in ${duration}ms`);
    } catch (err) {
      console.error(`[Scheduler] Error running ${schedule.name}:`, err.message);
    }
  }

  async uploadToWebhook(schedule, imageBuffer, format) {
    try {
      const contentType = format === "jpeg" ? "image/jpeg"
        : format === "webp" ? "image/webp"
        : format === "bmp" ? "image/bmp"
        : "image/png";

      const response = await fetch(schedule.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          ...(schedule.webhook_headers || {}),
        },
        body: imageBuffer,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`[Scheduler] Uploaded to webhook: ${schedule.webhook_url}`);
    } catch (err) {
      console.error(`[Scheduler] Webhook upload failed:`, err.message);
    }
  }
}

export { Scheduler };
