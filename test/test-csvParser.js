const assert = require('assert');
const CSVHandler = require('../public/js/csvHandler.js');

(function testParseCSVWithQuotedCommas() {
  const text = `JIRA_ID,Feature Name,Description,Acceptance Criteria,Story Points,Epic,Priority,Labels\n` +
    `PROJ-1,Improve report export,"Export data, charts, and filters to CSV","Include all fields, preserve formatting",8,Reporting,High,"export,analytics"\n` +
    `PROJ-2,Add dark mode,"Add dark theme support","Toggle in user settings, remember preference",5,UX,Medium,"ui,accessibility"`;

  const { count, meta } = CSVHandler.parseText(text);
  assert.strictEqual(count, 2, 'Expected two rows to parse');
  assert.strictEqual(meta['Improve report export'].jiraId, 'PROJ-1');
  assert.strictEqual(meta['Improve report export'].description, 'Export data, charts, and filters to CSV');
  assert.strictEqual(meta['Improve report export'].labels, 'export,analytics');
  assert.strictEqual(meta['Add dark mode'].storyPoints, '5');

  console.log('testParseCSVWithQuotedCommas passed');
})();

(function testParseCSVWithHeader() {
  const text = `JIRA_ID,Feature Name,Description,Acceptance Criteria,Story Points,Epic,Priority,Labels\n` +
    `PROJ-3,Auto-save drafts,Save user drafts automatically,"Preserve draft content on refresh",3,Product,Low,"autosave,drafting"\n` +
    `PROJ-4,Improve search,Search across all fields,"Return results in under 300ms",8,Search,High,"search,performance"`;

  const { count, meta } = CSVHandler.parseText(text);
  assert.strictEqual(count, 2, 'Expected two rows with header');
  assert.strictEqual(meta['Auto-save drafts'].jiraId, 'PROJ-3');
  assert.strictEqual(meta['Improve search'].epic, 'Search');

  console.log('testParseCSVWithHeader passed');
})();

(function testParseCSVMalformedQuotedField() {
  const text = `JIRA_ID,Feature Name,Description\nPROJ-5,Broken row,"This field is not closed\n`;
  let didThrow = false;

  try {
    CSVHandler.parseText(text);
  } catch (err) {
    didThrow = true;
    assert.strictEqual(err.message, 'Malformed CSV: missing closing quotation mark.');
  }

  assert.strictEqual(didThrow, true, 'Expected malformed CSV to throw');
  console.log('testParseCSVMalformedQuotedField passed');
})();
