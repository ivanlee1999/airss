// Gemini API summarization logic
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function summarizeWithGemini(text) {
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
                  text: `Summarize the following article :\n\n${text}`,
                },
              ],
            },
          ],
        }),
      }
    );
    const data = await res.json();
    if (
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts
    ) {
      return data.candidates[0].content.parts.map((p) => p.text).join(" ");
    } else {
      return "[No summary returned from Gemini API]";
    }
  } catch (err) {
    return `[Gemini API error: ${err.message}]`;
  }
}

export { summarizeWithGemini };

