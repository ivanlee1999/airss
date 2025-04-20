// Gemini API summarization logic
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// --- Gemini API Rate Limiter ---
const RATE_LIMIT = 15; // requests per minute
const INTERVAL_MS = 60_000 / RATE_LIMIT; // 4 seconds per request
let queue = [];
let processing = false;

function processQueue() {
  if (queue.length === 0) return;
  if (processing) return;
  processing = true;
  const { text, resolve, reject } = queue.shift();
  _summarizeWithGemini(text)
    .then(resolve)
    .catch(reject)
    .finally(() => {
      processing = false;
      setTimeout(processQueue, INTERVAL_MS);
    });
}

async function summarizeWithGemini(text) {
  return new Promise((resolve, reject) => {
    queue.push({ text, resolve, reject });
    processQueue();
  });
}

// --- Actual Gemini API logic below ---
async function _summarizeWithGemini(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("      [Gemini API key missing. Set GEMINI_API_KEY in .env]");
    return null;
  }
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Summarize the following article in a clear, readable way. Use bullet points for lists or key information when appropriate. Focus on clarity and conciseness.\n\n${text}`,
                },
              ],
            },
          ],
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error("[Gemini API Error]", data);
      return null;
    }
    console.log("[Gemini API Raw Response]", data);
    if (
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts
    ) {
      return data.candidates[0].content.parts.map((p) => p.text).join(" ");
    } else {
      console.log("[Gemini API] No summary returned");
      return null;
    }
  } catch (err) {
    console.error("[Gemini API Error]", err);
    return null;
  }
}

export { summarizeWithGemini };

