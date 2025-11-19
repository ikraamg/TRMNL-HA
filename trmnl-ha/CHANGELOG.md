# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Advanced Dithering System**
  - Floyd-Steinberg error diffusion dithering
  - Ordered (Bayer) dithering
  - Support for 1-bit, 2-bit, 4-bit, and 8-bit grayscale conversion
  - Gamma correction for e-ink displays
  - Black/white level adjustments for contrast control
  - GraphicsMagick integration for professional image processing

- **Comprehensive Testing**
  - 49 automated tests with 90%+ code coverage
  - Unit tests for dithering module (34 tests)
  - Visual regression tests (15 tests)
  - Integration tests for screenshot pipeline
  - Image comparison helpers
  - Visual diff report generator

- **Documentation**
  - CONTRIBUTING.md - Complete development guide
  - ARCHITECTURE.md - System design and component breakdown
  - TESTING.md - Testing strategy and guidelines
  - API.md - Complete API reference with examples
  - IMPLEMENTATION_SUMMARY.md - Project overview

- **Example Configurations**
  - basic-eink.yaml - Starter config for most e-ink displays
  - high-quality.yaml - 4-bit high-quality config
  - multi-display.yaml - Multi-display setup (6 displays)
  - troubleshooting.yaml - 11 common problems with fixes
  - examples/README.md - Comprehensive configuration guide

- **CI/CD Infrastructure**
  - GitHub Actions workflow for automated testing
  - Linting on every push/PR
  - Multi-platform Docker builds (amd64, arm64, armv7)
  - Automated release workflow with version tagging
  - Code coverage reporting with Codecov
  - Integration smoke tests

- **GitHub Templates**
  - Pull request template with checklist
  - Bug report issue template
  - Feature request issue template
  - Code of Conduct (Contributor Covenant)
  - Security policy and vulnerability reporting guidelines

- **Dependency Management**
  - Dependabot configuration for npm, Docker, and GitHub Actions
  - Automated weekly dependency updates

### Changed
- Extended config schema with dithering options (`dithering.enabled`, `dithering.method`, `dithering.bit_depth`, etc.)
- Updated Dockerfile to include GraphicsMagick installation
- Enhanced screenshot.js with dithering pipeline integration
- Improved scheduler.js to pass dithering configuration

### Fixed
- GraphicsMagick callback API integration for Promise-based workflow
- Visual test consistency for gamma correction

## 2.2.0

- Add URL parameter syncing: all form settings are now represented in the browser URL for easy sharing
- Add screenshot URL import feature with modal dialog
- Auto-preview when changing theme, dark mode, color inversion, format, or rotation
- Simplify footer design with centered attribution link
- Change default path from `/` to `/lovelace`

## 2.1.0

- Fetch Home Assistant data (themes, network URLs, language) and inject into UI
- Auto-populate theme picker dropdown with available themes from Home Assistant
- Use Home Assistant internal URL with port 10000 for screenshot generation
- Auto-prefill language field from Home Assistant configuration
- Add error page for missing access token configuration
- Add error page for connection failures (invalid token or unreachable instance)
- Reorganize HTML files into dedicated html/ folder
- Add link to Home Assistant Community themes

## 2.0.0

- Add user interface to generate screenshot URLs with custom parameters.
