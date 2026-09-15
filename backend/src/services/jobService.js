'use strict';

const logger = require('../utils/logger');
const { generateYoutubeNotes, executeYoutubeNotesJob, GENERATION_COST, extractVideoId } = require('./youtubeNotesOrchestrator');
const { generateTopicNotes, executeTopicNotesJob } = require('./topicNotesOrchestrator');

function shouldRunSync(deps) {
  if (typeof deps.runJobsSync === 'boolean') return deps.runJobsSync;
  return process.env.NODE_ENV === 'test';
}

function useRedisQueue() {
  if (process.env.USE_BULLMQ_WORKER === 'true') return Boolean(process.env.REDIS_URL);
  if (process.env.NODE_ENV === 'production') return Boolean(process.env.REDIS_URL);
  return false;
}

async function failReservedJob(deps, { userId, noteId, jobId, err }) {
  const { UserModel, NoteModel, JobModel, refundCredits } = deps;
  await refundCredits(UserModel, userId, GENERATION_COST, noteId || undefined).catch(() => {});
  if (noteId) {
    await NoteModel.findByIdAndUpdate(noteId, {
      $set: { status: 'failed', title: 'Generation failed' },
    }).catch(() => {});
  }
  if (jobId) {
    await JobModel.findByIdAndUpdate(jobId, {
      status: 'failed',
      error: String(err?.message || 'Notes could not be generated').slice(0, 400),
    }).catch(() => {});
  }
  return err;
}

async function processJob(deps, jobId) {
  const { JobModel } = deps;
  const job = await JobModel.findById(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.status === 'done' || job.status === 'failed') return job;

  const userId = job.ownerId;
  const noteId = job.noteId;
  const payload = job.payload || {};

  try {
    if (job.type === 'youtube-notes') {
      await executeYoutubeNotesJob(deps, {
        userId,
        youtubeUrl: payload.youtubeUrl,
        options: payload.options || {},
        noteId,
        jobId: job._id,
      });
    } else if (job.type === 'topic-notes') {
      await executeTopicNotesJob(deps, {
        userId,
        topic: payload.topic,
        options: payload.options || {},
        noteId,
        jobId: job._id,
      });
    } else {
      await JobModel.findByIdAndUpdate(job._id, {
        status: 'failed',
        error: `Unsupported job type ${job.type}`,
      });
    }
  } catch (err) {
    await failReservedJob(deps, { userId, noteId, jobId: job._id, err });
    throw err;
  }

  return JobModel.findById(jobId);
}

async function enqueueToRedis(job) {
  const { getQueue } = require('../config/redis');
  const queue = getQueue(job.type);
  await queue.add(job.type, { jobId: String(job._id) }, { jobId: String(job._id) });
}

async function dispatchJob(deps, job) {
  if (shouldRunSync(deps)) {
    await processJob(deps, job._id);
    return;
  }

  if (useRedisQueue()) {
    try {
      await enqueueToRedis(job);
      return;
    } catch (err) {
      logger.warn('BullMQ enqueue failed, falling back to in-process', { error: err.message });
    }
  }

  await processJob(deps, job._id);
}

async function startYoutubeNotes(deps, { userId, youtubeUrl, options = {} }) {
  const { NoteModel, JobModel } = deps;

  if (shouldRunSync(deps)) {
    const note = await generateYoutubeNotes(deps, { userId, youtubeUrl, options });
    const job = await JobModel.create({
      ownerId: userId,
      noteId: note._id,
      type: 'youtube-notes',
      status: 'done',
      payload: { youtubeUrl, options },
    });
    return { note, job, httpStatus: 201 };
  }

  const { UserModel, reserveCredits } = deps;
  await reserveCredits(UserModel, userId, GENERATION_COST);

  let videoId;
  try {
    videoId = extractVideoId(youtubeUrl);
  } catch {
    videoId = undefined;
  }

  const note = await NoteModel.create({
    ownerId: userId,
    source: { type: 'youtube', youtubeUrl, videoId },
    title: 'Generating notes…',
    examMeta: {
      classLevel: options.classLevel,
      board: options.board,
      examType: options.examType,
    },
    topics: [],
    status: 'generating',
  });

  const job = await JobModel.create({
    ownerId: userId,
    noteId: note._id,
    type: 'youtube-notes',
    status: 'queued',
    payload: { youtubeUrl, options },
  });

  try {
    await dispatchJob(deps, job);
  } catch (err) {
    const current = await JobModel.findById(job._id).lean();
    if (current?.status !== 'failed') {
      await failReservedJob(deps, { userId, noteId: note._id, jobId: job._id, err });
    }
    throw err;
  }

  const readyNote = await NoteModel.findById(note._id);
  const readyJob = await JobModel.findById(job._id);
  return {
    note: readyNote,
    job: readyJob,
    httpStatus: readyNote?.status === 'ready' ? 201 : 202,
  };
}

async function startTopicNotes(deps, { userId, topic, options = {} }) {
  const { NoteModel, JobModel } = deps;

  if (shouldRunSync(deps)) {
    const note = await generateTopicNotes(deps, { userId, topic, options });
    const job = await JobModel.create({
      ownerId: userId,
      noteId: note._id,
      type: 'topic-notes',
      status: 'done',
      payload: { topic, options },
    });
    return { note, job, httpStatus: 201 };
  }

  const { UserModel, reserveCredits } = deps;
  await reserveCredits(UserModel, userId, GENERATION_COST);

  const note = await NoteModel.create({
    ownerId: userId,
    source: { type: 'topic' },
    title: 'Generating notes…',
    examMeta: {
      classLevel: options.classLevel,
      board: options.board,
      examType: options.examType,
    },
    topics: [],
    status: 'generating',
  });

  const job = await JobModel.create({
    ownerId: userId,
    noteId: note._id,
    type: 'topic-notes',
    status: 'queued',
    payload: { topic, options },
  });

  try {
    await dispatchJob(deps, job);
  } catch (err) {
    const current = await JobModel.findById(job._id).lean();
    if (current?.status !== 'failed') {
      await failReservedJob(deps, { userId, noteId: note._id, jobId: job._id, err });
    }
    throw err;
  }

  const readyNote = await NoteModel.findById(note._id);
  const readyJob = await JobModel.findById(job._id);
  return {
    note: readyNote,
    job: readyJob,
    httpStatus: readyNote?.status === 'ready' ? 201 : 202,
  };
}

module.exports = {
  startYoutubeNotes,
  startTopicNotes,
  processJob,
  dispatchJob,
  shouldRunSync,
  GENERATION_COST,
};
