const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');

const CHUNK_CHAR_SIZE = 12_000; // conservative char budget per LLM call
const CHUNK_OVERLAP = 500;

const questionSchema = z.object({
  type: z.enum(['short', 'long']),
  text: z.string().min(1),
  answer: z.string().min(1),
});

const chartSchema = z.object({
  type: z.enum(['line', 'pie', 'bar']),
  title: z.string().min(1),
  data: z.array(z.object({
    name: z.string().min(1),
    value: z.number(),
  })).default([]),
});

const topicSchema = z.object({
  title: z.string().min(1),
  priority: z.number().int().min(1).max(3),
  content: z.string().min(1),
  diagrams: z.array(z.string()).default([]),
  charts: z.array(chartSchema).default([]),
  revisionPoints: z.array(z.string()).default([]),
  questions: z.array(questionSchema).default([]),
});

const llmResponseSchema = z.object({
  title: z.string().min(1),
  topics: z.array(topicSchema).min(1),
});

class LLMResponseValidationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'LLMResponseValidationError';
    this.statusCode = 502;
    this.cause = cause;
  }
}

/**
 * llmClient is injected. Contract: llmClient.complete(prompt) => Promise<string>
 * (string is expected to be JSON; provider adapters for Gemini/OpenAI live
 * behind this same interface so this service never touches vendor SDKs directly.)
 */
function createLlmNotesService({ llmClient }) {
  if (!llmClient || typeof llmClient.complete !== 'function') {
    throw new Error('llmClient with a complete(prompt) method is required');
  }

  function chunkText(text) {
    if (text.length <= CHUNK_CHAR_SIZE) return [text];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + CHUNK_CHAR_SIZE, text.length);
      chunks.push(text.slice(start, end));
      if (end === text.length) break;
      start = end - CHUNK_OVERLAP;
    }
    return chunks;
  }

  function buildPrompt(chunk, options) {
    const {
      classLevel, board, examType, includeDiagrams, includeCharts,
      tone, revisionMode,
    } = options;
    const toneGuide = {
      'exam-cram': 'Dense, high-yield exam cram notes. Short sentences. Bold the facts that show up in papers.',
      'deep-understanding': 'Explain mechanisms and why, not only what. Still structured for exams.',
      'eli5': 'Explain like the student is 15 and new to the topic. Keep accuracy. No baby-talk filler.',
    }[tone] || 'Clear exam-oriented notes.';
    return [
      'You are an exam-notes generator. Read the study material below and respond with ONLY valid JSON',
      'matching exactly this shape (no markdown fences, no commentary):',
      '{ "title": string, "topics": [ { "title": string, "priority": 1|2|3,',
      '"content": string, "diagrams": string[] /* mermaid defs; empty array if not requested */,',
      '"charts": [ { "type": "line"|"pie"|"bar", "title": string, "data": [ { "name": string, "value": number } ] } ],',
      '"revisionPoints": string[], "questions": [ { "type": "short"|"long", "text": string, "answer": string } ] } ] }',
      `Target audience: class/level "${classLevel || 'general'}", exam board "${board || 'general'}", exam type "${examType || 'general'}".`,
      `Tone: ${tone || 'exam-cram'}. ${toneGuide}`,
      `Revision mode: ${Boolean(revisionMode)}. If true, lead with revisionPoints and keep content concise.`,
      `Include mermaid diagrams: ${Boolean(includeDiagrams)}. If false, diagrams must be [].`,
      `Include charts (line/pie/bar with numeric data): ${Boolean(includeCharts)}. If false, charts must be [].`,
      'Priority 3 = must-revise, high-yield. Priority 1 = supplementary.',
      'Include both short and long exam-style questions with answers.',
      '--- MATERIAL START ---',
      chunk,
      '--- MATERIAL END ---',
    ].join('\n');
  }

  function parseAndValidate(rawResponse) {
    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch (err) {
      throw new LLMResponseValidationError('LLM did not return valid JSON', err);
    }
    const result = llmResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new LLMResponseValidationError('LLM JSON did not match the expected schema', result.error);
    }
    return result.data;
  }

  async function generateFromChunk(chunk, options) {
    const prompt = buildPrompt(chunk, options);
    const raw = await llmClient.complete(prompt);
    return parseAndValidate(raw);
  }

  function mergeResults(results) {
    const title = results[0]?.title || 'Untitled Notes';
    const seenTitles = new Set();
    const topics = [];
    for (const result of results) {
      for (const topic of result.topics) {
        const key = topic.title.trim().toLowerCase();
        if (seenTitles.has(key)) continue; // de-dupe overlapping-chunk topics
        seenTitles.add(key);
        topics.push({ ...topic, topicId: uuidv4() });
      }
    }
    return { title, topics };
  }

  async function generateNotes(transcriptMarkdown, options = {}) {
    if (typeof transcriptMarkdown !== 'string' || transcriptMarkdown.trim().length === 0) {
      throw new Error('transcriptMarkdown must be a non-empty string');
    }
    const chunks = chunkText(transcriptMarkdown);

    const results = [];
    for (const chunk of chunks) {
      // Sequential (not Promise.all) on purpose: keeps LLM rate/cost predictable
      // and lets us retry a single failing chunk without redoing the rest.
      let attempt = 0;
      let lastError;
      while (attempt < 2) {
        try {
          results.push(await generateFromChunk(chunk, options));
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          attempt += 1;
        }
      }
      if (lastError) throw lastError;
    }

    return mergeResults(results);
  }

  return { generateNotes, chunkText, buildPrompt, parseAndValidate };
}

module.exports = { createLlmNotesService, LLMResponseValidationError };
