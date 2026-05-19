const express = require('express');
const router = express.Router();
const { scoreFeatures } = require('../services/claudeService');

router.post('/', async (req, res) => {
  const { features, priorities, additionalContext } = req.body;

  if (!features || features.length === 0) {
    return res.status(400).json({ error: 'No features provided.' });
  }

  try {
    const results = await scoreFeatures(features, priorities, additionalContext);
    res.json({ results });
  } catch (err) {
    console.error('Scoring error:', err.message);
    res.status(500).json({ error: 'Scoring failed. Check server logs.' });
  }
});

module.exports = router;