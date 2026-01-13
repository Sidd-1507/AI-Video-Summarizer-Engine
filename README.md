# AI-Video-Summarizer-Engine 🎥 🤖

## Overview
An intelligent pipeline designed to condense long-form video content (lectures, seminars, meetings) into concise, readable summaries. This project utilizes Computer Vision for frame analysis and Natural Language Processing (NLP) for transcript summarization.

## Architecture
The system follows a three-stage pipeline:
1.  **Extraction:** Retrieves video transcripts using YouTube API / Whisper (OpenAI).
2.  **Processing:** - Text: Cleaning and tokenization using NLTK.
    - Vision: Key-frame extraction using OpenCV (to capture slides/diagrams).
3.  **Summarization:** Uses Transformer-based models (BART/T5) to generate abstractive summaries.

## Tech Stack
-   **Core:** Python 3.9+
-   **NLP:** HuggingFace Transformers, PyTorch
-   **Vision:** OpenCV, YOLOv8 (planned for object detection in frames)
-   **API:** FastAPI (Backend), Streamlit (Frontend interface)

## Current Status
-   [x] Architecture Design & Flowchart
-   [x] Transcript Extraction Module (Prototype)
-   [ ] Integration of Llama-3 for advanced context understanding
-   [ ] Real-time processing pipeline

## Setup
```bash
pip install -r requirements.txt
python main.py
