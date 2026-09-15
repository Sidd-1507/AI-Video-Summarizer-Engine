'use strict';

const { z } = require('zod');
const { extractVideoId } = require('../utils/youtubeUrl');

const examOptions = {
  classLevel: z.string().max(50).optional(),
  board: z.string().max(50).optional(),
  examType: z.string().max(50).optional(),
  tone: z.enum(['exam-cram', 'deep-understanding', 'eli5']).optional(),
  includeDiagrams: z.boolean().optional(),
  includeCharts: z.boolean().optional(),
  revisionMode: z.boolean().optional(),
};

const youtubeNotesRequestSchema = z.object({
  youtubeUrl: z
    .string()
    .url()
    .max(2048)
    .refine(
      (url) => {
        try {
          extractVideoId(url);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Must be a valid YouTube video URL (youtube.com/watch or youtu.be)' }
    ),
  ...examOptions,
});

const topicNotesRequestSchema = z.object({
  topic: z.string().min(1).max(200),
  ...examOptions,
});

const patchNoteSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().min(1).max(300).optional(),
  examMeta: z.object({
    classLevel: z.string().max(50).optional(),
    board: z.string().max(50).optional(),
    examType: z.string().max(50).optional(),
  }).optional(),
  topics: z.array(z.object({
    topicId: z.string().min(1),
    title: z.string().min(1).optional(),
    priority: z.number().int().min(1).max(3).optional(),
    content: z.string().optional(),
    diagrams: z.array(z.string()).optional(),
    charts: z.array(z.any()).optional(),
    revisionPoints: z.array(z.string()).optional(),
    questions: z.array(z.any()).optional(),
  })).optional(),
});

function sendZodError(res, result) {
  return res.status(400).json({
    error: 'Invalid request body',
    details: result.error.flatten().fieldErrors,
  });
}

function makeValidator(schema) {
  return function validate(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) return sendZodError(res, result);
    req.validatedBody = result.data;
    next();
  };
}

const validateYoutubeNotesRequest = makeValidator(youtubeNotesRequestSchema);
const validateTopicNotesRequest = makeValidator(topicNotesRequestSchema);
const validatePatchNoteRequest = makeValidator(patchNoteSchema);

module.exports = {
  validateYoutubeNotesRequest,
  validateTopicNotesRequest,
  validatePatchNoteRequest,
  youtubeNotesRequestSchema,
  topicNotesRequestSchema,
  patchNoteSchema,
};
