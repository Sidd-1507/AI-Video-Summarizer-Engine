const { extractVideoId } = require('../utils/youtubeUrl');
const { notesFromTranscript, isUnconfiguredLlmError, fetchYoutubeTitle } = require('./transcriptNotes');

const GENERATION_COST = 20; // credits charged for youtube or topic notes generation

async function setJobStatus(JobModel, jobId, status, extra = {}) {
  if (!JobModel || !jobId) return;
  await JobModel.findByIdAndUpdate(jobId, { status, ...extra });
}

/**
 * Core YouTube work. Credits must already be reserved by the caller
 * (generateYoutubeNotes or the async job starter).
 */
async function executeYoutubeNotesJob(deps, { userId, youtubeUrl, options = {}, noteId = null, jobId = null }) {
  const {
    transcriptService,
    llmNotesService,
    TranscriptModel,
    NoteModel,
    JobModel,
  } = deps;

  await setJobStatus(JobModel, jobId, 'fetching_transcript');

  const { videoId, segments, markdown } = await transcriptService.fetchTranscript(youtubeUrl);

  const transcriptDoc = await TranscriptModel.create({
    ownerId: userId,
    videoId,
    segments,
    markdown,
  });

  await setJobStatus(JobModel, jobId, 'generating_notes');
  const videoTitle = await fetchYoutubeTitle(youtubeUrl);
  let generated;
  try {
    generated = await llmNotesService.generateNotes(markdown, options);
  } catch (err) {
    if (!isUnconfiguredLlmError(err)) throw err;
    generated = notesFromTranscript(markdown, options, { videoTitle });
  }
  if (videoTitle) generated.title = videoTitle;

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
      type: 'youtube',
      youtubeUrl,
      videoId,
      transcriptId: transcriptDoc._id,
    },
  };

  let note;
  if (noteId) {
    note = await NoteModel.findByIdAndUpdate(noteId, { $set: payload }, { new: true });
  } else {
    note = await NoteModel.create({
      ownerId: userId,
      ...payload,
    });
  }

  await setJobStatus(JobModel, jobId, 'done');
  return note;
}

/**
 * Pure orchestration function — no Express, no globals. All I/O is
 * injected so this can be exercised by unit tests without a DB, a
 * queue, or network access, and can equally be called from an HTTP
 * controller or from a BullMQ worker.
 */
async function generateYoutubeNotes(deps, { userId, youtubeUrl, options = {}, noteId = null, jobId = null }) {
  const { UserModel, NoteModel, JobModel, reserveCredits, refundCredits } = deps;

  await reserveCredits(UserModel, userId, GENERATION_COST);

  try {
    return await executeYoutubeNotesJob(deps, { userId, youtubeUrl, options, noteId, jobId });
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

function extractOptions(body = {}) {
  return {
    classLevel: body.classLevel,
    board: body.board,
    examType: body.examType,
    includeDiagrams: body.includeDiagrams,
    includeCharts: body.includeCharts,
    tone: body.tone,
    revisionMode: body.revisionMode,
  };
}

module.exports = {
  generateYoutubeNotes,
  executeYoutubeNotesJob,
  extractVideoId,
  extractOptions,
  GENERATION_COST,
};
