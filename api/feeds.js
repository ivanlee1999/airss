// Background job for fetching and parsing feeds
import Parser from 'rss-parser';
import { extract as extractArticle } from '@extractus/article-extractor';
import { getAllSubscriptions } from './subscriptions.js';
import { upsertArticle } from './articles.js';
import { connectDB } from './db.js';
import { summarizeWithGemini } from './summarize.js';

const parser = new Parser();

// Fetch and store articles (no summarization) with parallel processing
async function fetchAllFeeds() {
  const subscriptions = await getAllSubscriptions();
  if (!subscriptions || subscriptions.length === 0) return;
  const db = await connectDB();
  console.log("Fetching subscribed RSS feeds...");
  
  // Process feeds in parallel (with a reasonable concurrency limit)
  const FEED_CONCURRENCY = 5; // Process 3 feeds at a time
  
  // Create chunks of subscriptions to process in parallel
  const chunks = [];
  for (let i = 0; i < subscriptions.length; i += FEED_CONCURRENCY) {
    chunks.push(subscriptions.slice(i, i + FEED_CONCURRENCY));
  }
  
  // Process each chunk of feeds in parallel
  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (sub) => {
      try {
        const feed = await parser.parseURL(sub.url);
        console.log(`Fetched feed: ${feed.title} (${sub.url})`);
        
        // Process articles in parallel (with a reasonable concurrency limit)
        const ARTICLE_CONCURRENCY = 5; // Process 5 articles at a time
        
        // Create chunks of articles to process in parallel
        const articleChunks = [];
        for (let i = 0; i < feed.items.length; i += ARTICLE_CONCURRENCY) {
          articleChunks.push(feed.items.slice(i, i + ARTICLE_CONCURRENCY));
        }
        
        // Process each chunk of articles in parallel
        for (const articleChunk of articleChunks) {
          await Promise.all(articleChunk.map(async (item, chunkIdx) => {
            const idx = chunkIdx + articleChunks.indexOf(articleChunk) * ARTICLE_CONCURRENCY;
            console.log(`  [${idx + 1}] ${item.title} - ${item.link}`);
            
            if (item.link) {
              try {
                // First check if the article already exists
                const existing = await db.collection('articles').findOne({ link: item.link });
                
                if (!existing) {
                  try {
                    // Try to extract article content if it doesn't exist yet
                    const articleData = await extractArticle(item.link);
                    if (articleData && articleData.content) {
                      console.log(
                        `      [Full Article Extracted]:
${articleData.content.substring(0, 1000)}...`
                      );
                      
                      await db.collection('articles').insertOne({
                        id: item.link,
                        feedUrl: sub.url,
                        feedId: sub._id,
                        title: item.title,
                        link: item.link,
                        pubDate: item.pubDate || new Date().toISOString(),
                        content: articleData.content,
                        summary: null,
                        sentToGemini: false,
                        processedAt: new Date().toISOString(),
                        feedName: sub.name
                      });
                      console.log(`      [Article stored successfully]: ${item.title}`);
                    } else {
                      // Fallback: Use the description from the RSS feed if available
                      console.log("      [No full article content extracted, using RSS description as fallback]");
                      const content = item.content || item.contentSnippet || item.description || '';
                      
                      await db.collection('articles').insertOne({
                        id: item.link,
                        feedUrl: sub.url,
                        feedId: sub._id,
                        title: item.title,
                        link: item.link,
                        pubDate: item.pubDate || new Date().toISOString(),
                        content: content,
                        summary: null,
                        sentToGemini: false,
                        processedAt: new Date().toISOString(),
                        feedName: sub.name,
                        extractionFailed: true // Flag to indicate extraction failed
                      });
                      console.log(`      [Article stored with RSS content]: ${item.title}`);
                    }
                  } catch (extractionError) {
                    // Fallback: Store the article with content from the RSS feed
                    console.log(`      [Extraction failed: ${extractionError.message}, using RSS description as fallback]`);
                    const content = item.content || item.contentSnippet || item.description || '';
                    
                    await db.collection('articles').insertOne({
                      id: item.link,
                      feedUrl: sub.url,
                      feedId: sub._id,
                      title: item.title,
                      link: item.link,
                      pubDate: item.pubDate || new Date().toISOString(),
                      content: content,
                      summary: null,
                      sentToGemini: false,
                      processedAt: new Date().toISOString(),
                      feedName: sub.name,
                      extractionFailed: true // Flag to indicate extraction failed
                    });
                    console.log(`      [Article stored with RSS content]: ${item.title}`);
                  }
                } else {
                  console.log(`      [Article already exists, skipping extraction and insert]: ${item.link}`);
                }
              } catch (err) {
                console.log(`      [Failed to extract article]: ${err.message}`);
              }
            }
          }));
        }
      } catch (err) {
        console.error(`Failed to fetch ${sub.url}:`, err.message);
      }
    }));
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

// Fetch a single feed by URL
async function fetchSingleFeed(url, name) {
  if (!url) return;
  const db = await connectDB();
  console.log(`Fetching single RSS feed: ${name} (${url})...`);
  
  try {
    const parser = new Parser();
    const feed = await parser.parseURL(url);
    console.log(`Fetched feed: ${feed.title} (${url})`);
    
    // Find the subscription ID for this feed
    const subscription = await db.collection('subscriptions').findOne({ url });
    if (!subscription) {
      console.error(`Subscription not found for URL: ${url}`);
      return;
    }
    
    // Process articles in parallel (with a reasonable concurrency limit)
    const ARTICLE_CONCURRENCY = 5; // Process 5 articles at a time
    
    // Create chunks of articles to process in parallel
    const articleChunks = [];
    for (let i = 0; i < feed.items.length; i += ARTICLE_CONCURRENCY) {
      articleChunks.push(feed.items.slice(i, i + ARTICLE_CONCURRENCY));
    }
    
    // Process each chunk of articles in parallel
    for (const articleChunk of articleChunks) {
      await Promise.all(articleChunk.map(async (item, chunkIdx) => {
        const idx = chunkIdx + articleChunks.indexOf(articleChunk) * ARTICLE_CONCURRENCY;
        console.log(`  [${idx + 1}] ${item.title} - ${item.link}`);
        
        if (item.link) {
          try {
            // First check if the article already exists
            const existing = await db.collection('articles').findOne({ link: item.link });
            
            if (!existing) {
              try {
                // Try to extract article content if it doesn't exist yet
                const articleData = await extractArticle(item.link);
                if (articleData && articleData.content) {
                  console.log(
                    `      [Full Article Extracted]:
${articleData.content.substring(0, 1000)}...`
                  );
                  
                  await db.collection('articles').insertOne({
                    id: item.link,
                    feedUrl: url,
                    feedId: subscription._id,
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate || new Date().toISOString(),
                    content: articleData.content,
                    summary: null,
                    sentToGemini: false,
                    processedAt: new Date().toISOString(),
                    feedName: name
                  });
                  console.log(`      [Article stored successfully]: ${item.title}`);
                } else {
                  // Fallback: Use the description from the RSS feed if available
                  console.log("      [No full article content extracted, using RSS description as fallback]");
                  const content = item.content || item.contentSnippet || item.description || '';
                  
                  await db.collection('articles').insertOne({
                    id: item.link,
                    feedUrl: url,
                    feedId: subscription._id,
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate || new Date().toISOString(),
                    content: content,
                    summary: null,
                    sentToGemini: false,
                    processedAt: new Date().toISOString(),
                    feedName: name,
                    extractionFailed: true // Flag to indicate extraction failed
                  });
                  console.log(`      [Article stored with RSS content]: ${item.title}`);
                }
              } catch (extractionError) {
                // Fallback: Store the article with content from the RSS feed
                console.log(`      [Extraction failed: ${extractionError.message}, using RSS description as fallback]`);
                const content = item.content || item.contentSnippet || item.description || '';
                
                await db.collection('articles').insertOne({
                  id: item.link,
                  feedUrl: url,
                  feedId: subscription._id,
                  title: item.title,
                  link: item.link,
                  pubDate: item.pubDate || new Date().toISOString(),
                  content: content,
                  summary: null,
                  sentToGemini: false,
                  processedAt: new Date().toISOString(),
                  feedName: name,
                  extractionFailed: true // Flag to indicate extraction failed
                });
                console.log(`      [Article stored with RSS content]: ${item.title}`);
              }
            } else {
              console.log(`      [Article already exists, skipping extraction and insert]: ${item.link}`);
            }
          } catch (err) {
            console.log(`      [Failed to extract article]: ${err.message}`);
          }
        }
      }));
    }
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err.message);
  }
}

export { startFeedJob, fetchAllFeeds, fetchSingleFeed, startSummarizeJob, summarizeAllArticles };

