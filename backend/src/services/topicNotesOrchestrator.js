'use strict';

const GENERATION_COST = require('./youtubeNotesOrchestrator').GENERATION_COST;

async function setJobStatus(JobModel, jobId, status, extra = {}) {
  if (!JobModel || !jobId) return;
  await JobModel.findByIdAndUpdate(jobId, { status, ...extra });
}

function buildTopicMaterial({ topic, options = {} }) {
  const { classLevel, board, examType, revisionMode } = options;
  return [
    `Write complete exam-oriented notes on: ${topic}`,
    classLevel ? `Class / level: ${classLevel}` : null,
    board ? `Exam board: ${board}` : null,
    examType ? `Exam / paper type: ${examType}` : null,
    revisionMode ? 'Prioritise revision-ready bullets and likely exam questions.' : null,
    'Cover definitions, mechanisms, diagrams-worthy processes, and common mistakes.',
  ].filter(Boolean).join('\n');
}

async function executeTopicNotesJob(deps, { userId, topic, options = {}, noteId = null, jobId = null }) {
  const { llmNotesService, NoteModel, JobModel } = deps;

  await setJobStatus(JobModel, jobId, 'generating_notes');

  const material = buildTopicMaterial({ topic, options });
  const generated = await llmNotesService.generateNotes(material, options);

  const payload = {
    title: generated.title,
    examMeta: {
      classLevel: options.classLevel,
      board: options.board,
      examType: options.examType,
    },
    topics: generated.topics,
    status: 'ready',
    source: {
      type: 'topic',
      youtubeUrl: undefined,
      videoId: undefined,
    },
  };

  let note;
  if (noteId) {
    note = await NoteModel.findByIdAndUpdate(noteId, { $set: payload }, { new: true });
  } else {
    note = await NoteModel.create({
      ownerId: userId,
      source: { type: 'topic' },
      ...payload,
    });
  }

  await setJobStatus(JobModel, jobId, 'done');
  return note;
}

async function generateTopicNotes(deps, { userId, topic, options = {}, noteId = null, jobId = null }) {
  const { UserModel, NoteModel, JobModel, reserveCredits, refundCredits } = deps;

  await reserveCredits(UserModel, userId, GENERATION_COST);

  try {
    return await executeTopicNotesJob(deps, { userId, topic, options, noteId, jobId });
  } catch (err) {
    await refundCredits(UserModel, userId, GENERATION_COST, noteId || undefined);
    if (noteId) {
      await NoteModel.findByIdAndUpdate(noteId, {
        $set: { status: 'failed', title: 'Generation failed' },
      }).catch(() => {});
    }
    await setJobStatus(JobModel, jobId, 'failed', { error: 'Notes could not be generated' });
    throw err;
  }
}

module.exports = {
  generateTopicNotes,
  executeTopicNotesJob,
  buildTopicMaterial,
};
