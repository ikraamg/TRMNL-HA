# TRMNL HA

Send dashboard screens to your TRMNL e-ink display.

![TRMNL HA Logo](logo.svg)

Easily create screenshots of your Home Assistant dashboards with advanced dithering optimized for TRMNL and other e-ink displays.

![UI Screenshot](example/ui.png)

![Device Screenshot](example/device.jpg)

## Setup

1. Install the add-on
2. Create a long-lived access token in Home Assistant (Profile → Long-Lived Access Tokens)
3. Add the token to the add-on configuration

Enable the watchdog option to restart the add-on when the browser fails to launch.

_Note: This is a prototype with no authentication. Anyone with network access can make screenshots._

## Configuration

- **access_token**: Long-lived access token used to authenticate against Home Assistant.

### Advanced Configuration

- **home_assistant_url**: Base URL of your Home Assistant instance. Defaults to `http://homeassistant:8123`. Override if using SSL or custom hostname.
- **keep_browser_open**: Keep the Chromium browser alive between requests for better performance.

## Web UI

Access the web interface to configure and preview screenshots:

1. Open the add-on's Web UI from the Home Assistant Supervisor
2. Or navigate to `http://homeassistant.local:10000/`

The Web UI provides:
- Interactive form to configure screenshot parameters
- Live preview with timing information
- Schedule management for automated captures

## Usage

The add-on runs a server on port 10000. Request any path with viewport dimensions to get a screenshot.

### Basic Screenshot

```
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000
```

### E-ink Displays

Reduce the color palette for e-ink displays with the `eink` parameter:

```
# 2-color (black & white)
http://homeassistant.local:10000/lovelace/0?viewport=800x480&eink=2

# Invert colors
http://homeassistant.local:10000/lovelace/0?viewport=800x480&eink=2&invert
```

### Advanced Dithering

For best results on e-ink displays, use the advanced dithering parameters:

```
http://homeassistant.local:10000/lovelace/0?viewport=800x480&dithering&dither_method=floyd-steinberg&bit_depth=2
```

Parameters:
- `dithering` - Enable advanced dithering
- `dither_method` - `floyd-steinberg`, `ordered`, or `none`
- `bit_depth` - 1, 2, 4, or 8 bits
- `black_level` - Adjust black point (0-100)
- `white_level` - Adjust white point (0-100)
- `no_gamma` - Disable gamma correction

### Themes

Set a theme for the screenshot:

```
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000&theme=Graphite%20E-ink%20Light
```

Recommended: Use an e-ink optimized theme like [Graphite](https://github.com/TilmanGriesel/graphite).

### Wait Time

Control loading wait time (default: 750ms after load, 2.5s extra on cold start):

```
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000&wait=10000
```

### Zoom

Adjust page zoom level (default: 1):

```
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000&zoom=1.3
```

### Output Formats

```
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000&format=png   # default
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000&format=jpeg
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000&format=webp
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000&format=bmp
```

### Rotation

Rotate the screenshot (90, 180, 270 degrees):

```
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000&rotate=90
```

### Language

Set the UI language:

```
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000&lang=nl
```

### Dark Mode

Enable dark mode:

```
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000&dark
```

### Preloading

Warm up the browser for the next request (improves performance):

```
# Browser will prepare for next screenshot in 300 seconds
http://homeassistant.local:10000/lovelace/0?viewport=1000x1000&next=300
```

## Performance

On a Home Assistant Green:
- Cold start: ~10s
- Same page: ~0.6s
- Different page: ~1.5s

Browser stays alive for 30 seconds between requests.

## Proxmox

If running Home Assistant OS in Proxmox, set the VM host type to `host`.

## Links

- [TRMNL](https://usetrmnl.com)
- [Report Issues](https://github.com/ikraamg/home-assistant-addons/issues)
