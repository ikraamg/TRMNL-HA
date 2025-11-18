import { Scheduler } from "./scheduler.js";

const scheduler = new Scheduler();

// Handle graceful shutdown
const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  await scheduler.stop();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Start the scheduler
const now = new Date();
console.log(`[${now.toLocaleTimeString()}] Puppet Scheduler starting...`);
scheduler.start();
console.log("Scheduler is running. Press Ctrl+C to stop.");
