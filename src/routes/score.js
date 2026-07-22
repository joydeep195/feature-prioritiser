const express = require('express');
const router = express.Router();
const { scoreFeatures } = require('../services/claudeService');

const MAX_FEATURES = 50;
const MAX_FIELD_LENGTH = 5000;

function trimString(value, maxLength = MAX_FIELD_LENGTH) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function validateScoreRequest(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object.' };
  }

  if (!Array.isArray(body.features) || body.features.length === 0) {
    return { error: 'No features provided.' };
  }

  if (body.features.length > MAX_FEATURES) {
    return { error: `Too many features provided. Maximum is ${MAX_FEATURES}.` };
  }

  const features = [];
  for (let i = 0; i < body.features.length; i += 1) {
    const item = body.features[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: `Feature at index ${i} must be an object.` };
    }

    const name = trimString(item.name, 200);
    if (!name) {
      return { error: `Feature at index ${i} is missing a name.` };
    }

    features.push({
      name,
      jiraId: trimString(item.jiraId, 100),
      notes: trimString(item.notes),
      description: trimString(item.description),
      acceptanceCriteria: trimString(item.acceptanceCriteria),
      storyPoints: trimString(item.storyPoints, 20),
      epic: trimString(item.epic, 200),
      priority: trimString(item.priority, 100),
      labels: trimString(item.labels, 500)
    });
  }

  const priorities = Array.isArray(body.priorities)
    ? body.priorities.map(value => trimString(value, 100)).filter(Boolean).slice(0, 10)
    : [];

  return {
    value: {
      features,
      priorities,
      additionalContext: trimString(body.additionalContext, 2000)
    }
  };
}

router.post('/', async (req, res) => {
  const validation = validateScoreRequest(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const { features, priorities, additionalContext } = validation.value;
    const results = await scoreFeatures(features, priorities, additionalContext);
    res.json({ results });
  } catch (err) {
    console.error('Scoring error:', err.message);
    res.status(500).json({ error: 'Scoring failed. Check server logs.' });
  }
});

module.exports = router;
module.exports.validateScoreRequest = validateScoreRequest;
