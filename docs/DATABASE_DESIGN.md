# Database Design (MongoDB)

## Collections

### users
```js
{
  _id: ObjectId,
  firebaseUid: String,      // unique, indexed
  email: String,
  displayName: String,
  credits: Number,          // server-authoritative balance
  createdAt: Date,
  updatedAt: Date
}
```
Index: `{ firebaseUid: 1 }` unique.

### notes
```js
{
  _id: ObjectId,
  ownerId: ObjectId,        // ref users, indexed
  source: {
    type: String,           // "topic" | "youtube"
    youtubeUrl: String,     // present when type === "youtube"
    videoId: String,
    transcriptId: ObjectId  // ref transcripts, present when type === "youtube"
  },
  title: String,
  examMeta: { classLevel: String, board: String, examType: String },
  topics: [{
    topicId: String,        // stable client-side id (uuid)
    title: String,
    priority: Number,       // 1-3
    content: String,        // markdown
    diagrams: [String],     // mermaid definitions
    revisionPoints: [String],
    questions: [{ type: String, text: String, answer: String }]
  }],
  status: String,           // "pending" | "generating" | "ready" | "failed"
  version: Number,          // optimistic concurrency for edits
  createdAt: Date,
  updatedAt: Date
}
```
Indexes: `{ ownerId: 1, createdAt: -1 }` (history list), `{ "source.videoId": 1 }`.

### transcripts
```js
{
  _id: ObjectId,
  ownerId: ObjectId,
  videoId: String,          // indexed
  language: String,
  segments: [{ start: Number, text: String }],
  markdown: String,         // the flattened .md artifact
  fetchedAt: Date
}
```
Index: `{ videoId: 1, ownerId: 1 }` (cache — avoid re-fetching the same video for the same user; a global cache by `videoId` alone is a v2 optimization once caption licensing is confirmed).

### sticky_notes
```js
{
  _id: ObjectId,
  noteId: ObjectId,         // ref notes, indexed
  ownerId: ObjectId,        // indexed — enforce on every query
  anchor: { topicId: String, x: Number, y: Number },
  color: String,
  text: String,
  createdAt: Date,
  updatedAt: Date
}
```
Index: `{ noteId: 1, ownerId: 1 }`.

### credit_transactions
```js
{
  _id: ObjectId,
  ownerId: ObjectId,        // indexed
  type: String,             // "purchase" | "generation_charge" | "refund" | "signup_bonus"
  amount: Number,           // negative for charges
  balanceAfter: Number,
  refId: ObjectId,          // noteId or Stripe paymentIntentId
  createdAt: Date
}
```
Append-only ledger — balance on `users.credits` is a cached derived value, this table is the source of truth for audits/disputes.

### jobs (or use BullMQ's own Redis-backed storage; documented here for completeness)
```js
{
  _id: ObjectId,
  ownerId: ObjectId,
  noteId: ObjectId,
  status: String,          // queued | fetching_transcript | generating_notes | done | failed
  error: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Design rationale
- **Separate `transcripts` from `notes`**: the raw `.md` transcript is an intermediate artifact the user asked to have generated; keeping it as its own document lets us re-run notes-generation with a different prompt/model later without re-fetching captions, and lets us show the raw transcript in the UI if the user wants it.
- **Sticky notes decoupled from note content**: edits/regeneration of note content never destroy annotations (see ARCHITECTURE.md §5).
- **Ledger table for credits**: prevents the "client-side-adjacent" credit bug risk flagged in PRD.md §1 — every debit/credit is an immutable row, `users.credits` is just a fast-read cache recomputable from the ledger.
