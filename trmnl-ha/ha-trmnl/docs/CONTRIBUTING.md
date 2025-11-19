# Contributing to TRMNL HA Add-on

First off, thank you for considering contributing to TRMNL HA! It's people like you that make this add-on better for everyone in the Home Assistant community. 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Adding New Features](#adding-new-features)

## Code of Conduct

This project adheres to a simple code of conduct: **Be excellent to each other.**

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community

## Getting Started

### Prerequisites

- Node.js 23+ (for development)
- GraphicsMagick (for image processing)
- Docker (optional, for testing the full add-on)
- Git

### Quick Start

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/home-assistant-addons.git
   cd home-assistant-addons/trmnl-ha/ha-trmnl
   ```

2. **Install Dependencies**
   ```bash
   npm install

   # Install GraphicsMagick
   # macOS:
   brew install graphicsmagick

   # Ubuntu/Debian:
   sudo apt-get install graphicsmagick
   ```

3. **Run Tests**
   ```bash
   npm test
   ```

## Development Setup

### Project Structure

```
ha-trmnl/
├── lib/                    # Core libraries
│   └── dithering.js       # Image dithering module
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   ├── visual/            # Visual regression tests
│   ├── helpers/           # Test utilities
│   └── fixtures/          # Test images
├── docs/                  # Documentation
├── screenshot.js          # Browser automation
├── scheduler.js           # Cron scheduling
├── http.js                # HTTP server
└── package.json
```

### Configuration Files

- **options-dev.json** - Local development config (copy from `options-dev.json.sample`)
- **eslint.config.js** - Code style rules
- **package.json** - Dependencies and scripts

### Environment Setup

Create `options-dev.json`:

```json
{
  "access_token": "your_ha_token",
  "home_assistant_url": "http://localhost:8123",
  "schedules": []
}
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/my-awesome-feature
```

Branch naming:
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation only
- `test/description` - Test improvements
- `refactor/description` - Code refactoring

### 2. Make Your Changes

Follow the [Code Style](#code-style) guidelines.

### 3. Write Tests

**Every new feature needs tests!** See [Testing Guide](TESTING.md) for details.

```bash
# Run tests as you develop
npm run test:watch

# Run specific test file
npm test -- tests/unit/dithering.test.js
```

### 4. Document Your Changes

- Add JSDoc comments to new functions
- Update relevant documentation files
- Add inline comments for complex logic using NOTE/TODO/AI prefixes

### 5. Run Full Test Suite

```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Lint check
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

## Testing

### Test Types

1. **Unit Tests** (`tests/unit/`)
   - Test individual functions in isolation
   - Fast execution (<100ms per test)
   - Mock external dependencies

2. **Visual Tests** (`tests/visual/`)
   - Verify image processing quality
   - Compare against reference images
   - Generate visual diff reports

3. **Integration Tests** (`tests/integration/`)
   - Test complete workflows
   - End-to-end scenarios

### Writing Tests

**Good test example:**

```javascript
describe('applyDithering', () => {
  it('should handle 2-bit dithering with valid input', async () => {
    // Arrange
    const inputBuffer = await createTestImage();

    // Act
    const result = await applyDithering(inputBuffer, {
      method: 'floyd-steinberg',
      bitDepth: 2,
    });

    // Assert
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);

    // Verify image quality
    const histogram = await getColorHistogram(result);
    expect(histogram.uniqueColors).toBeLessThanOrEqual(20);
  });
});
```

### Running Visual Tests

```bash
# Run visual regression tests
npm run test:visual

# Generate visual diff reports
npm run visual-diff

# View reports
open tests/visual/reports/index.html
```

## Code Style

### JavaScript Style

We use ESLint with modern JavaScript standards:

- **ES Modules** - Use `import/export`, not `require`
- **Async/Await** - Prefer over callbacks
- **const/let** - Never use `var`
- **Arrow Functions** - Use for callbacks
- **Template Literals** - Use for string interpolation

**Good:**
```javascript
import { applyDithering } from './lib/dithering.js';

async function processDashboard(config) {
  const result = await applyDithering(buffer, {
    method: 'floyd-steinberg',
    bitDepth: 2,
  });

  console.log(`Processed in ${duration}ms`);
  return result;
}
```

**Bad:**
```javascript
var dithering = require('./lib/dithering');

function processDashboard(config, callback) {
  dithering.applyDithering(buffer, function(err, result) {
    console.log('Processed in ' + duration + 'ms');
    callback(err, result);
  });
}
```

### Documentation Style

#### JSDoc Comments

All public functions must have JSDoc:

```javascript
/**
 * Apply dithering to image for e-ink displays
 *
 * @param {Buffer} imageBuffer - Input image buffer
 * @param {Object} options - Dithering configuration
 * @param {string} [options.method='floyd-steinberg'] - Dithering method
 * @param {number} [options.bitDepth=4] - Target bit depth (1, 2, 4, 8)
 * @returns {Promise<Buffer>} Dithered image buffer
 *
 * @example
 * const dithered = await applyDithering(buffer, {
 *   method: 'floyd-steinberg',
 *   bitDepth: 2
 * });
 */
```

#### Inline Comments

Use prefixed comments for special notes:

```javascript
// NOTE: This is critical for e-ink display quality
// AI: When modifying, preserve the gamma correction step
// TODO: Add support for custom dithering matrices (ticket: #123)
// QUESTION: Should we support RGB dithering?
```

### Naming Conventions

- **Functions**: `camelCase` - `applyDithering`, `getColorHistogram`
- **Classes**: `PascalCase` - `Browser`, `Scheduler`
- **Constants**: `UPPER_SNAKE_CASE` - `HEADER_HEIGHT`, `DEFAULT_ZOOM`
- **Files**: `kebab-case` or `camelCase` - `dithering.js`, `image-comparison.js`

## Commit Messages

Write clear, concise commit messages:

**Format:**
```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no code change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat: add 8-bit grayscale dithering support

Implement 8-bit (256 gray levels) dithering option for high-quality
e-ink displays. Includes Floyd-Steinberg algorithm optimization
for better performance on large images.

Closes #42
```

```
fix: correct gamma correction for images without embedded profiles

Images without embedded color profiles were not being handled correctly.
Now falls back to linear processing when no profile is detected.

Fixes #38
```

## Pull Request Process

### Before Submitting

1. ✅ Run full test suite: `npm test`
2. ✅ Check code coverage: `npm run test:coverage`
3. ✅ Lint your code: `npm run lint`
4. ✅ Update documentation if needed
5. ✅ Add yourself to contributors list (if not already there)

### Submitting PR

1. **Push your branch**
   ```bash
   git push origin feature/my-awesome-feature
   ```

2. **Create Pull Request on GitHub**
   - Use a clear, descriptive title
   - Reference any related issues
   - Provide context in the description

3. **PR Template**
   ```markdown
   ## Description
   Brief description of what this PR does

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Documentation update
   - [ ] Performance improvement

   ## Testing
   - [ ] Unit tests added/updated
   - [ ] Visual tests added/updated
   - [ ] Manual testing performed

   ## Screenshots (if applicable)
   Before/after screenshots for visual changes

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] Tests pass locally
   - [ ] No new warnings

   ## Related Issues
   Closes #issue_number
   ```

4. **Respond to Feedback**
   - Address review comments
   - Push updates to the same branch
   - Request re-review when ready

### Review Process

- At least one maintainer approval required
- All CI checks must pass
- Code coverage must not decrease
- Documentation must be updated

## Adding New Features

### New Dithering Algorithms

Want to add a new dithering algorithm? Great! Here's the process:

1. **Add algorithm to `lib/dithering.js`**
   ```javascript
   if (method === 'my-algorithm') {
     image = image.customDithering(params);
   }
   ```

2. **Update `getSupportedMethods()`**
   ```javascript
   'my-algorithm': {
     description: 'My awesome algorithm',
     recommended: false,
     bitDepths: [1, 2, 4, 8],
   }
   ```

3. **Add tests in `tests/unit/dithering.test.js`**
   ```javascript
   it('should handle my-algorithm dithering', async () => {
     const result = await applyDithering(buffer, {
       method: 'my-algorithm',
       bitDepth: 2,
     });
     expect(result).toBeInstanceOf(Buffer);
   });
   ```

4. **Add visual regression test**
   ```javascript
   it('my-algorithm should produce different result than floyd-steinberg', async () => {
     // Compare outputs
   });
   ```

5. **Update config schema in `../config.yaml`**
   ```yaml
   method: list(floyd-steinberg|ordered|my-algorithm|none)?
   ```

6. **Document in README and API.md**

### New Configuration Options

1. Update config schema
2. Update scheduler/screenshot to pass option
3. Add validation
4. Write tests
5. Document with examples

## Tips for Contributors

### Performance

- Dithering should complete in <500ms for typical images
- Use `console.log` with timing info for debugging
- Profile with Node.js profiler for optimization

### Testing

- Write tests first (TDD approach)
- Test edge cases (empty, huge, corrupted images)
- Visual tests help catch quality regressions

### Documentation

- Explain **why**, not just **what**
- Include code examples
- Keep it concise but complete

### Getting Help

- Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Read [TESTING.md](TESTING.md) for testing details
- Look at [API.md](API.md) for function references
- Ask questions in GitHub Discussions

## Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- GitHub contributors graph

Thank you for contributing! 🎉

---

**Questions?** Open a GitHub Discussion or reach out to maintainers.

**Found a security issue?** Please email security@example.com instead of opening a public issue.
