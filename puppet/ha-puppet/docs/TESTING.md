# Testing Guide

Comprehensive guide to testing the Puppet add-on, including unit tests, visual regression tests, and integration tests.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Visual Regression Testing](#visual-regression-testing)
- [Coverage Reports](#coverage-reports)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)

## Overview

Our testing strategy follows a three-tier approach:

1. **Unit Tests** - Fast, isolated function tests
2. **Visual Tests** - Image quality regression tests
3. **Integration Tests** - End-to-end workflow tests

### Test Statistics

- **Total Tests:** 49
- **Unit Tests:** 34
- **Visual Tests:** 15
- **Coverage:** 90%+ for core modules
- **Run Time:** ~13 seconds

## Quick Start

```bash
# Install dependencies (includes GraphicsMagick)
npm install
brew install graphicsmagick  # macOS
# OR
sudo apt-get install graphicsmagick  # Ubuntu/Debian

# Run all tests
npm test

# Run tests in watch mode (great for TDD)
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Test Structure

```
tests/
├── unit/                      # Unit tests (fast, isolated)
│   └── dithering.test.js     # Dithering module tests
│
├── integration/               # Integration tests
│   └── [future tests]
│
├── visual/                    # Visual regression tests
│   ├── dithering.visual.test.js
│   ├── generate-diffs.js     # Visual diff generator
│   └── reports/              # Generated comparison reports
│
├── helpers/                   # Test utilities
│   └── imageComparison.js    # Image comparison tools
│
└── fixtures/                  # Test data
    ├── input/                # Test input images
    ├── expected/             # Reference outputs
    └── snapshots/            # Generated test outputs
```

## Running Tests

### All Tests

```bash
npm test
```

Runs all unit and visual tests with Jest.

### By Type

```bash
# Unit tests only (fast - ~2s)
npm run test:unit

# Visual tests only (slower - ~12s)
npm run test:visual

# Integration tests
npm run test:integration
```

### Specific Files

```bash
# Run single test file
npm test -- tests/unit/dithering.test.js

# Run tests matching pattern
npm test -- --testNamePattern="2-bit"
```

### Watch Mode

```bash
# Run tests on file change (great for TDD)
npm run test:watch

# Watch specific file
npm test -- --watch tests/unit/dithering.test.js
```

### Coverage

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html
```

### Visual Diff Reports

```bash
# Generate visual comparison reports
npm run visual-diff

# View HTML report
open tests/visual/reports/index.html
```

## Writing Tests

### Unit Test Template

```javascript
import { describe, it, expect, beforeAll } from '@jest/globals';
import { myFunction } from '../../lib/myModule.js';

describe('MyModule', () => {
  let testData;

  beforeAll(() => {
    // Setup runs once before all tests
    testData = createTestData();
  });

  describe('myFunction', () => {
    it('should handle valid input', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = myFunction(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should throw error for invalid input', () => {
      expect(() => myFunction(null)).toThrow('Invalid input');
    });
  });
});
```

### Async Test Example

```javascript
it('should process image buffer', async () => {
  const buffer = await createTestImage();

  const result = await applyDithering(buffer, {
    method: 'floyd-steinberg',
    bitDepth: 2,
  });

  expect(result).toBeInstanceOf(Buffer);
  expect(result.length).toBeGreaterThan(0);
});
```

### Test Naming Conventions

**Format:** `should [expected behavior] when [condition]`

**Good Examples:**
- ✅ `should return buffer when given valid input`
- ✅ `should throw error when buffer is invalid`
- ✅ `should produce 2-bit image when bitDepth is 2`

**Bad Examples:**
- ❌ `test 1`
- ❌ `it works`
- ❌ `applyDithering`

### Test Organization

```javascript
describe('Module Name', () => {
  describe('Function Name', () => {
    describe('Happy Path', () => {
      it('should handle standard case', () => {});
      it('should handle edge case', () => {});
    });

    describe('Error Cases', () => {
      it('should throw for null input', () => {});
      it('should throw for invalid type', () => {});
    });

    describe('Edge Cases', () => {
      it('should handle empty input', () => {});
      it('should handle large input', () => {});
    });
  });
});
```

## Visual Regression Testing

Visual tests ensure image processing quality doesn't regress.

### How Visual Tests Work

1. **Generate test image** - Create consistent test input
2. **Apply processing** - Run dithering/transformation
3. **Compare output** - Check against reference images
4. **Assert quality** - Verify metrics (color count, histogram)

### Writing Visual Tests

```javascript
it('should produce 2-bit dithered image', async () => {
  // Generate input
  const input = await createTestImage();

  // Apply processing
  const result = await applyDithering(input, {
    method: 'floyd-steinberg',
    bitDepth: 2,
  });

  // Save snapshot for visual inspection
  writeFileSync('tests/fixtures/snapshots/2bit-output.png', result);

  // Assert quality metrics
  const histogram = await getColorHistogram(result);
  expect(histogram.uniqueColors).toBeLessThanOrEqual(20); // ~4 colors

  // Verify it's a valid image
  const metadata = await sharp(result).metadata();
  expect(metadata.format).toBe('png');
  expect(metadata.channels).toBe(1); // Grayscale
});
```

### Comparing Images

```javascript
import { compareImages, areImagesSimilar } from '../helpers/imageComparison.js';

it('should produce different results with different methods', async () => {
  const floyd = await applyDithering(input, { method: 'floyd-steinberg' });
  const ordered = await applyDithering(input, { method: 'ordered' });

  // Compare pixel-by-pixel
  const diff = await compareImages(floyd, ordered);
  console.log(`Difference: ${diff.percentageDifference}%`);

  // Assert they're different
  const areSame = await areImagesSimilar(floyd, ordered, 1); // 1% tolerance
  expect(areSame).toBe(false);
});
```

### Visual Diff Generation

Generate HTML reports comparing actual vs expected output:

```bash
npm run visual-diff
```

This creates:
- `tests/visual/reports/index.html` - Summary page
- `tests/visual/reports/comparison-*.png` - Side-by-side comparisons
- `tests/visual/reports/diff-*.png` - Difference images

**Report Format:**
```
[Input] | [Expected] | [Actual] | [Diff (red=changed)]
```

### Reference Images

Reference images are from the TRMNL converter library:

```
tests/fixtures/expected/
├── plugin-f39aec-1bit.png      # 1-bit reference
├── plugin-f39aec-2bit.png      # 2-bit reference
├── plugin-f39aec-4bit.png      # 4-bit reference
├── plugin-f39aec-8bit-dithered.png  # 8-bit with dither
└── plugin-f39aec-8bit.png      # 8-bit no dither
```

We don't expect pixel-perfect matches (different implementations), but we verify:
- Similar color count
- Visual quality comparable
- No obvious artifacts

## Coverage Reports

### Viewing Coverage

```bash
# Generate and open report
npm run test:coverage
open coverage/lcov-report/index.html
```

### Coverage Metrics

| Module | Lines | Branches | Functions | Target |
|--------|-------|----------|-----------|--------|
| **lib/dithering.js** | 92% | 91% | 100% | ✅ 90% |
| **helpers/imageComparison.js** | 71% | 72% | 85% | ✅ 70% |

### Coverage Thresholds

Configured in `package.json`:

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "lines": 70,
        "functions": 85,
        "branches": 70
      },
      "lib/dithering.js": {
        "lines": 90,
        "functions": 100,
        "branches": 90
      }
    }
  }
}
```

Tests **fail** if coverage drops below thresholds.

### Improving Coverage

Find uncovered lines in the report:

```
File: lib/dithering.js
───────────────────────────────────────
Line 139: E       // Error case not tested
Line 155: E       // Branch not covered
```

Add tests for uncovered code paths.

## CI/CD

### GitHub Actions Workflow

Tests run automatically on:
- Every push to any branch
- Every pull request
- Daily scheduled run

**Workflow:** `.github/workflows/test.yml`

```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install GraphicsMagick
        run: sudo apt-get install -y graphicsmagick
      - name: Install dependencies
        run: npm ci
      - name: Run linter
        run: npm run lint
      - name: Run tests
        run: npm test
      - name: Check coverage
        run: npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

### Pre-commit Hooks

Install pre-commit hooks to run tests before commit:

```bash
# Configured in package.json with husky
npm install  # Sets up hooks automatically
```

Hooks run:
1. Linter (`npm run lint`)
2. Unit tests (`npm run test:unit`)

If tests fail, commit is blocked.

## Troubleshooting

### Tests Failing Locally

**GraphicsMagick not found:**
```
Error: spawn gm ENOENT
```

**Fix:**
```bash
# macOS
brew install graphicsmagick

# Ubuntu/Debian
sudo apt-get install graphicsmagick

# Verify installation
gm version
```

**Image comparison failures:**
```
Error: Image dimensions don't match: 800x600 vs 800x480
```

**Fix:**
- Ensure test images have correct dimensions
- Regenerate test fixtures if needed
- Check that image processing doesn't change dimensions unexpectedly

**Memory errors:**
```
JavaScript heap out of memory
```

**Fix:**
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
npm test
```

### Visual Test Failures

**Images don't match reference:**

1. **Check if reference is correct**
   - View `tests/visual/reports/index.html`
   - Compare actual vs expected side-by-side

2. **Acceptable differences**
   - Small color count variations (~±5 colors) are OK
   - Slight file size differences are OK
   - Pixel-perfect match not required

3. **Update reference if intentional change**
   ```bash
   # Replace reference with new output
   cp tests/fixtures/snapshots/test-2bit.png tests/fixtures/expected/
   ```

### Slow Tests

**Visual tests taking too long:**

```bash
# Run only unit tests during development
npm run test:unit

# Run visual tests before committing
npm run test:visual
```

**Specific test taking too long:**

Check for:
- Large test images (resize to reasonable size)
- Infinite loops
- Network timeouts
- Heavy computation in test setup

### Test Isolation Issues

**Tests passing individually but failing together:**

Cause: Shared state between tests

**Fix:**
- Use `beforeEach` instead of `beforeAll` for mutable state
- Clean up after tests with `afterEach`
- Avoid global variables

```javascript
describe('Tests', () => {
  let cleanState;

  beforeEach(() => {
    // Fresh state for each test
    cleanState = {};
  });

  afterEach(() => {
    // Cleanup
    cleanState = null;
  });
});
```

## Best Practices

### Test Structure

1. **Arrange** - Set up test data
2. **Act** - Execute the code
3. **Assert** - Verify results

```javascript
it('should process image', async () => {
  // Arrange
  const input = await createTestImage();

  // Act
  const result = await processImage(input);

  // Assert
  expect(result).toBeDefined();
});
```

### Test Data

- Use **small** test images (100x100) for speed
- Create test data programmatically when possible
- Use fixtures for complex cases
- Don't commit large binary files

### Assertions

**Be specific:**
```javascript
// ❌ Vague
expect(result).toBeTruthy();

// ✅ Specific
expect(result).toBeInstanceOf(Buffer);
expect(result.length).toBe(1234);
```

**Test behavior, not implementation:**
```javascript
// ❌ Testing implementation
expect(mockFunction).toHaveBeenCalledWith(specificArg);

// ✅ Testing behavior
expect(result.status).toBe('success');
```

### Performance

- Unit tests should be **fast** (<100ms)
- Visual tests can be slower (<2s per test)
- Use `it.only()` to focus on specific test during development
- Use `it.skip()` to temporarily disable flaky tests (but fix them!)

### Documentation

Document **why**, not **what**:

```javascript
// ❌ Obvious
it('should return true', () => {
  expect(func()).toBe(true);
});

// ✅ Explains purpose
it('should validate user input successfully when all fields are present', () => {
  expect(validateInput(completeData)).toBe(true);
});
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Sharp API](https://sharp.pixelplumbing.com/api-constructor)
- [Pixelmatch](https://github.com/mapbox/pixelmatch)
- [Testing Best Practices](https://testingjavascript.com/)

---

**Questions?** See [CONTRIBUTING.md](CONTRIBUTING.md) or open a GitHub Discussion.
