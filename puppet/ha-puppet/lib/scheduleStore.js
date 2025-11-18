/**
 * Schedule Store Module
 *
 * Manages schedule persistence to JSON file
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEDULES_FILE = path.join(__dirname, "..", "schedules.json");

/**
 * Load schedules from JSON file
 * @returns {Array} Array of schedule objects
 */
export function loadSchedules() {
  try {
    if (fs.existsSync(SCHEDULES_FILE)) {
      const data = fs.readFileSync(SCHEDULES_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading schedules:", err);
  }
  return [];
}

/**
 * Save schedules to JSON file
 * @param {Array} schedules - Array of schedule objects
 */
export function saveSchedules(schedules) {
  try {
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
  } catch (err) {
    console.error("Error saving schedules:", err);
    throw err;
  }
}

/**
 * Get a schedule by ID
 * @param {string} id - Schedule ID
 * @returns {Object|null} Schedule object or null
 */
export function getSchedule(id) {
  const schedules = loadSchedules();
  return schedules.find((s) => s.id === id) || null;
}

/**
 * Create a new schedule
 * @param {Object} schedule - Schedule data
 * @returns {Object} Created schedule with ID
 */
export function createSchedule(schedule) {
  const schedules = loadSchedules();
  const newSchedule = {
    ...schedule,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  schedules.push(newSchedule);
  saveSchedules(schedules);
  return newSchedule;
}

/**
 * Update an existing schedule
 * @param {string} id - Schedule ID
 * @param {Object} updates - Updated schedule data
 * @returns {Object|null} Updated schedule or null if not found
 */
export function updateSchedule(id, updates) {
  const schedules = loadSchedules();
  const index = schedules.findIndex((s) => s.id === id);
  if (index === -1) {
    return null;
  }
  schedules[index] = {
    ...schedules[index],
    ...updates,
    id, // Preserve ID
    updatedAt: new Date().toISOString(),
  };
  saveSchedules(schedules);
  return schedules[index];
}

/**
 * Delete a schedule
 * @param {string} id - Schedule ID
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteSchedule(id) {
  const schedules = loadSchedules();
  const index = schedules.findIndex((s) => s.id === id);
  if (index === -1) {
    return false;
  }
  schedules.splice(index, 1);
  saveSchedules(schedules);
  return true;
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
  return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
