# TRMNL HA Add-on Dockerfile
# Debian-based image with Chromium and Node.js for Puppeteer screenshot automation

FROM debian:bullseye-slim

# =============================================================================
# ENVIRONMENT SETUP
# =============================================================================

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

# =============================================================================
# SYSTEM DEPENDENCIES
# =============================================================================

RUN apt-get update && apt-get install -y \
    # Browser for Puppeteer
    chromium \
    # Required for downloading Node.js setup
    curl \
    # CJK font support for international dashboards
    fonts-noto-cjk \
    # Image processing for dithering
    graphicsmagick \
    # Install Node.js 23.x
    && curl -fsSL https://deb.nodesource.com/setup_23.x -o nodesource_setup.sh \
    && bash nodesource_setup.sh \
    && apt-get install -y nodejs \
    # Cleanup to reduce image size
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm nodesource_setup.sh

# =============================================================================
# APPLICATION SETUP
# =============================================================================

WORKDIR /app

# Install dependencies first for better caching
COPY ha-trmnl/package*.json ./
RUN npm ci --unsafe-perm

# Copy application code
COPY ha-trmnl/ .

# =============================================================================
# RUNTIME
# =============================================================================

CMD ["node", "main.js"]
