# TRMNL HA Add-On - Developer Documentation

## Overview

TRMNL HA is a Home Assistant add-on that captures dashboard screenshots optimized for TRMNL e-ink displays. It uses Puppeteer (headless Chrome) with advanced dithering algorithms for optimal e-ink rendering.

## Architecture

### Components

```
trmnl-ha/
├── config.yaml              # Add-on configuration schema
├── Dockerfile              # Container definition
├── ha-trmnl/              # Main application
│   ├── http.js            # HTTP server & request handling
│   ├── screenshot.js      # Browser automation & screenshot logic
│   ├── ui.js              # Web UI server-side rendering
│   ├── bmp.js             # BMP image encoding
│   ├── error.js           # Custom error classes
│   ├── const.js           # Configuration constants
│   ├── lib/
│   │   ├── dithering.js   # Advanced dithering algorithms
│   │   └── scheduleStore.js # Schedule persistence
│   └── html/
│       ├── index.html     # Interactive Web UI
│       ├── error_missing_config.html
│       └── error_connection_failed.html
```

### Technology Stack

**Backend:**
- Node.js
- Puppeteer v24.26.1 - Headless Chrome automation
- home-assistant-js-websocket v9.4.0 - HA WebSocket communication
- Sharp v0.34.4 - Image processing
- GraphicsMagick (gm) - Advanced dithering

**Frontend:**
- Vanilla JavaScript
- Tailwind CSS (via CDN)
- localStorage for state persistence

## Core Functionality

### 1. HTTP Server (`http.js`)

**RequestHandler Class:**
- Listens on port 10000
- Routes `/` to UI handler
- Routes `/api/schedules` to schedule CRUD
- Routes all other paths to screenshot handler
- Implements request queuing
- Manages browser lifecycle with 30-second cleanup timeout

### 2. Browser Automation (`screenshot.js`)

**Browser Class:**
Manages Puppeteer browser instance and screenshot generation.

**Key Methods:**
- `navigatePage()` - Navigate to HA page with auth injection
- `screenshotPage()` - Capture and process screenshots
- `applyAdvancedDithering()` - GraphicsMagick-based dithering
- `applyLegacyEink()` - Simple threshold-based processing

### 3. Web UI (`ui.js`)

- Fetches HA data via WebSocket
- Renders index.html with injected config
- Shows error pages for missing config or connection failures

### 4. Dithering (`lib/dithering.js`)

Advanced dithering using GraphicsMagick:
- Floyd-Steinberg error diffusion
- Ordered dithering
- Gamma correction for e-ink
- Black/white level adjustment

## API Endpoints

### GET /
Returns interactive Web UI

### GET /api/schedules
Returns all saved schedules

### POST /api/schedules
Creates a new schedule

### PUT /api/schedules/:id
Updates a schedule

### DELETE /api/schedules/:id
Deletes a schedule

### GET /{path}?{params}
Returns screenshot of Home Assistant page

**Query Parameters:**
- `viewport={width}x{height}` (required)
- `format={png|jpeg|webp|bmp}`
- `theme={theme_name}`
- `dark` (flag)
- `zoom={number}`
- `wait={milliseconds}`
- `lang={code}`
- `eink={colors}` (2-256)
- `rotate={degrees}` (90/180/270)
- `invert` (flag)
- `next={seconds}`
- `dithering` (flag)
- `dither_method={method}`
- `bit_depth={1|2|4|8}`
- `black_level={0-100}`
- `white_level={0-100}`
- `no_gamma` (flag)

## Configuration Options

```yaml
access_token: "long_lived_token_here"
keep_browser_open: false
home_assistant_url: "http://homeassistant:8123"
```

## Development

**Local Development:**
1. Copy `options-dev.json.example` to `options-dev.json`
2. Add your access token
3. Run: `npm install && node http.js`
4. Access UI: `http://localhost:10000/`

## Storage Keys

- `trmnlSettings` - Last used form settings
- `trmnlAutoRefresh` - Auto-refresh preference

## Security

⚠️ **NO SECURITY** - This is a prototype:
- No authentication
- No rate limiting
- Only run on trusted networks

## References

- [Puppeteer Documentation](https://pptr.dev/)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [GraphicsMagick](http://www.graphicsmagick.org/)
- [Home Assistant Add-on Development](https://developers.home-assistant.io/docs/add-ons/)
- [TRMNL](https://usetrmnl.com)
