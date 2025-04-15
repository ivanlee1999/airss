import express from 'express';
import { Feed } from 'feed';

const app = express();
const port = 3000;

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
