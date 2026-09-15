'use strict';

/**
 * MCQ Generation Service
 *
 * Uses the injected LLM client to generate structured Multiple Choice
 * Questions for a topic. Returns a validated array of MCQ objects.
 *
 * Prompt engineering:
 *   - Instructs the model to return ONLY valid JSON (no markdown fence)
 *   - Specifies exact schema: question, options (A-D), correctAnswer, explanation, difficulty
 *   - Sets temperature low (0.3) via the LLM client config
 *
 * Inject `llmClient` for testability:
 *   real:  createLlmClient() from utils/llmProvider.js
 *   tests: { complete: async () => JSON.stringify([...]) }
 */

class McqGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'McqGenerationError';
  }
}

/**
 * Builds the MCQ generation prompt.
 */
function buildMcqPrompt(topic, count = 5) {
  return `
You are an expert exam question writer. Generate exactly ${count} multiple-choice questions for the following topic.

TOPIC: ${topic.title}
CONTENT: ${topic.content.slice(0, 1500)}
REVISION POINTS: ${(topic.revisionPoints || []).join('; ')}

REQUIREMENTS:
- Mix difficulties: 2 easy, 2 medium, 1 hard
- Each question tests a distinct concept
- All 4 options must be plausible (no obviously wrong choices)
- Correct answer must be unambiguously correct
- Explanation must reference the topic content

Return ONLY a valid JSON array. No markdown, no explanation outside JSON.
Schema for each object:
{
  "question": "string (max 200 chars)",
  "options": [
    { "label": "A", "text": "string" },
    { "label": "B", "text": "string" },
    { "label": "C", "text": "string" },
    { "label": "D", "text": "string" }
  ],
  "correctAnswer": "A" | "B" | "C" | "D",
  "explanation": "string (max 300 chars)",
  "difficulty": "easy" | "medium" | "hard"
}

JSON array:`.trim();
}

/**
 * Validates and sanitises the LLM response.
 * @param {string} rawText - LLM output
 * @returns {Array} validated MCQ objects
 */
function parseMcqResponse(rawText) {
  // Strip markdown code fences if present
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Extract JSON array even if surrounded by extra text
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new McqGenerationError('LLM did not return a JSON array');

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (e) {
    throw new McqGenerationError(`MCQ JSON parse failed: ${e.message}`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new McqGenerationError('MCQ response is not a non-empty array');
  }

  const VALID_ANSWERS = new Set(['A', 'B', 'C', 'D']);
  const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
  const VALID_LABELS = ['A', 'B', 'C', 'D'];

  return parsed.map((q, idx) => {
    if (!q.question || typeof q.question !== 'string') {
      throw new McqGenerationError(`MCQ[${idx}] missing question field`);
    }
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new McqGenerationError(`MCQ[${idx}] must have exactly 4 options`);
    }
    if (!VALID_ANSWERS.has(q.correctAnswer)) {
      throw new McqGenerationError(`MCQ[${idx}] invalid correctAnswer: ${q.correctAnswer}`);
    }

    const options = VALID_LABELS.map((label, i) => ({
      label,
      text: String(q.options[i]?.text || q.options[i] || '').slice(0, 500),
    }));

    return {
      question:      q.question.slice(0, 1000),
      options,
      correctAnswer: q.correctAnswer,
      explanation:   String(q.explanation || '').slice(0, 1000),
      difficulty:    VALID_DIFFICULTIES.has(q.difficulty) ? q.difficulty : 'medium',
    };
  });
}

/**
 * Generates MCQs for a topic.
 *
 * @param {object} params
 * @param {object} params.llmClient  - { complete(prompt): Promise<string> }
 * @param {object} params.topic      - { topicId, title, content, revisionPoints }
 * @param {number} params.count      - Number of MCQs to generate (default 5)
 * @returns {Promise<Array>} Array of validated MCQ objects
 */
async function generateMcqs({ llmClient, topic, count = 5 }) {
  const prompt = buildMcqPrompt(topic, count);
  const rawText = await llmClient.complete(prompt);
  return parseMcqResponse(rawText);
}

module.exports = { generateMcqs, parseMcqResponse, buildMcqPrompt, McqGenerationError };
