const { buildPrompt } = require('../utils/promptBuilder');

async function scoreFeatures(features, priorities, additionalContext) {
  const prompt = buildPrompt(features, priorities, additionalContext);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();

  if (data.type === 'error') {
    throw new Error(`Claude API error: ${data.error.message}`);
  }

  const text = data.content[0].text;
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { scoreFeatures };