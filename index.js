import express from 'express';
import { Feed } from 'feed';
import Parser from 'rss-parser';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const app = express();
const port = 3000;

// In-memory RSS subscription store
const subscriptions = [];
const parser = new Parser();

// Function to subscribe to a new RSS feed
function subscribeToFeed(url) {
  if (!subscriptions.includes(url)) {
    subscriptions.push(url);
    console.log(`Subscribed to: ${url}`);
  } else {
    console.log(`Already subscribed to: ${url}`);
  }
}

// Background job to fetch all subscribed feeds every 10 minutes
setInterval(async () => {
  if (subscriptions.length === 0) return;
  console.log('Fetching subscribed RSS feeds...');
  for (const url of subscriptions) {
    try {
      const feed = await parser.parseURL(url);
      console.log(`Fetched feed: ${feed.title} (${url})`);
      // Print each item in the feed
      for (const [idx, item] of feed.items.entries()) {
        console.log(`  [${idx + 1}] ${item.title} - ${item.link}`);
        if (item.content) {
          console.log(`      Content: ${item.content}`);
        } else if (item.description) {
          console.log(`      Description: ${item.description}`);
        }
        // Fetch and parse the linked article
        if (item.link) {
          try {
            const res = await fetch(item.link, { timeout: 10000 });
            const html = await res.text();
            const $ = cheerio.load(html);
            // Extract main content: join all <p> tags
            const articleText = $('p').map((i, el) => $(el).text()).get().join('\n');
            if (articleText) {
              console.log(`      [Parsed Article Content Preview]:\n${articleText.substring(0, 500)}...`);
            } else {
              console.log(`      [No readable article content found]`);
            }
          } catch (err) {
            console.log(`      [Failed to fetch/parse article]: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err.message);
    }
  }
}, 1 * 5 * 1000); // every 10 minutes

// Example usage (remove or replace with dynamic logic)
// subscribeToFeed('https://hnrss.org/frontpage');

// Create a new feed
const feed = new Feed({
  title: "My RSS Feed",
  description: "This is a sample RSS feed",
  id: "http://localhost:3000/",
  link: "http://localhost:3000/",
  language: "en",
  updated: new Date(),
  generator: "Simple RSS Publisher",
  feedLinks: {
    rss2: 'http://localhost:3000/rss'
  },
  author: {
    name: "RSS Publisher",
    email: "example@example.com",
    link: "http://localhost:3000"
  }
});

// Add a sample item to the feed
feed.addItem({
  title: "First Article",
  id: "http://localhost:3000/article1",
  link: "http://localhost:3000/article1",
  description: "This is my first article",
  content: "Hello, this is the content of my first article!",
  date: new Date()
});

app.get('/rss', (req, res) => {
  res.type('application/rss+xml');
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(feed.rss2());
});

// Simple endpoint to subscribe via API
app.post('/subscribe', express.json(), (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing RSS feed URL' });
  }
  subscribeToFeed(url);
  res.json({ message: `Subscribed to ${url}` });
});

app.get('/', (req, res) => {
  res.send(`
    <h1>RSS Publisher</h1>
    <p>RSS Feed URL: <a href="/rss">http://localhost:3000/rss</a></p>
    <h2>How to Subscribe</h2>
    <ol>
      <li>Copy the RSS feed URL: <code>http://localhost:3000/rss</code></li>
      <li>Open your favorite RSS reader (like Feedly, NetNewsWire, or Inoreader)</li>
      <li>Add a new subscription</li>
      <li>Paste the RSS feed URL</li>
    </ol>
  `);
});

app.listen(port, () => {
  console.log(`RSS publisher running at http://localhost:${port}`);
});
