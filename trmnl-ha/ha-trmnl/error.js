/**
 * Custom error classes for the TRMNL HA add-on
 * @module error
 */

/**
 * Error thrown when a page cannot be opened in the browser
 * Used for navigation failures, 404s, or authentication issues
 * @class
 * @extends Error
 */
export class CannotOpenPageError extends Error {
  /**
   * @param {number} status - HTTP status code from failed navigation
   * @param {string} pagePath - The page path that failed to load
   */
  constructor(status, pagePath) {
    super(`Unable to open page: ${pagePath} (${status})`);
    this.status = status;
    this.pagePath = pagePath;
    this.name = "CannotOpenPageError";
  }
}
