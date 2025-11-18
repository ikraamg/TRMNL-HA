# Configuration Examples

This directory contains example configurations for different use cases. Copy and customize these files for your setup.

## Quick Start

1. Copy an example file
2. Replace `YOUR_LONG_LIVED_ACCESS_TOKEN_HERE` with your actual token
3. Update `webhook_url` with your server endpoint
4. Adjust `viewport` to match your display size
5. Use the configuration in Home Assistant add-on settings

## Available Examples

### 📄 [basic-eink.yaml](basic-eink.yaml)

**Perfect for:** Most e-ink displays (Kindle, Kobo, etc.)

**Features:**
- 2-bit grayscale (4 gray levels)
- Floyd-Steinberg dithering
- Updates every 10 minutes
- Single display setup
- Well-commented for learning

**Use this if:** You have a single e-ink display and want the best balance of quality and file size.

---

### 📄 [high-quality.yaml](high-quality.yaml)

**Perfect for:** High-resolution e-ink displays that support more grays

**Features:**
- 4-bit grayscale (16 gray levels)
- Smoother gradients
- Fine-tuned contrast adjustments
- Multiple display examples
- Theme support

**Use this if:** You want maximum image quality and your display supports it.

---

### 📄 [multi-display.yaml](multi-display.yaml)

**Perfect for:** Managing multiple e-ink displays throughout your home

**Features:**
- 6 different display configurations
- Different schedules (5 min to 4x daily)
- Different bit depths per display
- Time-based scheduling (business hours, night mode)
- Rotation examples

**Use this if:** You have multiple displays with different needs.

---

### 📄 [troubleshooting.yaml](troubleshooting.yaml)

**Perfect for:** Fixing common image quality issues

**Features:**
- Examples for 11 common problems
- Side-by-side before/after settings
- Detailed explanations of each fix
- Quick reference guide

**Use this if:** Your images aren't looking quite right and you need to tweak settings.

---

## Common Display Sizes

| Display | Resolution (Portrait) | Resolution (Landscape) | Recommended |
|---------|---------------------|----------------------|-------------|
| **Kindle Paperwhite (6")** | 758x1024 | 1024x758 | bit_depth: 2 |
| **Kindle Paperwhite (newer)** | 1072x1448 | 1448x1072 | bit_depth: 2 |
| **Kobo Clara HD** | 1072x1448 | 1448x1072 | bit_depth: 2 |
| **7.5" Generic E-ink** | 480x800 | 800x480 | bit_depth: 2 |
| **10.3" E-ink** | 1404x1872 | 1872x1404 | bit_depth: 4 |
| **13.3" E-ink** | 1600x2200 | 2200x1600 | bit_depth: 4 |

## Quick Settings Guide

### Bit Depth Selection

```
1-bit (2 colors) → Simple dashboards, maximum contrast, text-heavy
2-bit (4 grays)  → RECOMMENDED for most e-ink displays
4-bit (16 grays) → High-quality displays, photos, smooth gradients
8-bit (256 grays)→ Premium displays only, maximum quality
```

### Update Frequency

```
*/2 * * * *    → Every 2 minutes  (security cameras)
*/5 * * * *    → Every 5 minutes  (active dashboards)
*/10 * * * *   → Every 10 minutes (kitchen, office)
*/30 * * * *   → Every 30 minutes (weather, slow-changing)
0 */6 * * *    → Every 6 hours    (calendar, minimize ghosting)
```

### Contrast Adjustments

```
# Standard (no adjustment)
black_level: 0
white_level: 100

# Mild contrast boost
black_level: 5
white_level: 95

# Strong contrast (text-heavy)
black_level: 15
white_level: 85

# Very aggressive (high contrast mode)
black_level: 20
white_level: 80
```

## Cron Expression Examples

```yaml
"*/5 * * * *"      # Every 5 minutes
"0 */2 * * *"      # Every 2 hours
"0 8 * * *"        # Daily at 8 AM
"0 8,12,18 * * *"  # Three times daily (8 AM, 12 PM, 6 PM)
"0 * * * *"        # Every hour
"*/10 8-18 * * *"  # Every 10 min, 8 AM - 6 PM only
"*/5 * * * 1-5"    # Every 5 min, Mon-Fri only
"0 6-22 * * *"     # Every hour, 6 AM - 10 PM
```

[Cron expression tester](https://crontab.guru)

## Testing Your Configuration

### Step 1: Validate YAML

Paste your config into [YAML Lint](https://www.yamllint.com/) to check for syntax errors.

### Step 2: Test with HTTP API First

Before setting up schedules, test with the HTTP API:

```
http://homeassistant.local:10000/lovelace/0?viewport=800x480
```

### Step 3: Check Logs

View add-on logs to see:
- Navigation time
- Screenshot time
- Dithering time
- Upload success/failure

### Step 4: Iterate

Adjust settings based on results:
- Too dark? Increase `black_level`
- Too light? Decrease `white_level`
- Grainy? Increase `bit_depth`
- Patterns? Use `floyd-steinberg` instead of `ordered`

## Common Issues

### "Images are too dark"
→ See `troubleshooting.yaml` "Fix: Images Too Dark"

### "Not enough contrast"
→ See `troubleshooting.yaml` "Fix: Low Contrast"

### "Text is hard to read"
→ See `troubleshooting.yaml` "Fix: Text Readability"

### "File sizes too large"
→ See `troubleshooting.yaml` "Fix: Large File Sizes"

### "Dashboard not fully loading"
→ See `troubleshooting.yaml` "Fix: Incomplete Dashboard"

## Tips for Best Results

### 1. Use an E-ink Optimized Theme

Install [Graphite](https://github.com/TilmanGriesel/graphite):
```yaml
theme: "Graphite E-ink Light"
```

### 2. Keep Gamma Correction Enabled

```yaml
gamma_correction: true  # Always true for e-ink!
```

### 3. Start with 2-bit

```yaml
bit_depth: 2  # Best balance for most displays
```

### 4. Stagger Schedules

Don't run all displays at the same time:
```yaml
# Display 1: On the hour
cron: "0 * * * *"

# Display 2: 15 minutes past
cron: "15 * * * *"

# Display 3: 30 minutes past
cron: "30 * * * *"
```

### 5. Monitor Performance

Check logs for timing:
```
[Kitchen] Navigated in 1500ms
[Kitchen] Screenshot captured in 500ms
Advanced dithering took 200ms
[Kitchen] Successfully uploaded in 300ms (total: 2500ms)
```

## Need More Help?

- 📖 [Main README](../README.md) - Full documentation
- 🏗️ [ARCHITECTURE.md](../ha-puppet/docs/ARCHITECTURE.md) - System design
- 🧪 [TESTING.md](../ha-puppet/docs/TESTING.md) - Testing guide
- 📚 [API.md](../ha-puppet/docs/API.md) - API reference
- 💬 [GitHub Discussions](https://github.com/your-repo/discussions) - Ask questions
- 🐛 [GitHub Issues](https://github.com/your-repo/issues) - Report bugs

---

**Happy e-inking!** 📱➡️🖼️
