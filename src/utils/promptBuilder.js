function buildPrompt(features, priorities, additionalContext) {
  const priorityContext = priorities.length > 0
    ? `The team's current priorities are: ${priorities.join(', ')}.`
    : 'Use balanced scoring across all dimensions.';

  const contextNote = additionalContext
    ? `Additional context from the team: ${additionalContext}`
    : '';

  return `You are a senior product manager and agile coach helping a product team prioritise their JIRA backlog.

${priorityContext}
${contextNote}

For each feature, provide the following:

1. User Impact (1-10): How significantly will this improve user experience or solve a real pain point? Consider the description, acceptance criteria, and user story.

2. Effort (1-10): How much overall engineering effort is required? (1 = trivial, 10 = extremely complex). Consider technical complexity, dependencies, and scope.

3. Strategic Alignment (1-10): How well does this align with the team's stated priorities and business goals? Use the epic, labels, and context provided.

4. Story Points: Estimate the engineering effort in story points using the Fibonacci scale only: 1, 2, 3, 5, 8, 13, 21.
   - 1-2 SP: Simple change, minimal risk, a few hours of work
   - 3 SP: Small feature, well understood, less than a day
   - 5 SP: Medium feature, some unknowns, 2-3 days
   - 8 SP: Large feature, significant complexity, about a week
   - 13 SP: Very large, multiple components affected, 1-2 weeks
   - 21 SP: Epic-sized, should be broken down, more than 2 weeks
   If story points are already provided in the feature data, use that exact value and do not override it.

5. Risk: "Low", "Medium", or "High".
   - Low: Well understood, no dependencies, no compliance concerns
   - Medium: Some unknowns, minor dependencies, or moderate complexity
   - High: Significant unknowns, external dependencies, compliance concerns, or architectural changes

6. Next Step: One concrete, actionable next step if the team decides to build this. Be specific. Examples: "Break into subtasks before sprint planning", "Get security sign-off first", "Run 5-user discovery session this week".

7. Confidence: "High" if you have rich context (description + AC + epic), "Medium" if partial context, "Low" if just a feature name.

Respond ONLY with a valid JSON array in this exact format, no extra text, no markdown:
[
  {
    "name": "feature name",
    "impact": number,
    "effort": number,
    "alignment": number,
    "storyPoints": number,
    "risk": "Low or Medium or High",
    "nextStep": "specific actionable next step",
    "confidence": "High or Medium or Low",
    "rationale": "one sentence explaining the scoring, referencing specific context from the feature data"
  }
]

Features to score:
${features.map((f, i) => `
${i + 1}. Feature: ${f.name}
   JIRA ID: ${f.jiraId || 'N/A'}
   Epic: ${f.epic || 'N/A'}
   Description: ${f.description || 'N/A'}
   Acceptance Criteria: ${f.acceptanceCriteria || 'N/A'}
   Existing Story Points: ${f.storyPoints ? f.storyPoints + ' SP (use this value exactly)' : 'Not estimated — please estimate'}
   JIRA Priority: ${f.priority || 'N/A'}
   Labels: ${f.labels || 'N/A'}
   Notes: ${f.notes || 'N/A'}
`).join('\n')}`;
}

module.exports = { buildPrompt };