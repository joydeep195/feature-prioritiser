function buildPrompt(features, priorities, additionalContext) {
  const priorityContext = priorities.length > 0
    ? `The team's current priorities are: ${priorities.join(', ')}.`
    : 'Use balanced scoring across all dimensions.';

  const contextNote = additionalContext
    ? `Additional context from the team: ${additionalContext}`
    : '';

  return `You are a senior product manager assistant helping a product team prioritise their backlog.

${priorityContext}
${contextNote}

Score each feature on these dimensions:
- User Impact (1-10): How significantly will this improve user experience or solve a real pain point?
- Effort (1-10): How much engineering effort is required? (10 = very high effort)
- Strategic Alignment (1-10): How well does this align with the team's stated priorities and business goals?
- Story Points (number): Estimate the story points for this feature based on complexity and scope. Use Fibonacci scale: 1, 2, 3, 5, 8, 13, 21. If story points are already provided in the feature data, use that value exactly.
- Risk: One of "Low", "Medium", or "High". Flag anything with dependencies, compliance concerns, or technical uncertainty.
- Next Step: One concrete action the team should take if they decide to build this.
- Confidence: "High" if you have rich context, "Medium" if partial, "Low" if just a name.

For each feature, respond ONLY with a JSON array in this exact format, no extra text:
[
  {
    "name": "feature name",
    "impact": number,
    "effort": number,
    "alignment": number,
    "storyPoints": number,
    "risk": "Low or Medium or High",
    "nextStep": "one concrete action",
    "confidence": "High or Medium or Low",
    "rationale": "one sentence referencing the context provided"
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
}

module.exports = { buildPrompt };