// Background job for fetching and parsing feeds
import Parser from 'rss-parser';
import { extract as extractArticle } from '@extractus/article-extractor';
import { getAllSubscriptions } from './subscriptions.js';
import { upsertArticle } from './articles.js';
import { connectDB } from './db.js';
import { summarizeWithGemini } from './summarize.js';

const parser = new Parser();

// Fetch and store articles (no summarization)
async function fetchAllFeeds() {
  const subscriptions = await getAllSubscriptions();
  if (!subscriptions || subscriptions.length === 0) return;
  const db = await connectDB();
  console.log("Fetching subscribed RSS feeds...");
  for (const sub of subscriptions) {
    try {
      const feed = await parser.parseURL(sub.url);
      console.log(`Fetched feed: ${feed.title} (${sub.url})`);
      for (const [idx, item] of feed.items.entries()) {
        console.log(`  [${idx + 1}] ${item.title} - ${item.link}`);
        if (item.link) {
          try {
            const articleData = await extractArticle(item.link);
            if (articleData && articleData.content) {
              console.log(
                `      [Full Article Extracted]:\n${articleData.content.substring(0, 1000)}...`
              );
              // Only create if not exists
const existing = await db.collection('articles').findOne({ link: item.link });
if (!existing) {
  await db.collection('articles').insertOne({
    id: item.link,
    feedUrl: sub.url,
    title: item.title,
    link: item.link,
    pubDate: item.pubDate || new Date().toISOString(),
    content: articleData.content,
    summary: null,
    sentToGemini: false,
    processedAt: new Date().toISOString(),
    feedName: sub.name
  });
} else {
  console.log(`      [Article already exists, skipping insert]: ${item.link}`);
}
            } else {
              console.log("      [No full article content extracted]");
            }
          } catch (err) {
            console.log(
              `      [Failed to extract article]: ${err.message}`
            );
          }
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${sub.url}:`, err.message);
    }
  }
}

// Summarize articles that have no summary
import { getAllArticles } from './articles.js';
let summarizerRunning = false;
async function summarizeAllArticles() {
  if (summarizerRunning) {
    console.log("[Summarizer] Previous job still running, skipping this run.");
    return;
  }
  summarizerRunning = true;
  try {
    const articles = await getAllArticles();
    const unsummarized = articles.filter(a => !a.summary && a.content);
    console.log(`[Summarizer] ${unsummarized.length} articles to summarize`);
    for (const article of unsummarized) {
      try {
        const summary = await summarizeWithGemini(article.content);
        if (summary) {
          console.log(`[Summarizer] Gemini Summary for ${article.link}: ${summary}`);
        }
        await upsertArticle({
          ...article,
          summary: summary,
          sentToGemini: !!summary,
          processedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error(`[Summarizer] Error summarizing ${article.link}:`, err.message);
      }
    }
  } finally {
    summarizerRunning = false;
  }
}

function startFeedJob(freqMs = 5 * 60 * 1000) {
  setInterval(fetchAllFeeds, freqMs);
}

function startSummarizeJob(freqMs = 1 * 5 * 1000) {
  setInterval(summarizeAllArticles, freqMs);
}

export { startFeedJob, fetchAllFeeds, startSummarizeJob, summarizeAllArticles };

