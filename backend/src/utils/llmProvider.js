'use strict';

/**
 * LLM Provider Factory
 * Selects the LLM client based on LLM_PROVIDER env var.
 * Supports: 'gemini' (default) | 'openai'
 *
 * Both adapters implement the same interface:
 *   { complete(prompt: string): Promise<string> }
 *
 * Usage:
 *   const { createLlmClient } = require('./llmProvider');
 *   const llmClient = createLlmClient();
 *   const response = await llmClient.complete("Generate notes for...");
 */

function createGeminiAdapter(apiKey) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini');

  // Lazy require so tests without the SDK installed don't crash at import time
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.4,      // lower = more deterministic exam notes
      topP: 0.8,
      maxOutputTokens: 8192,
    },
  });

  async function complete(prompt) {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) throw new Error('Gemini returned an empty response');
    return text;
  }

  return { complete };
}

function createOpenAIAdapter(apiKey) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');

  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey });

  async function complete(prompt) {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 8192,
    });
    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error('OpenAI returned an empty response');
    return text;
  }

  return { complete };
}

/**
 * Creates and returns an LLM client based on LLM_PROVIDER env var.
 * Call once at startup and inject the returned client into services.
 */
function createLlmClient() {
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

  switch (provider) {
    case 'gemini':
      return createGeminiAdapter(process.env.GEMINI_API_KEY);
    case 'openai':
      return createOpenAIAdapter(process.env.OPENAI_API_KEY);
    default:
      throw new Error(
        `Unknown LLM_PROVIDER: "${provider}". Valid values: "gemini" | "openai"`
      );
  }
}

module.exports = { createLlmClient, createGeminiAdapter, createOpenAIAdapter };
