/**
 * Web UI request handler for the Puppet add-on
 * Serves the configuration interface and error pages
 * @module ui
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createConnection, createLongLivedTokenAuth } from "home-assistant-js-websocket";
import { hassUrl, hassToken, isAddOn } from "./const.js";

// =============================================================================
// CONSTANTS
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {string} Path to HTML templates directory */
const HTML_DIR = join(__dirname, "html");

/** @type {string} Path to config file based on environment */
const CONFIG_FILE = isAddOn ? "/data/options.json" : "options-dev.json";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Sends an HTML response with proper headers
 * @param {http.ServerResponse} response - HTTP response object
 * @param {string} html - HTML content to send
 * @param {number} [statusCode=200] - HTTP status code
 */
function sendHtmlResponse(response, html, statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html",
    "Content-Length": Buffer.byteLength(html)
  });
  response.end(html);
}

/**
 * Generates HTML instructions for configuring access token
 * Different instructions for add-on vs local development
 * @param {string} action - Action verb ("Configure" or "Update")
 * @returns {string} HTML list item with instructions
 */
function generateConfigInstructions(action) {
  if (isAddOn) {
    return `
      <li>
        <strong>${action} the Add-on Configuration:</strong>
        <ul class="ml-6 mt-2 space-y-1 list-disc list-inside text-sm">
          <li>Go to Settings → Add-ons</li>
          <li>Click on the Puppet add-on</li>
          <li>Go to the Configuration tab</li>
          <li>${action === "Configure" ? "Paste" : "Update"} your token in the "access_token" field</li>
          <li>Save and restart the add-on</li>
        </ul>
      </li>`;
  }

  return `
      <li>
        <strong>${action === "Configure" ? "Add to" : "Update"} Configuration File:</strong>
        <ul class="ml-6 mt-2 space-y-1 list-disc list-inside text-sm">
          <li>Open the file: <code class="bg-gray-100 px-2 py-1 rounded">${CONFIG_FILE}</code></li>
          <li>${action === "Configure" ? "Add or update" : "Update"} the <code class="bg-gray-100 px-2 py-1 rounded">access_token</code> field with your token</li>
          <li>Save the file and restart the service</li>
        </ul>
      </li>`;
}

// =============================================================================
// HOME ASSISTANT DATA FETCHING
// =============================================================================

/**
 * Fetches configuration data from Home Assistant via WebSocket and REST API
 * @returns {Promise<{themes: Object|null, network: Object|null, config: Object|null}>}
 *          Home Assistant data or null values on failure
 */
async function fetchHomeAssistantData() {
  try {
    const auth = createLongLivedTokenAuth(hassUrl, hassToken);
    const connection = await createConnection({ auth });

    // Fetch themes and network URLs in parallel via WebSocket
    const [themesResult, networkResult] = await Promise.all([
      connection.sendMessagePromise({ type: "frontend/get_themes" }),
      connection.sendMessagePromise({ type: "network/url" })
    ]);

    connection.close();

    // Fetch system config via REST API (contains language setting)
    const configResponse = await fetch(`${hassUrl}/api/config`, {
      headers: {
        Authorization: `Bearer ${hassToken}`,
        "Content-Type": "application/json"
      }
    });

    const config = configResponse.ok ? await configResponse.json() : null;

    return { themes: themesResult, network: networkResult, config };

  } catch (err) {
    console.error("Error fetching Home Assistant data:", err);
    return { themes: null, network: null, config: null };
  }
}

// =============================================================================
// ERROR PAGE HANDLERS
// =============================================================================

/**
 * Serves the missing configuration error page
 * Shown when no access token is configured
 * @param {http.ServerResponse} response - HTTP response object
 */
async function serveMissingConfigPage(response) {
  const htmlPath = join(HTML_DIR, "error_missing_config.html");
  let html = await readFile(htmlPath, "utf-8");

  html = html.replace("{{CONFIG_INSTRUCTIONS}}", generateConfigInstructions("Configure"));
  html = html.replace("{{HASS_URL}}", hassUrl);

  sendHtmlResponse(response, html);
}

/**
 * Serves the connection failed error page
 * Shown when unable to connect to Home Assistant
 * @param {http.ServerResponse} response - HTTP response object
 */
async function serveConnectionFailedPage(response) {
  const htmlPath = join(HTML_DIR, "error_connection_failed.html");
  let html = await readFile(htmlPath, "utf-8");

  html = html.replace("{{CONFIG_INSTRUCTIONS}}", generateConfigInstructions("Update"));
  html = html.replace(/{{HASS_URL}}/g, hassUrl);
  html = html.replace("{{TOKEN_LENGTH}}", String(hassToken?.length || 0));

  sendHtmlResponse(response, html);
}

// =============================================================================
// MAIN UI HANDLER
// =============================================================================

/**
 * Handles requests for the web UI
 * Serves appropriate page based on configuration and connection status
 * @param {http.ServerResponse} response - HTTP response object
 */
export async function handleUIRequest(response) {
  try {
    // Show setup instructions if no token configured
    if (!hassToken) {
      await serveMissingConfigPage(response);
      return;
    }

    // Fetch Home Assistant data
    const hassData = await fetchHomeAssistantData();

    // Show connection error if data fetch failed
    if (!hassData.themes || !hassData.network || !hassData.config) {
      await serveConnectionFailedPage(response);
      return;
    }

    // Serve main UI with injected Home Assistant data
    const htmlPath = join(HTML_DIR, "index.html");
    let html = await readFile(htmlPath, "utf-8");

    // Inject window.hass data for client-side JavaScript
    const scriptTag = `<script>window.hass = ${JSON.stringify(hassData, null, 2)};</script>`;
    html = html.replace("</head>", `${scriptTag}\n  </head>`);

    sendHtmlResponse(response, html);

  } catch (err) {
    console.error("Error serving UI:", err);
    response.statusCode = 500;
    response.end("Error loading UI");
  }
}
