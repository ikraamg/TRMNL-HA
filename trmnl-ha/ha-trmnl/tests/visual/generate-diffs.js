#!/usr/bin/env node
/**
 * Visual Diff Generator
 *
 * This script generates visual comparison reports for dithering tests.
 * It creates side-by-side images showing: Input | Expected | Actual | Diff
 *
 * Usage: npm run visual-diff
 *
 * Output: tests/visual/reports/ directory with comparison images
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { applyDithering } from '../../lib/dithering.js';
import { compareImages, generateComparisonImage } from '../helpers/imageComparison.js';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixturesDir = join(__dirname, '../fixtures');
const expectedDir = join(fixturesDir, 'expected');
const snapshotsDir = join(fixturesDir, 'snapshots');
const reportsDir = join(__dirname, 'reports');

// Ensure directories exist
[reportsDir].forEach((dir) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

/**
 * Test configurations matching the reference images
 */
const testConfigs = [
  {
    name: '1bit',
    reference: 'plugin-f39aec-1bit.png',
    options: { method: 'floyd-steinberg', bitDepth: 1, gammaCorrection: true },
  },
  {
    name: '2bit',
    reference: 'plugin-f39aec-2bit.png',
    options: { method: 'floyd-steinberg', bitDepth: 2, gammaCorrection: true },
  },
  {
    name: '4bit',
    reference: 'plugin-f39aec-4bit.png',
    options: { method: 'floyd-steinberg', bitDepth: 4, gammaCorrection: true },
  },
  {
    name: '8bit-dithered',
    reference: 'plugin-f39aec-8bit-dithered.png',
    options: { method: 'floyd-steinberg', bitDepth: 8, gammaCorrection: true },
  },
  {
    name: '8bit-no-dither',
    reference: 'plugin-f39aec-8bit.png',
    options: { method: 'none', bitDepth: 8, gammaCorrection: true },
  },
];

async function generateReports() {
  console.log('🎨 Generating visual diff reports...\n');

  const results = [];

  for (const config of testConfigs) {
    try {
      console.log(`Processing: ${config.name}`);

      const referencePath = join(expectedDir, config.reference);

      if (!existsSync(referencePath)) {
        console.log(`  ⚠️  Reference image not found: ${config.reference}`);
        console.log(`  Skipping...\n`);
        continue;
      }

      // Load reference image
      const referenceBuffer = readFileSync(referencePath);

      // Resize to consistent test size for comparison
      const testSize = 800;
      const inputBuffer = await sharp(referenceBuffer)
        .resize(testSize, null)
        .png()
        .toBuffer();

      // Generate our dithered version
      console.log(`  Applying dithering: ${JSON.stringify(config.options)}`);
      const ourBuffer = await applyDithering(inputBuffer, config.options);

      // Save our output
      const ourPath = join(snapshotsDir, `generated-${config.name}.png`);
      writeFileSync(ourPath, ourBuffer);

      // Compare images
      console.log(`  Comparing images...`);
      const comparison = await compareImages(ourBuffer, referenceBuffer);

      // Generate comparison image (Input | Reference | Ours | Diff)
      console.log(`  Generating comparison report...`);
      const comparisonImage = await generateComparisonImage(
        inputBuffer,
        referenceBuffer,
        ourBuffer,
        comparison.diffBuffer
      );

      // Save comparison
      const reportPath = join(reportsDir, `comparison-${config.name}.png`);
      writeFileSync(reportPath, comparisonImage);

      // Save diff image separately
      const diffPath = join(reportsDir, `diff-${config.name}.png`);
      writeFileSync(diffPath, comparison.diffBuffer);

      console.log(`  ✅ Generated: ${reportPath}`);
      console.log(`  📊 Difference: ${comparison.percentageDifference}%`);
      console.log(`  📍 Different pixels: ${comparison.numDiffPixels}/${comparison.totalPixels}\n`);

      results.push({
        name: config.name,
        percentageDifference: comparison.percentageDifference,
        numDiffPixels: comparison.numDiffPixels,
        totalPixels: comparison.totalPixels,
        reportPath,
      });
    } catch (error) {
      console.error(`  ❌ Error processing ${config.name}:`, error.message);
      console.error(error.stack);
      console.log();
    }
  }

  // Generate summary report
  console.log('📝 Generating summary report...\n');
  const summary = generateSummaryHTML(results);
  const summaryPath = join(reportsDir, 'index.html');
  writeFileSync(summaryPath, summary);

  console.log(`✅ Summary report: ${summaryPath}\n`);
  console.log('🎉 Done! Open tests/visual/reports/index.html to view results.\n');

  // Print summary table
  console.log('Summary:');
  console.log('─'.repeat(80));
  console.log(`${'Test'.padEnd(20)} | ${'Difference %'.padEnd(15)} | ${'Different Pixels'.padEnd(20)}`);
  console.log('─'.repeat(80));
  results.forEach((r) => {
    const status = r.percentageDifference < 1 ? '✅' : r.percentageDifference < 5 ? '⚠️' : '❌';
    console.log(
      `${(status + ' ' + r.name).padEnd(20)} | ${r.percentageDifference.toString().padEnd(15)} | ${r.numDiffPixels}/${r.totalPixels}`
    );
  });
  console.log('─'.repeat(80));
}

function generateSummaryHTML(results) {
  const rows = results
    .map((r) => {
      const status = r.percentageDifference < 1 ? '✅ Excellent' : r.percentageDifference < 5 ? '⚠️ Good' : '❌ Needs Review';

      return `
      <tr>
        <td>${r.name}</td>
        <td>${status}</td>
        <td>${r.percentageDifference}%</td>
        <td>${r.numDiffPixels.toLocaleString()} / ${r.totalPixels.toLocaleString()}</td>
        <td><a href="comparison-${r.name}.png" target="_blank">View</a></td>
      </tr>
    `;
    })
    .join('');

  const imageGallery = results
    .map(
      (r) => `
    <div class="comparison">
      <h3>${r.name}</h3>
      <p>Difference: <strong>${r.percentageDifference}%</strong></p>
      <img src="comparison-${r.name}.png" alt="${r.name} comparison">
    </div>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dithering Visual Regression Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      padding: 2rem;
      background: #f5f5f5;
    }
    h1 { margin-bottom: 2rem; color: #333; }
    h2 { margin: 2rem 0 1rem; color: #666; }
    h3 { margin: 1rem 0 0.5rem; color: #444; }

    .summary {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }

    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #ddd;
    }

    th {
      background: #f8f8f8;
      font-weight: 600;
    }

    tr:hover { background: #f9f9f9; }

    a {
      color: #0066cc;
      text-decoration: none;
    }

    a:hover { text-decoration: underline; }

    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
      gap: 2rem;
      margin-top: 2rem;
    }

    .comparison {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .comparison img {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-top: 1rem;
    }

    .comparison p {
      color: #666;
      margin: 0.5rem 0;
    }

    .legend {
      margin-top: 1rem;
      padding: 1rem;
      background: #f8f8f8;
      border-radius: 4px;
      font-size: 0.9em;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>🎨 Dithering Visual Regression Report</h1>

  <div class="summary">
    <h2>Test Results Summary</h2>
    <p>Generated: ${new Date().toLocaleString()}</p>

    <table>
      <thead>
        <tr>
          <th>Test Name</th>
          <th>Status</th>
          <th>Difference %</th>
          <th>Different Pixels</th>
          <th>Report</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="legend">
      <strong>Legend:</strong>
      <ul style="margin-top: 0.5rem; margin-left: 1.5rem;">
        <li>✅ Excellent: < 1% difference</li>
        <li>⚠️ Good: 1-5% difference</li>
        <li>❌ Needs Review: > 5% difference</li>
      </ul>
      <p style="margin-top: 0.5rem;">
        <strong>Note:</strong> Small differences are expected due to different dithering implementations.
        The key is that the visual quality should be comparable for e-ink displays.
      </p>
    </div>
  </div>

  <h2>Visual Comparisons</h2>
  <p style="margin-bottom: 1rem; color: #666;">
    Each comparison shows: <strong>Input | Reference | Our Output | Difference</strong>
  </p>

  <div class="gallery">
    ${imageGallery}
  </div>
</body>
</html>
  `;
}

// Run the generator
generateReports().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
