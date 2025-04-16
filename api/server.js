// API server (port 3001)
import express from "express";
import cors from "cors";
import { subscriptions, subscribeToFeed } from "./subscriptions.js";
import { articles } from "./articles.js";
import { startFeedJob, fetchAllFeeds } from './feeds.js';

const apiApp = express();
const API_PORT = 3001;

// Enable CORS for all origins (or restrict to http://localhost:3000 if you prefer)
apiApp.use(cors({ origin: "http://localhost:3000" }));
apiApp.use(express.json());

apiApp.get("/subscriptions", (req, res) => {
  res.json({ subscriptions });
});

import Parser from 'rss-parser';
const rssParser = new Parser();

apiApp.post("/subscribe", async (req, res) => {
  const { url, name } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Missing RSS feed URL" });
  }
  let feedName = name;
  if (!feedName) {
    try {
      const feed = await rssParser.parseURL(url);
      feedName = feed.title || url;
    } catch (e) {
      feedName = url;
    }
  }
  const newSub = subscribeToFeed(url, feedName);
  await fetchAllFeeds();
  res.json({ message: `Subscribed to ${feedName} (${url})` });
});

import { Feed } from 'feed';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const UI_BASE_URL = process.env.UI_BASE_URL || 'http://localhost:3000';

// Publish subscriptions as an RSS feed
apiApp.get('/subscriptions-rss', (req, res) => {
  // Always read the latest subscriptions from disk
  let subscriptionsList = [];
  try {
    subscriptionsList = JSON.parse(fs.readFileSync('./data/subscriptions.json', 'utf-8'));
  } catch (e) {}

  const feed = new Feed({
    title: 'My Subscribed RSS Feeds',
    description: 'A list of feeds I am subscribed to',
    id: `${API_BASE_URL}/subscriptions-rss`,
    link: `${API_BASE_URL}/subscriptions-rss`,
    language: 'en',
    updated: new Date(),
    generator: 'airss',
    feedLinks: { rss2: `${API_BASE_URL}/subscriptions-rss` },
    author: { name: 'RSS Publisher' },
  });

  subscriptionsList.forEach(sub => {
    feed.addItem({
      title: sub.name || sub.url,
      id: sub.url,
      link: sub.url,
      description: `Subscribed feed: ${sub.name || sub.url}`,
      date: new Date(),
    });
  });

  res.type('application/rss+xml');
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(feed.rss2());
});

// Publish articles as an RSS feed, filtered by feedUrl if provided
apiApp.get('/articles-rss', (req, res) => {
  let articles = [];
  try {
    articles = JSON.parse(fs.readFileSync('./data/articles.json', 'utf-8'));
  } catch (e) {}

  const { feedUrl } = req.query;
  let filtered = articles;
  if (feedUrl) {
    filtered = articles.filter(a => a.feedUrl === feedUrl);
  }

  const feed = new Feed({
    title: feedUrl ? `Articles for ${feedUrl}` : 'All Articles',
    description: feedUrl ? `RSS articles for ${feedUrl}` : 'All articles from all feeds',
    id: `${API_BASE_URL}/articles-rss`,
    link: `${API_BASE_URL}/articles-rss`,
    language: 'en',
    updated: new Date(),
    generator: 'airss',
    feedLinks: { rss2: `${API_BASE_URL}/articles-rss` },
    author: { name: 'RSS Publisher' },
  });

  filtered.forEach(article => {
    feed.addItem({
      title: article.title || article.link,
      id: article.id || article.link,
      link: article.link,
      description: article.summary || '',
      content: article.content || '',
      date: article.pubDate ? new Date(article.pubDate) : new Date(),
    });
  });

  res.type('application/rss+xml');
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(feed.rss2());
});

apiApp.listen(API_PORT, () => {
  console.log(`API running at http://localhost:${API_PORT}`);
});

startFeedJob();
