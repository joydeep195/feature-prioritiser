const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.post('/score', async (req, res) => {
  const { features } = req.body;

  const prompt = `You are a senior product manager assistant. Score each feature below on three dimensions using ALL the context provided, including the description, acceptance criteria, story points, and epic.

Scoring dimensions:
- User Impact (1-10): How significantly will this improve the user experience or solve a real user pain point? Use the description and acceptance criteria to judge scope and value.
- Effort (1-10): How much engineering effort is required? (10 = very high effort). Use story points as a strong signal if provided. Consider acceptance criteria length and complexity.
- Strategic Alignment (1-10): How well does this align with the product strategy and business goals? Use the epic and any OKR or theme labels as signals.
- Confidence: How confident are you in these scores given the information provided? ("High" if rich context given, "Medium" if partial, "Low" if just a name).

For each feature, respond ONLY with a JSON array in this exact format, no extra text:
[
  {
    "name": "feature name",
    "impact": number,
    "effort": number,
    "alignment": number,
    "confidence": "High or Medium or Low",
    "rationale": "one sentence explanation referencing the context provided"
  }
]

Features to score:
${features.map((f, i) => `
${i + 1}. Feature: ${f.name}
   JIRA ID: ${f.jiraId || 'N/A'}
   Epic: ${f.epic || 'N/A'}
   Description: ${f.description || 'N/A'}
   Acceptance Criteria: ${f.acceptanceCriteria || 'N/A'}
   Story Points: ${f.storyPoints || 'N/A'}
   Priority: ${f.priority || 'N/A'}
   Labels: ${f.labels || 'N/A'}
   Notes: ${f.notes || 'N/A'}
`).join('\n')}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    console.log('Claude response:', JSON.stringify(data));
    const text = data.content[0].text;
    const cleaned = text.replace(/```json|```/g, '').trim();
    const scored = JSON.parse(cleaned);
    res.json({ results: scored });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});