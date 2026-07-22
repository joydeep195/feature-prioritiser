const assert = require('assert');
const { buildPrompt } = require('../src/utils/promptBuilder');

(function testPromptIncludesPrioritiesAndFeatureDetails() {
  const features = [
    {
      name: 'Improve onboarding flow',
      jiraId: 'PROJ-10',
      epic: 'User Activation',
      description: 'As a new user, I want guided onboarding steps.',
      acceptanceCriteria: 'Show first-time tutorial, save progress automatically.',
      storyPoints: 5,
      priority: 'High',
      labels: 'onboarding,growth',
      notes: 'Critical for Q3 launch'
    }
  ];

  const prompt = buildPrompt(features, ['Maximise user impact', 'Improve conversion'], 'We are preparing for a product launch.');
  assert.ok(prompt.includes('The team\'s current priorities are: Maximise user impact, Improve conversion.'), 'Prompt should include priorities.');
  assert.ok(prompt.includes('Improve onboarding flow'), 'Prompt should include feature name.');
  assert.ok(prompt.includes('PROJ-10'), 'Prompt should include JIRA ID.');
  assert.ok(prompt.includes('High'), 'Prompt should include priority label.');
  assert.ok(prompt.includes('Additional context from the team: We are preparing for a product launch.'), 'Prompt should include additional context.');

  console.log('testPromptIncludesPrioritiesAndFeatureDetails passed');
})();
