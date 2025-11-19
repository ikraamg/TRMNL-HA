# System Architecture

This document provides a comprehensive overview of the TRMNL HA add-on architecture, design decisions, and implementation details.

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Module Details](#module-details)
- [Design Decisions](#design-decisions)
- [Performance Considerations](#performance-considerations)
- [Security](#security)
- [Future Improvements](#future-improvements)

## High-Level Overview

TRMNL HA is a Home Assistant add-on that captures dashboard screenshots and sends them to your TRMNL device. It's optimized for e-ink displays with advanced dithering capabilities.

### Core Capabilities

1. **Browser Automation** - Headless Chromium via Puppeteer
2. **Scheduled Screenshots** - Cron-based job execution
3. **Image Processing** - Advanced dithering for e-ink displays
4. **HTTP Server** - On-demand screenshot API
5. **Webhook Delivery** - Automated upload to external servers

### Technology Stack

- **Runtime**: Node.js 23
- **Browser**: Chromium (headless)
- **Image Processing**: Sharp + GraphicsMagick
- **Scheduling**: node-cron
- **Testing**: Jest + Pixelmatch

## Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TRMNL HA Add-on                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐         ┌──────────────┐             │
│  │  HTTP Server │         │  Scheduler   │             │
│  │  (http.js)   │         │(scheduler.js)│             │
│  └───────┬──────┘         └───────┬──────┘             │
│          │                        │                     │
│          └────────────┬───────────┘                     │
│                       │                                 │
│                  ┌────▼─────┐                           │
│                  │  Browser │                           │
│                  │ (screenshot.js)                      │
│                  └────┬─────┘                           │
│                       │                                 │
│          ┌────────────┼────────────┐                   │
│          │            │            │                    │
│     ┌────▼───┐   ┌───▼───┐   ┌───▼─────┐             │
│     │ Sharp  │   │  GM   │   │Puppeteer│             │
│     │        │   │Dither │   │         │             │
│     └────────┘   └───────┘   └─────────┘             │
│                                                          │
└─────────────────────────────────────────────────────────┘
           │                           │
           ▼                           ▼
   ┌──────────────┐          ┌──────────────┐
   │ Home         │          │ External     │
   │ Assistant    │          │ Server       │
   └──────────────┘          └──────────────┘
```

### Component Responsibilities

| Component | Responsibility | Location |
|-----------|---------------|----------|
| **HTTP Server** | On-demand screenshot API | `http.js` |
| **Scheduler** | Cron-based automation | `scheduler.js` |
| **Browser** | Puppeteer automation & navigation | `screenshot.js` |
| **Dithering** | E-ink image optimization | `lib/dithering.js` |
| **BMP Encoder** | Custom BMP format support | `bmp.js` |
| **UI** | Web-based configuration interface | `ui.js` |

## Data Flow

### 1. Scheduled Screenshot Flow

```
User Config (YAML)
        │
        ▼
   Scheduler
        │
        ├─► Parse cron expression
        ├─► Wait for trigger time
        │
        ▼
   Execute Job
        │
        ├─► Navigate to dashboard
        │   │
        │   ├─► Parse viewport (WIDTHxHEIGHT)
        │   ├─► Set zoom, theme, language
        │   ├─► Wait for page load
        │   └─► Dismiss toasts
        │
        ├─► Capture screenshot
        │   │
        │   ├─► Clip to viewport (remove header)
        │   ├─► Rotate (if requested)
        │   ├─► Apply dithering (if enabled)
        │   │   │
        │   │   ├─► Convert to grayscale
        │   │   ├─► Remove gamma profile
        │   │   ├─► Apply level adjustments
        │   │   ├─► Dither (Floyd-Steinberg/Ordered)
        │   │   └─► Reduce to target bit depth
        │   │
        │   └─► Format conversion (PNG/JPEG/WebP/BMP)
        │
        └─► Upload to webhook
            │
            ├─► HTTP PUT request
            ├─► Include Content-Type header
            └─► Log success/failure
```

### 2. HTTP API Flow

```
HTTP Request
  GET /lovelace/0?viewport=800x480&dithering=enabled&bit_depth=2
        │
        ▼
   HTTP Server
        │
        ├─► Parse query parameters
        ├─► Validate parameters
        │
        ▼
   Browser (same as above)
        │
        ▼
   HTTP Response
        │
        ├─► Content-Type: image/png
        ├─► Image buffer
        └─► Status 200 OK
```

## Module Details

### screenshot.js - Browser Automation

**Key Responsibilities:**
- Manage Chromium browser lifecycle
- Navigate Home Assistant dashboards
- Capture screenshots with precise clipping
- Apply image transformations

**Class: Browser**

```javascript
class Browser {
  constructor(homeAssistantUrl, token)

  // Lifecycle
  async getPage()          // Launch browser, return page
  async cleanup()          // Close browser and page

  // Navigation
  async navigatePage({
    pagePath,             // HA dashboard path
    viewport,             // {width, height}
    extraWait,            // Additional wait time
    zoom,                 // Zoom level
    lang,                 // Language code
    theme,                // Theme name
    dark                  // Dark mode boolean
  })

  // Screenshot
  async screenshotPage({
    viewport,
    einkColors,           // Legacy e-ink (deprecated)
    invert,               // Legacy invert (deprecated)
    zoom,
    format,               // png|jpeg|webp|bmp
    rotate,               // 90|180|270
    dithering            // Advanced dithering options
  })
}
```

**Performance Optimizations:**

1. **Browser Reuse**
   - Browser stays alive for 30 seconds after last request
   - Dramatically improves subsequent screenshot speed
   - Managed via `keepBrowserOpen` config

2. **Smart Navigation**
   - Mimics HA frontend navigation (no full reload)
   - Uses `history.replaceState` + `location-changed` event
   - Preserves state between dashboard switches

3. **Efficient Page Load Detection**
   - Waits for `partial-panel-resolver` to finish loading
   - Polls `_loading` property with 100ms interval
   - 10-second timeout with graceful fallback

### lib/dithering.js - Image Processing

**Key Responsibilities:**
- Floyd-Steinberg error diffusion dithering
- Ordered (pattern-based) dithering
- Bit depth reduction (1/2/4/8-bit)
- Gamma correction removal
- Black/white level adjustments

**Function: applyDithering**

```javascript
async function applyDithering(imageBuffer, options = {
  method: 'floyd-steinberg',    // floyd-steinberg|ordered|none
  bitDepth: 4,                  // 1|2|4|8
  gammaCorrection: true,        // Remove gamma for e-ink
  blackLevel: 0,                // 0-100
  whiteLevel: 100               // 0-100
})
```

**Processing Pipeline:**

```
Input Buffer (PNG/JPEG)
        │
        ▼
   GraphicsMagick Instance
        │
        ├─► Remove color profile (if gammaCorrection=true)
        ├─► Convert to Grayscale
        ├─► Apply level adjustments
        │
        ▼
   Bit Depth Processing
        │
        ├─► 1-bit: dither + monochrome
        ├─► 2-bit: dither + colors(4)
        ├─► 4-bit: dither + colors(16)
        └─► 8-bit: optional dither
        │
        ▼
   PNG Buffer Output
```

**Algorithm Details:**

**Floyd-Steinberg Dithering:**
```
Current pixel error is distributed to neighbors:
    X   7/16
3/16 5/16 1/16

Where X is the current pixel.
Error = actual_value - quantized_value
```

**Ordered Dithering:**
- Uses Bayer matrix for threshold comparison
- Faster but can show visible patterns
- Better for real-time applications

### scheduler.js - Job Management

**Key Responsibilities:**
- Parse cron expressions
- Execute scheduled jobs
- Handle errors gracefully
- Log job execution metrics

**Class: Scheduler**

```javascript
class Scheduler {
  constructor()

  // Job Management
  start()                        // Start all cron jobs
  async stop()                   // Stop all jobs + cleanup
  async executeScheduledJob(schedule)  // Run single job

  // Utilities
  parseViewport(viewportString)  // "800x480" → {width: 800, height: 480}
  async uploadToWebhook(url, buffer, format)  // HTTP PUT upload
}
```

**Error Handling:**

- Jobs don't propagate errors (next run continues)
- Detailed error logging for debugging
- Special handling for `CannotOpenPageError`
- Automatic browser cleanup on failures

### http.js - HTTP Server

**Serves two purposes:**

1. **Screenshot API** - On-demand screenshots
2. **Web UI** - Configuration interface

**Endpoints:**

```
GET /<dashboard-path>?viewport=WxH&...
  → Returns screenshot as image

GET /ui
  → Returns HTML configuration interface

GET /
  → Redirects to /ui
```

## Design Decisions

### Why GraphicsMagick over Pure Sharp?

**Decision:** Use GM for dithering instead of implementing in Sharp

**Rationale:**
- GM has proven Floyd-Steinberg implementation
- Sharp doesn't have built-in dithering
- Implementing dithering from scratch would be error-prone
- Production-tested by converter library

**Trade-off:**
- ✅ Reliable, tested algorithms
- ✅ Easy to maintain
- ❌ Extra dependency (~50MB)
- ❌ Callback-based API (wrapped in Promises)

**NOTE:** GM is being sunset, but alternative (libvips) doesn't have dithering either. Future: implement in pure Sharp or find alternative.

### Why Two Image Processing Modes?

**Legacy Mode (Sharp):**
```javascript
einkColors: 2
invert: true
```

**New Mode (GM Dithering):**
```javascript
dithering: {
  enabled: true,
  method: 'floyd-steinberg',
  bitDepth: 2
}
```

**Rationale:**
- Backward compatibility with existing configs
- Smooth migration path for users
- Legacy mode is simpler for basic use cases
- Advanced mode gives fine-grained control

### Browser Lifecycle Management

**Decision:** Keep browser alive for 30 seconds

**Rationale:**
- Cold start: ~10s on HA Green
- Warm screenshot: ~0.6s
- Trade-off: Memory (150-300MB) vs Speed (15x faster)

**Configuration:**
```yaml
keep_browser_open: true   # Keep alive indefinitely
keep_browser_open: false  # Close after 30s (default)
```

### Why Puppeteer Over Playwright?

**Decision:** Stick with Puppeteer

**Rationale:**
- Already established in codebase
- Lighter weight (~150MB vs ~500MB)
- Chromium-only is sufficient for our use case
- Home Assistant doesn't need cross-browser testing

## Performance Considerations

### Benchmarks

**Cold Start (First Screenshot):**
- Browser launch: ~3-5s
- Page navigation: ~2-3s
- Screenshot: ~0.5s
- Dithering: ~200ms
- **Total: ~6-8s**

**Warm Screenshot (Browser Alive):**
- Navigate (same page): ~0ms
- Navigate (different page): ~1.5s
- Screenshot: ~0.5s
- Dithering: ~200ms
- **Total: ~1-2s**

### Memory Usage

- Chromium: ~150-200MB
- Node.js: ~50-100MB
- Image buffers: ~5-10MB (transient)
- **Total: ~200-300MB**

### Optimization Techniques

1. **Smart Browser Reuse**
   - Don't close browser between requests
   - Reuse page instance
   - Mimics HA navigation (no full reload)

2. **Efficient Page Load Detection**
   - Wait only for critical elements
   - 100ms polling interval
   - Short-circuit if already loaded

3. **Image Processing Pipeline**
   - Process in-memory (no disk I/O)
   - Stream-based where possible
   - Async/await for parallelization

4. **Cron Job Optimization**
   - Stagger schedules to avoid simultaneous jobs
   - Reuse browser between scheduled jobs
   - Lazy cleanup (30s delay)

## Security

### Authentication

- Uses Home Assistant long-lived access tokens
- Token stored in localStorage for browser session
- Token never exposed in logs

### Network Security

- Add-on runs in HA's internal network
- Webhook uploads use HTTPS (recommended)
- No external dependencies at runtime

### Sandbox

- Chromium runs with `--no-sandbox` (required in containers)
- Isolated from HA core
- No filesystem access outside /data

### Input Validation

- Viewport size limits
- Cron expression validation
- Path sanitization
- Query parameter whitelisting

## Future Improvements

### Short Term

1. **Alternative to GraphicsMagick**
   - Implement dithering in pure JavaScript
   - Or find actively maintained alternative
   - GM is being sunset

2. **Retry Logic for Webhooks**
   - Exponential backoff
   - Configurable retry count
   - Store failed uploads for later

3. **Image Caching**
   - Cache screenshots with TTL
   - Serve cached if dashboard unchanged
   - Reduce load on HA

### Long Term

1. **Multi-Dashboard Comparisons**
   - Detect visual changes
   - Only update if changed
   - Save bandwidth for e-ink

2. **WebSocket Support**
   - Push updates instead of pull
   - Real-time dashboard changes
   - Lower latency

3. **Plugin System**
   - Custom dithering algorithms
   - Custom upload methods
   - Custom image processing

4. **Distributed Architecture**
   - Separate browser service
   - Horizontal scaling
   - Load balancing

## Appendix

### File Size Breakdown

| Component | Size | % of Total |
|-----------|------|-----------|
| Chromium | ~120MB | 75% |
| Node.js | ~30MB | 19% |
| npm packages | ~10MB | 6% |
| **Total** | **~160MB** | **100%** |

### Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Cold start screenshot | < 10s | ~8s ✅ |
| Warm screenshot | < 2s | ~1.5s ✅ |
| Dithering | < 500ms | ~200ms ✅ |
| Memory usage | < 400MB | ~300MB ✅ |

### Technology Alternatives Considered

| Decision | Alternative | Why Not? |
|----------|-------------|----------|
| Puppeteer | Playwright | Heavier, unnecessary features |
| GraphicsMagick | ImageMagick | GM is lighter, sufficient |
| Sharp | Jimp | Sharp is faster (C++ bindings) |
| node-cron | node-schedule | cron is simpler, sufficient |

---

**Questions about architecture?** Open a GitHub Discussion or check [CONTRIBUTING.md](CONTRIBUTING.md)
