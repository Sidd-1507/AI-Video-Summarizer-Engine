// ── API response types matching backend Mongoose models ──────────────────────

export type NoteStatus    = 'pending' | 'generating' | 'ready' | 'failed';
export type AudioStatus   = 'none' | 'pending' | 'ready' | 'failed';
export type ImageStatus   = 'none' | 'pending' | 'ready' | 'failed';
export type StickyColor   = 'yellow' | 'blue' | 'purple' | 'green' | 'red' | 'orange' | 'pink';
export type HighlightColor = 'yellow' | 'blue' | 'green' | 'pink';
export type Tone = 'exam-cram' | 'deep-understanding' | 'eli5';

export interface ExamQuestion {
  type: string;
  text: string;
  answer: string;
}

export interface ChartPoint {
  name: string;
  value: number;
}

export interface TopicChart {
  type: 'line' | 'pie' | 'bar';
  title: string;
  data: ChartPoint[];
}

export interface Topic {
  topicId:        string;
  title:          string;
  priority:       number;
  content:        string;
  diagrams:       string[];
  charts?:        TopicChart[];
  revisionPoints: string[];
  questions:      Array<string | ExamQuestion>;
  imageUrl?:      string;
  imageStatus?:   ImageStatus;
}

export interface Note {
  _id:        string;
  ownerId:    string;
  title:      string;
  status:     NoteStatus;
  version?:   number;
  examMeta?: {
    classLevel?: string;
    board?:      string;
    examType?:   string;
  };
  source: {
    type:        string;
    youtubeUrl?: string;
    videoId?:    string;
    transcriptId?: string;
  };
  topics:       Topic[];
  audioStatus:  AudioStatus;
  audioOverview?: {
    deepDive?: string;
    brief?:    string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  _id:     string;
  noteId:  string;
  type:    string;
  status:  'queued' | 'fetching_transcript' | 'generating_notes' | 'done' | 'failed';
  error?:  string | null;
}

export interface GenerateYoutubePayload {
  youtubeUrl: string;
  tone?: Tone;
  classLevel?: string;
  board?: string;
  examType?: string;
  revisionMode?: boolean;
  includeDiagrams?: boolean;
  includeCharts?: boolean;
}

export interface GenerateTopicPayload {
  topic: string;
  tone?: Tone;
  classLevel?: string;
  board?: string;
  examType?: string;
  revisionMode?: boolean;
  includeDiagrams?: boolean;
  includeCharts?: boolean;
}

export interface StickyNote {
  _id:              string;
  noteId:           string;
  topicId:          string;
  content:          string;
  color:            StickyColor;
  youtubeTimestamp: number | null;
  x?:    number;
  y?:    number;
  w?:    number;
  h?:    number;
  _optimistic?: boolean; // client-only marker for pending state
}

export interface Highlight {
  _id:         string;
  noteId:      string;
  topicId:     string;
  text:        string;
  startOffset: number;
  endOffset:   number;
  color:       HighlightColor;
  _optimistic?: boolean;
}

export interface Flashcard {
  _id:            string;
  noteId:         string;
  topicId:        string;
  front:          string;
  back:           string;
  ef:             number;
  interval:       number;
  repetitions:    number;
  nextReviewDate: string;
  _optimistic?:   boolean;
}

export interface McqOption {
  label: 'A' | 'B' | 'C' | 'D';
  text:  string;
}

export interface McqQuestion {
  question:      string;
  options:       McqOption[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation:   string;
  difficulty:    'easy' | 'medium' | 'hard';
}

export interface McqAttempt {
  score: number;
  total?: number;
  totalQuestions?: number;
  percentage?: number;
  createdAt?: string;
  attemptedAt?: string;
  wrongQuestionIndices?: number[];
}

export interface McqSet {
  _id:       string;
  noteId:    string;
  topicId:   string;
  questions: McqQuestion[];
  attempts:  McqAttempt[];
}

export interface CreditTransaction {
  _id:         string;
  userId:      string;
  amount:      number;
  type:        'grant' | 'deduction';
  description: string;
  createdAt:   string;
}

export interface User {
  _id:       string;
  firebaseUid: string;
  email:     string;
  credits:   number;
}

// ── Submission results ────────────────────────────────────────────────────────
export interface QuizSubmitResult {
  score:      number;
  total:      number;
  percentage: number;
  breakdown:  Array<{
    questionIndex: number;
    selected:      string;
    correct:       boolean;
    correctAnswer: string;
    explanation:   string;
  }>;
}
