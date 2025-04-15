// API server (port 3001)
import express from 'express';
import { subscriptions, subscribeToFeed } from './subscriptions.js';
import { articles } from './articles.js';
import { startFeedJob } from './feeds.js';

const apiApp = express();
const API_PORT = 3001;

apiApp.use(express.json());

apiApp.get('/subscriptions', (req, res) => {
  res.json({ subscriptions });
});

apiApp.post('/subscribe', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing RSS feed URL' });
  }
  subscribeToFeed(url);
  res.json({ message: `Subscribed to ${url}` });
});

// (You can add more API endpoints here)

apiApp.listen(API_PORT, () => {
  console.log(`API running at http://localhost:${API_PORT}`);
});

startFeedJob();
