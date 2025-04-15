// Background job for fetching and parsing feeds
import Parser from 'rss-parser';
import { extract as extractArticle } from '@extractus/article-extractor';
import { subscriptions } from './subscriptions.js';
import { upsertArticle } from './articles.js';
import { summarizeWithGemini } from './summarize.js';

const parser = new Parser();

function startFeedJob() {
  setInterval(async () => {
    if (subscriptions.length === 0) return;
    console.log("Fetching subscribed RSS feeds...");
    for (const url of subscriptions) {
      try {
        const feed = await parser.parseURL(url);
        console.log(`Fetched feed: ${feed.title} (${url})`);
        for (const [idx, item] of feed.items.entries()) {
          console.log(`  [${idx + 1}] ${item.title} - ${item.link}`);
          if (item.link) {
            try {
              const articleData = await extractArticle(item.link);
              if (articleData && articleData.content) {
                console.log(
                  `      [Full Article Extracted]:\n${articleData.content.substring(0, 1000)}...`
                );
                const summary = await summarizeWithGemini(
                  articleData.content
                );
                if (summary) {
                  console.log(`      [Gemini Summary]: ${summary}`);
                }
                upsertArticle({
                  id: item.link,
                  feedUrl: url,
                  title: item.title,
                  link: item.link,
                  pubDate: item.pubDate || new Date().toISOString(),
                  content: articleData.content,
                  summary: summary,
                  processedAt: new Date().toISOString()
                });
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
        console.error(`Failed to fetch ${url}:`, err.message);
      }
    }
  }, 1 * 10 * 1000);
}

export { startFeedJob };

