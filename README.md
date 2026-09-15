# AI Video Summarizer Engine

Web app that turns a YouTube lecture (or a syllabus topic) into structured study notes: sections, revision points, and exam-style questions. The same note can be opened as an article, a mind map, flashcards, or a quiz.

It is a Vite/React frontend and an Express API with MongoDB. You create an account with email and password. New accounts start with 100 credits. Generating notes from a video costs credits.

## How a YouTube link is processed

1. The URL is checked and the 11-character video id is taken from it (ids that start with `-` are valid).
2. Captions are fetched for that video.
3. If a Gemini (or OpenAI) key is set, the transcript is sent to the model and parsed into the note schema.
4. If no key is set, the captions are still split into titled sections so the page is usable.
5. The note is stored on the user account.

Without captions the request fails and credits are refunded.

## Run locally

You need Node.js, MongoDB on `localhost:27017`, and (optional) Redis.

```bash
# API
cd backend
cp .env.example .env
# set MONGODB_URI, JWT_SECRET, and GEMINI_API_KEY if you have one
npm install
npm run start:api
```

```bash
# UI
cd frontend
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev
```

Open http://localhost:5173, create an account, paste a YouTube URL, generate.

Firebase Google login is optional. Leave those env vars empty if you are only using email/password.

## Layout

```
backend/   Express API (auth, notes, credits, jobs)
frontend/  Vite + React UI
docs/      longer design notes
```

Copy `backend/.env.example` and `frontend/.env.example`. Do not commit real `.env` files.
