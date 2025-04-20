# Airss RSS Feed Aggregator

## Overview
This project is an RSS feed aggregator that fetches articles from user-subscribed feeds, stores them in MongoDB, and uses Gemini API to summarize articles. It supports separate background jobs for fetching and summarizing, each with its own schedule and robust rate limiting.

## Features
- Subscribe to RSS feeds via API
- Fetch and store articles in MongoDB (no duplicates)
- Summarize articles using Gemini API (with 15 requests per minute rate limit)
- Background jobs for fetching and summarizing, with independent scheduling
- Express.js API for managing feeds and articles

## Setup

### 1. Prerequisites
- Node.js (18+ recommended)
- MongoDB (local or Docker)
- Gemini API Key

### 2. Clone & Install
```sh
git clone <repo-url>
cd airss
npm install
```

### 3. Environment Variables
Create a `.env` file in the project root:
```
DB_URI=mongodb://localhost:27017/airss
GEMINI_API_KEY=your-gemini-api-key
API_BASE_URL=http://localhost:3001
UI_BASE_URL=http://localhost:3000
# Optional: customize job intervals (in ms)
FEED_FETCH_FREQ_MS=1800000     # 30 min default fetch interval
SUMMARIZE_FREQ_MS=60000        # 1 min default summarize interval
```

### 4. Running MongoDB
You can run MongoDB locally or via Docker:
```sh
docker run -d --name airss-mongo -p 27017:27017 -e MONGO_INITDB_DATABASE=airss -v mongodata:/data/db mongo:7
```

### 5. Start the API Server
```sh
node api/server.js
```

### 6. Start the Background Worker
```sh
node api/rss_worker.js
```
This will start both the fetch and summarizer jobs. You can configure their intervals via environment variables.

## Rate Limiting
- The Gemini API summarizer is rate-limited to **15 requests per minute** (1 request every 4 seconds) using an in-memory queue.
- Only one summarizer job runs at a time (overlapping jobs are skipped) to ensure the rate limit is never exceeded.

## Code Structure
- `api/server.js`: Express API server
- `api/rss_worker.js`: Background job runner for fetching and summarizing
- `api/feeds.js`: Logic for fetching feeds and summarizing articles
- `api/articles.js`: MongoDB article logic
- `api/subscriptions.js`: MongoDB subscription logic
- `api/summarize.js`: Gemini API and rate limiter
- `.env`: Environment configuration

## Customization
- Adjust fetch/summarize intervals via `.env` or directly in `rss_worker.js`.
- Add more endpoints or integrate authentication as needed.

## Troubleshooting
- If you see `[Gemini API key missing...]`, check your `.env`.
- If you see `[Summarizer] Previous job still running, skipping this run.`, your summarizer is busy and will not overlap.
- MongoDB connection problems? Check your `DB_URI` and Docker status.

## License
MIT
