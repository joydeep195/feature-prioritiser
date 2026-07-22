const path = require('path');
const tests = [
  'test-csvParser.js',
  'test-promptBuilder.js',
  'test-scoreValidation.js'
];

let failed = 0;

tests.forEach(file => {
  const fullPath = path.join(__dirname, file);
  try {
    require(fullPath);
    console.log('PASS', file);
  } catch (err) {
    failed += 1;
    console.error('FAIL', file);
    console.error(err.stack || err);
  }
});

if (failed) {
  console.error(`\n${failed} test file(s) failed.`);
  process.exit(1);
}

console.log('\nAll tests passed.');
