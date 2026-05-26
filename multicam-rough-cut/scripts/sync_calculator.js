#!/usr/bin/env node
/**
 * Calculate sync offsets from clap detection results.
 *
 * Usage:
 *   node sync_calculator.js <clap_results.json> <output_sync_data.json> <file1> [file2] [file3]
 *
 * clap_results.json is the output of detect_clap.js.
 * file1, file2, ... are the original video filenames (mapped by index to clap results).
 *
 * Output: sync_data.json written to the specified path.
 */

const fs = require('fs');
const path = require('path');

function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: node sync_calculator.js <clap_results.json> <output_path> <file1> [file2] [file3]');
    process.exit(1);
  }

  const [clapResultsPath, outputPath, ...videoFiles] = args;
  const clapResults = JSON.parse(fs.readFileSync(clapResultsPath, 'utf-8'));

  if (clapResults.length !== videoFiles.length) {
    console.error(`Mismatch: ${clapResults.length} clap results but ${videoFiles.length} video files`);
    process.exit(1);
  }

  // Primary is the first angle
  const primaryClap = clapResults[0].clapTimeSec;
  if (primaryClap === null) {
    console.error('Could not detect clap in primary angle');
    process.exit(1);
  }

  const angles = videoFiles.map((file, i) => {
    const clapTime = clapResults[i].clapTimeSec;
    if (clapTime === null) {
      console.error(`Could not detect clap in ${file}`);
      process.exit(1);
    }
    // offsetSec: how many seconds after the primary's clap does this angle's clap occur
    // For the primary itself, offset is 0
    // Positive offset means this angle's content starts later relative to primary
    const offsetSec = clapTime - primaryClap;
    return { file: path.basename(file), clapTimeSec: clapTime, offsetSec };
  });

  const syncData = {
    primary: path.basename(videoFiles[0]),
    angles,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(syncData, null, 2));
  console.log(`sync_data.json written: primary=${syncData.primary}`);
  angles.forEach(a => {
    console.log(`  ${a.file}: clap at ${a.clapTimeSec.toFixed(3)}s, offset=${a.offsetSec.toFixed(3)}s`);
  });
}

main();
