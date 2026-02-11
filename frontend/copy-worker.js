const fs = require('fs');
const path = require('path');

// Copy PDF worker
const sourceFile = path.join(__dirname, 'public', 'pdf.worker.min.mjs');
const destFile = path.join(__dirname, 'out', 'pdf.worker.min.mjs');

try {
  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, destFile);
    console.log('✓ PDF worker copied to out/ directory');
  } else {
    console.error('✗ PDF worker source file not found');
  }
} catch (error) {
  console.error('✗ Error copying PDF worker:', error);
}

// Copy config.js
const configSource = path.join(__dirname, 'public', 'config.js');
const configDest = path.join(__dirname, 'out', 'config.js');

try {
  if (fs.existsSync(configSource)) {
    fs.copyFileSync(configSource, configDest);
    console.log('✓ config.js copied to out/ directory');
  } else {
    console.error('✗ config.js source file not found');
  }
} catch (error) {
  console.error('✗ Error copying config.js:', error);
}
