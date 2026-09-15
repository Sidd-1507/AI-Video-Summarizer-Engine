const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Note = require('../models/Note');
const Transcript = require('../models/Transcript');
const { reserveCredits, refundCredits, InsufficientCreditsError, CreditTransaction } = require('../services/creditService');
const { generateYoutubeNotes, GENERATION_COST } = require('../services/youtubeNotesOrchestrator');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 30_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Note.deleteMany({});
  await Transcript.deleteMany({});
  await CreditTransaction.deleteMany({});
});

function baseDeps(overrides = {}) {
  return {
    transcriptService: {
      fetchTranscript: async () => ({
        videoId: 'dQw4w9WgXcQ',
        segments: [{ start: 0, text: 'hello world' }],
        markdown: '# Transcript\n\nhello world',
      }),
    },
    llmNotesService: {
      generateNotes: async () => ({
        title: 'Generated Title',
        topics: [
          {
            topicId: 'topic-1',
            title: 'Topic A',
            priority: 2,
            content: 'content',
            diagrams: [],
            revisionPoints: [],
            questions: [],
          },
        ],
      }),
    },
    TranscriptModel: Transcript,
    NoteModel: Note,
    UserModel: User,
    reserveCredits,
    refundCredits,
    ...overrides,
  };
}

describe('generateYoutubeNotes orchestrator', () => {
  test('happy path: charges credits once and creates a ready note', async () => {
    const user = await User.create({ firebaseUid: 'orc1', email: 'x@x.com', credits: 100 });

    const note = await generateYoutubeNotes(baseDeps(), {
      userId: user._id,
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });

    expect(note.status).toBe('ready');
    expect(note.ownerId.toString()).toBe(user._id.toString());

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.credits).toBe(100 - GENERATION_COST);

    const transcriptCount = await Transcript.countDocuments({ ownerId: user._id });
    expect(transcriptCount).toBe(1);
  });

  test('rejects up front when the user has insufficient credits, and creates nothing', async () => {
    const user = await User.create({ firebaseUid: 'orc2', email: 'y@y.com', credits: 5 });

    await expect(
      generateYoutubeNotes(baseDeps(), { userId: user._id, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' })
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    expect(await Note.countDocuments({})).toBe(0);
    expect(await Transcript.countDocuments({})).toBe(0);
  });

  test('refunds credits if transcript fetch fails (no note, no transcript persisted)', async () => {
    const user = await User.create({ firebaseUid: 'orc3', email: 'z@z.com', credits: 100 });

    const deps = baseDeps({
      transcriptService: {
        fetchTranscript: async () => {
          throw new Error('caption service down');
        },
      },
    });

    await expect(
      generateYoutubeNotes(deps, { userId: user._id, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' })
    ).rejects.toThrow('caption service down');

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.credits).toBe(100); // fully refunded
    expect(await Note.countDocuments({})).toBe(0);
  });

  test('refunds credits if LLM generation fails after transcript was already persisted', async () => {
    const user = await User.create({ firebaseUid: 'orc4', email: 'w@w.com', credits: 100 });

    const deps = baseDeps({
      llmNotesService: {
        generateNotes: async () => {
          throw new Error('LLM provider timeout');
        },
      },
    });

    await expect(
      generateYoutubeNotes(deps, { userId: user._id, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' })
    ).rejects.toThrow('LLM provider timeout');

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.credits).toBe(100); // refunded even though transcript step succeeded
    // The transcript artifact itself remains (it's a legitimate intermediate
    // artifact and refetching captions is wasteful), but no Note was created.
    expect(await Transcript.countDocuments({ ownerId: user._id })).toBe(1);
    expect(await Note.countDocuments({})).toBe(0);
  });

  test('two users generating notes concurrently never see cross-contaminated credits or notes', async () => {
    const userA = await User.create({ firebaseUid: 'orcA', email: 'a@a.com', credits: 100 });
    const userB = await User.create({ firebaseUid: 'orcB', email: 'b@b.com', credits: 100 });

    const [noteA, noteB] = await Promise.all([
      generateYoutubeNotes(baseDeps(), { userId: userA._id, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }),
      generateYoutubeNotes(baseDeps(), { userId: userB._id, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }),
    ]);

    expect(noteA.ownerId.toString()).toBe(userA._id.toString());
    expect(noteB.ownerId.toString()).toBe(userB._id.toString());

    const finalA = await User.findById(userA._id);
    const finalB = await User.findById(userB._id);
    expect(finalA.credits).toBe(100 - GENERATION_COST);
    expect(finalB.credits).toBe(100 - GENERATION_COST);
  });
});
