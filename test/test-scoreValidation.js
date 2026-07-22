const assert = require('assert');
const { validateScoreRequest } = require('../src/routes/score');
const { normalizeClaudeResults } = require('../src/services/claudeService');

(function testValidateScoreRequestRejectsInvalidFeatures() {
  const result = validateScoreRequest({ features: 'not an array' });

  assert.strictEqual(result.error, 'No features provided.');
  console.log('testValidateScoreRequestRejectsInvalidFeatures passed');
})();

(function testValidateScoreRequestSanitizesPayload() {
  const result = validateScoreRequest({
    features: [{
      name: '  Improve onboarding  ',
      jiraId: 123,
      description: 'A'.repeat(6000),
      storyPoints: ' 5 '
    }],
    priorities: [' Impact ', 42, ''],
    additionalContext: '  launch soon  '
  });

  assert.ifError(result.error);
  assert.strictEqual(result.value.features[0].name, 'Improve onboarding');
  assert.strictEqual(result.value.features[0].jiraId, '');
  assert.strictEqual(result.value.features[0].description.length, 5000);
  assert.deepStrictEqual(result.value.priorities, ['Impact']);
  assert.strictEqual(result.value.additionalContext, 'launch soon');
  console.log('testValidateScoreRequestSanitizesPayload passed');
})();

(function testNormalizeClaudeResultsClampsAndDefaults() {
  const results = normalizeClaudeResults([{
    name: 'Search',
    impact: 14,
    effort: -2,
    alignment: 7.6,
    storyPoints: 9,
    risk: 'Severe',
    confidence: 'Certain',
    nextStep: '  Review with engineering  ',
    rationale: '  High leverage  '
  }]);

  assert.deepStrictEqual(results[0], {
    name: 'Search',
    impact: 10,
    effort: 1,
    alignment: 8,
    storyPoints: 8,
    risk: 'Medium',
    nextStep: 'Review with engineering',
    confidence: 'Medium',
    rationale: 'High leverage'
  });
  console.log('testNormalizeClaudeResultsClampsAndDefaults passed');
})();
